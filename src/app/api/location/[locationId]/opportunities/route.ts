import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import Opportunity from '@/lib/models/Opportunity';
import { GHLClient } from '@/lib/ghl';

// GET /api/location/[locationId]/opportunities - List from DB with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const pipelineId = searchParams.get('pipelineId') || undefined;
    const pipelineStageId = searchParams.get('pipelineStageId') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortField = searchParams.get('sortField') || undefined;
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    const query: Record<string, unknown> = { locationId };
    if (pipelineId) query.pipelineId = pipelineId;
    if (pipelineStageId) query.pipelineStageId = pipelineStageId;
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'contact.name': { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        // Backward compat: old flat fields
        { contactName: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    // Map sort fields to database fields
    const sortFieldMap: Record<string, string> = {
      'updatedOn': 'ghlUpdatedAt',
      'createdOn': 'createdAt',
      'lastStageChangeDate': 'lastStageChangeAt',
      'lastStatusChangeDate': 'lastStatusChangeAt',
      'opportunityName': 'name',
      'stage': 'pipeline.stageName',
      'status': 'status',
      'opportunitySource': 'source',
      'opportunityValue': 'monetaryValue',
    };

    const dbSortField = sortField ? (sortFieldMap[sortField] || sortField) : 'ghlUpdatedAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [opportunities, total] = await Promise.all([
      Opportunity.find(query)
        .sort({ [dbSortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Opportunity.countDocuments(query),
    ]);

    // Normalize old flat-field documents to nested contact structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = opportunities.map((opp: any) => {
      if (!opp.contact || !opp.contact.name) {
        opp.contact = {
          id: opp.contact?.id || opp.contactId || '',
          name: opp.contact?.name || opp.contactName || '',
          companyName: opp.contact?.companyName || opp.contactCompanyName || '',
          email: opp.contact?.email || opp.contactEmail || '',
          phone: opp.contact?.phone || opp.contactPhone || '',
          tags: opp.contact?.tags || opp.contactTags || [],
          followers: opp.contact?.followers || opp.contactFollowers || [],
        };
      }
      return opp;
    });

    return NextResponse.json({
      opportunities: normalized,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/location/[locationId]/opportunities - Create opportunity in GHL + DB
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const body = await request.json();

    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);

    // Extract only valid GHL create fields (exclude form-only fields)
    const ghlCreatePayload: Record<string, unknown> = {
      locationId,
      pipelineId: body.pipelineId,
      name: body.name,
      status: body.status || 'open',
      contactId: body.contactId,
    };
    if (body.pipelineStageId) ghlCreatePayload.pipelineStageId = body.pipelineStageId;
    if (body.monetaryValue !== undefined && body.monetaryValue !== '') ghlCreatePayload.monetaryValue = body.monetaryValue;
    if (body.assignedTo) ghlCreatePayload.assignedTo = body.assignedTo;
    if (body.source) ghlCreatePayload.source = body.source;
    if (Array.isArray(body.customFields) && body.customFields.length > 0) ghlCreatePayload.customFields = body.customFields;

    // Create in GHL first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { opportunity } = await client.createOpportunity(ghlCreatePayload as any);

    // Update contact info (name, email, phone, tags) if provided
    const contactId = opportunity.contactId || body.contactId;
    if (contactId) {
      const contactUpdate: Record<string, unknown> = {};
      if (body.contactName) contactUpdate.name = body.contactName;
      if (body.contactEmail) contactUpdate.email = body.contactEmail;
      if (body.contactPhone) contactUpdate.phone = body.contactPhone;
      if (Array.isArray(body.contactTags) && body.contactTags.length > 0) contactUpdate.tags = body.contactTags;
      if (Object.keys(contactUpdate).length > 0) {
        try {
          await client.updateContact(contactId, contactUpdate as Parameters<typeof client.updateContact>[1]);
        } catch (e) {
          console.error('[POST create] contact update failed:', e);
        }
      }
    }

    // Add followers if provided
    if (Array.isArray(body.followers) && (body.followers as string[]).length > 0) {
      try {
        await client.addFollowers(opportunity.id, body.followers as string[]);
      } catch (e) {
        console.error('[POST create] addFollowers failed:', e);
      }
    }

    // Store in DB
    const dbOpportunity = await Opportunity.findOneAndUpdate(
      { ghlId: opportunity.id, locationId },
      {
        ghlId: opportunity.id,
        locationId,
        name: opportunity.name,
        monetaryValue: opportunity.monetaryValue || 0,
        pipelineId: opportunity.pipelineId,
        pipelineStageId: opportunity.pipelineStageId,
        assignedTo: opportunity.assignedTo || '',
        status: opportunity.status || 'open',
        source: opportunity.source || '',
        contactId: opportunity.contactId || '',
        contact: {
          id: opportunity.contactId || body.contactId || '',
          name: (body.contactName as string) || opportunity.contact?.name || '',
          companyName: opportunity.contact?.companyName || '',
          email: (body.contactEmail as string) || opportunity.contact?.email || '',
          phone: (body.contactPhone as string) || opportunity.contact?.phone || '',
          tags: body.contactTags || opportunity.contact?.tags || [],
          followers: opportunity.contact?.followers || [],
        },
        lastStatusChangeAt: opportunity.lastStatusChangeAt || '',
        lastStageChangeAt: opportunity.lastStageChangeAt || '',
        lastActionDate: opportunity.lastActionDate || '',
        isAttribute: opportunity.isAttribute || false,
        internalSource: opportunity.internalSource || {},
        followers: body.followers as string[] || [],
        customFields: opportunity.customFields || [],
        additionalContacts: [],
        ghlCreatedAt: opportunity.createdAt || '',
        ghlUpdatedAt: opportunity.updatedAt || '',
        syncedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json({ opportunity: dbOpportunity }, { status: 201 });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to create opportunity', details: String(error) },
      { status: 500 }
    );
  }
}
