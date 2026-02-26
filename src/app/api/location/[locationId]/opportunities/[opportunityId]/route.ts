import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import Opportunity from '@/lib/models/Opportunity';
import { GHLClient } from '@/lib/ghl';

// GET single opportunity from DB
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> }
) {
  try {
    await connectDB();
    const { locationId, opportunityId } = await params;

    const opportunity = await Opportunity.findOne({
      ghlId: opportunityId,
      locationId,
    }).lean();

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Normalize old flat-field document to nested contact structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opp = opportunity as any;
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

    return NextResponse.json({ opportunity: opp });
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunity', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT update opportunity in GHL + DB
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> }
) {
  try {
    await connectDB();
    const { locationId, opportunityId } = await params;
    const body = await request.json();

    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);

    // ── Step 0: Fetch current opportunity from GHL to get authoritative values ──
    let currentGhlOpp: Record<string, unknown> | null = null;
    try {
      const { opportunity: fetched } = await client.getOpportunity(opportunityId);
      currentGhlOpp = fetched as unknown as Record<string, unknown>;
    } catch (err) {
      console.warn('[PUT opportunity] Could not pre-fetch GHL opportunity:', err);
    }

    // ── Step 1: Update opportunity fields in GHL ──────────────────────────
    // Use GHL's current pipelineId/pipelineStageId as fallback to avoid "pipeline not found" errors
    // from stale DB values. Only override if the form value actually differs from what GHL has.
    const ghlPayload: Record<string, unknown> = {};
    if (body.name !== undefined) ghlPayload.name = body.name;
    if (body.contactId !== undefined) ghlPayload.contactId = body.contactId;
    if (body.status !== undefined) ghlPayload.status = body.status;
    if (body.monetaryValue !== undefined) ghlPayload.monetaryValue = body.monetaryValue;
    if (body.assignedTo !== undefined) ghlPayload.assignedTo = body.assignedTo;
    if (body.customFields !== undefined) ghlPayload.customFields = body.customFields;

    // For pipeline fields: trust the form-submitted values.
    // If body sends pipelineId / pipelineStageId, use them (user explicitly chose them).
    // Fall back to GHL's current values only when the body omits them.
    const currentPipelineId = (currentGhlOpp?.pipelineId as string) || '';
    const currentStageId = (currentGhlOpp?.pipelineStageId as string) || '';

    if (body.pipelineId !== undefined) {
      ghlPayload.pipelineId = body.pipelineId;
    } else if (currentPipelineId) {
      ghlPayload.pipelineId = currentPipelineId;
    }

    if (body.pipelineStageId !== undefined) {
      ghlPayload.pipelineStageId = body.pipelineStageId;
    } else if (currentStageId) {
      ghlPayload.pipelineStageId = currentStageId;
    }

    await client.updateOpportunity(opportunityId, ghlPayload);

    // ── Step 2: Update contact fields in GHL ─────────────────────────────
    // Spec: PUT /contacts/:contactId
    // Accepted fields: firstName, lastName, name, email, phone, tags
    // No locationId in body, no followers, no additionalContacts
    const contactId = (body.contactId as string) || '';
    let contactUpdateError: string | null = null;
    if (contactId) {
      const contactPayload: Record<string, unknown> = {};
      if (body.contactName) {
        const nameParts = (body.contactName as string).trim().split(/\s+/);
        contactPayload.firstName = nameParts[0] || '';
        contactPayload.lastName = nameParts.slice(1).join(' ') || '';
        contactPayload.name = body.contactName;
      }
      if (body.contactEmail !== undefined) contactPayload.email = body.contactEmail;
      if (body.contactPhone !== undefined) contactPayload.phone = body.contactPhone;
      if (body.contactTags !== undefined) contactPayload.tags = body.contactTags;
      if (Object.keys(contactPayload).length > 0) {
        try {
          await client.updateContact(contactId, contactPayload);
        } catch (err) {
          contactUpdateError = err instanceof Error ? err.message : String(err);
          console.error('[PUT opportunity] GHL contact update FAILED:', contactUpdateError);
        }
      }
    }

    // ── Step 2b: Sync followers via dedicated GHL followers API ─────────────
    // POST /opportunities/:id/followers to add, DELETE /opportunities/:id/followers to remove
    if (body.followers !== undefined) {
      const newFollowerIds = (body.followers as string[]);
      const currentFollowers = (currentGhlOpp?.followers as string[]) || [];

      // Remove followers that are no longer in the new set
      const toRemove = currentFollowers.filter((id) => !newFollowerIds.includes(id));
      if (toRemove.length > 0) {
        try {
          await client.removeFollowers(opportunityId, toRemove);
        } catch (err) {
          console.error('[PUT followers] removeFollowers FAILED:', err);
        }
      }

      // Add followers that weren't there before
      const toAdd = newFollowerIds.filter((id) => !currentFollowers.includes(id));
      if (toAdd.length > 0) {
        try {
          await client.addFollowers(opportunityId, toAdd);
        } catch (err) {
          console.error('[PUT followers] addFollowers FAILED:', err);
        }
      }
    }

    // ── Step 3: Re-fetch full opportunity from GHL to get latest data ─────
    let fullOpportunity: Record<string, unknown> | null = null;
    try {
      const { opportunity: fetched } = await client.getOpportunity(opportunityId);
      fullOpportunity = fetched as unknown as Record<string, unknown>;
    } catch (err) {
      console.error('GHL re-fetch failed, using pre-fetch data for DB update:', err);
      fullOpportunity = currentGhlOpp;
    }

    // ── Step 4: Build DB update — GHL data first, form values override ────
    // Form-submitted values are authoritative for fields GHL may not echo back immediately
    const dbUpdate: Record<string, unknown> = {
      // Opportunity core fields from GHL response (or form fallback)
      name: fullOpportunity?.name ?? body.name,
      monetaryValue: fullOpportunity?.monetaryValue ?? body.monetaryValue ?? 0,
      pipelineId: fullOpportunity?.pipelineId ?? body.pipelineId,
      pipelineStageId: fullOpportunity?.pipelineStageId ?? body.pipelineStageId,
      status: fullOpportunity?.status ?? body.status ?? 'open',
      source: fullOpportunity?.source ?? body.source ?? '',
      assignedTo: body.assignedTo !== undefined ? body.assignedTo : (fullOpportunity?.assignedTo ?? ''),

      // Custom fields: form-submitted values (body.customFields) are authoritative because
      // they use our { id, key, field_value } format, while GHL re-fetch returns a different
      // format ({ id, fieldValueString, fieldValueArray, type }) that the card UI can't read.
      // When body.customFields is not sent (e.g. stage drag), keep existing DB values unchanged.
      customFields: body.customFields && (body.customFields as unknown[]).length > 0
        ? body.customFields
        : undefined, // undefined = skip this field in $set so existing DB custom fields are preserved

      // Contact ID: form-submitted value is authoritative (GHL Update Opp API doesn't support contactId changes,
      // but we track it in DB. Use body.contactId first, then GHL's current value as fallback.)
      contactId: (body.contactId as string) || fullOpportunity?.contactId || contactId,

      // Contact details: nested object matching GHL API response
      contact: {
        id: (body.contactId as string) || (fullOpportunity?.contactId as string) || contactId,
        name: body.contactName !== undefined ? (body.contactName as string) : ((fullOpportunity?.contact as Record<string,unknown>)?.name as string || ''),
        companyName: (fullOpportunity?.contact as Record<string,unknown>)?.companyName as string || '',
        email: body.contactEmail !== undefined ? (body.contactEmail as string) : ((fullOpportunity?.contact as Record<string,unknown>)?.email as string || ''),
        phone: body.contactPhone !== undefined ? (body.contactPhone as string) : ((fullOpportunity?.contact as Record<string,unknown>)?.phone as string || ''),
        tags: body.contactTags !== undefined
          ? (body.contactTags as string[])
          : ((fullOpportunity?.contact as Record<string,unknown>)?.tags as string[] ?? []),
        followers: (fullOpportunity?.contact as Record<string,unknown>)?.followers as string[] ?? [],
      },

      // Followers: form-submitted user IDs, stored as string array matching GHL format
      followers: body.followers !== undefined
        ? (body.followers as string[])
        : (fullOpportunity?.followers as string[] ?? []),

      // Additional contacts: form-submitted IDs are authoritative
      additionalContacts: body.additionalContacts !== undefined
        ? (body.additionalContacts as string[])
        : [],

      lastStatusChangeAt: fullOpportunity?.lastStatusChangeAt ?? '',
      lastStageChangeAt: fullOpportunity?.lastStageChangeAt ?? '',
      lastActionDate: fullOpportunity?.lastActionDate ?? '',
      isAttribute: fullOpportunity?.isAttribute ?? false,
      internalSource: fullOpportunity?.internalSource ?? {},
      ghlUpdatedAt: fullOpportunity?.updatedAt ?? '',
      syncedAt: new Date(),
    };

    // Remove undefined keys so MongoDB doesn't overwrite existing values with null
    for (const key of Object.keys(dbUpdate)) {
      if (dbUpdate[key] === undefined) delete dbUpdate[key];
    }

    const dbOpportunity = await Opportunity.findOneAndUpdate(
      { ghlId: opportunityId, locationId },
      dbUpdate,
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      opportunity: dbOpportunity,
      ...(contactUpdateError ? { contactUpdateWarning: contactUpdateError } : {}),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Error updating opportunity:', detail);
    return NextResponse.json(
      { error: 'Failed to update opportunity', details: detail },
      { status: 500 }
    );
  }
}

// DELETE opportunity from GHL + DB
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> }
) {
  try {
    await connectDB();
    const { locationId, opportunityId } = await params;

    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);

    // Delete from GHL
    await client.deleteOpportunity(opportunityId);

    // Delete from DB
    await Opportunity.deleteOne({ ghlId: opportunityId, locationId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    return NextResponse.json(
      { error: 'Failed to delete opportunity', details: String(error) },
      { status: 500 }
    );
  }
}
