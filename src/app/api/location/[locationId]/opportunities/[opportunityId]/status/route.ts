import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import Opportunity from '@/lib/models/Opportunity';
import { GHLClient } from '@/lib/ghl';

// PUT update opportunity status in GHL + DB
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> }
) {
  try {
    await connectDB();
    const { locationId, opportunityId } = await params;
    const { status } = await request.json();

    if (!['open', 'won', 'lost', 'abandoned'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);

    // Update status in GHL
    await client.updateOpportunityStatus(opportunityId, status);

    // Update in DB
    const opportunity = await Opportunity.findOneAndUpdate(
      { ghlId: opportunityId, locationId },
      { status, syncedAt: new Date() },
      { returnDocument: 'after' }
    );

    return NextResponse.json({ opportunity });
  } catch (error) {
    console.error('Error updating opportunity status:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity status', details: String(error) },
      { status: 500 }
    );
  }
}
