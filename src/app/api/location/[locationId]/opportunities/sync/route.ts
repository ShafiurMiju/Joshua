import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import Opportunity from '@/lib/models/Opportunity';
import { GHLClient } from '@/lib/ghl';

// POST /api/location/[locationId]/opportunities/sync - Sync ALL from GHL to DB
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;

    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);
    const searchParams = request.nextUrl.searchParams;
    const pipelineId = searchParams.get('pipelineId') || undefined;

    // Fetch all opportunities from GHL
    const opportunities = await client.fetchAllOpportunities(pipelineId);

    let synced = 0;
    let errors = 0;
    const BATCH_SIZE = 500;
    const now = new Date();

    // Process in batches using bulkWrite for performance
    for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
      const batch = opportunities.slice(i, i + BATCH_SIZE);
      const bulkOps = batch.map((opp) => ({
        updateOne: {
          filter: { ghlId: opp.id, locationId },
          update: {
            $set: {
              ghlId: opp.id,
              locationId,
              name: opp.name,
              monetaryValue: opp.monetaryValue || 0,
              pipelineId: opp.pipelineId,
              pipelineStageId: opp.pipelineStageId,
              assignedTo: opp.assignedTo || '',
              status: opp.status || 'open',
              source: opp.source || '',
              contactId: opp.contactId || '',
              contact: {
                id: opp.contact?.id || opp.contactId || '',
                name: opp.contact?.name || '',
                companyName: opp.contact?.companyName || '',
                email: opp.contact?.email || '',
                phone: opp.contact?.phone || '',
                tags: opp.contact?.tags || [],
                followers: opp.contact?.followers || [],
              },
              lastStatusChangeAt: opp.lastStatusChangeAt || '',
              lastStageChangeAt: opp.lastStageChangeAt || '',
              lastActionDate: opp.lastActionDate || '',
              isAttribute: opp.isAttribute || false,
              internalSource: opp.internalSource || {},
              followers: opp.followers || [],
              // Normalize GHL custom fields to { id, key, field_value } format
              // GHL may return { id, fieldValueString, fieldValueArray, type } or { id, key, field_value }
              customFields: (opp.customFields || []).map((cf: Record<string, unknown>) => ({
                id: (cf as Record<string, string>).id || '',
                key: (cf as Record<string, string>).key || (cf as Record<string, string>).fieldKey || '',
                field_value: (cf as Record<string, unknown>).field_value ?? (cf as Record<string, unknown>).fieldValueArray ?? (cf as Record<string, unknown>).fieldValueString ?? '',
              })),
              ghlCreatedAt: opp.createdAt || '',
              ghlUpdatedAt: opp.updatedAt || '',
              syncedAt: now,
            },
          },
          upsert: true,
        },
      }));

      try {
        const result = await Opportunity.bulkWrite(bulkOps, { ordered: false });
        synced += result.upsertedCount + result.modifiedCount;
      } catch (err) {
        console.error(`Error in batch ${i / BATCH_SIZE}:`, err);
        errors += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      total: opportunities.length,
      synced,
      errors,
    });
  } catch (error) {
    console.error('Error syncing opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to sync opportunities', details: String(error) },
      { status: 500 }
    );
  }
}
