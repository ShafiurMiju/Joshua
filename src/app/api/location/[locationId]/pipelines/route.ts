import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import Pipeline from '@/lib/models/Pipeline';
import { GHLClient } from '@/lib/ghl';

// GET /api/location/[locationId]/pipelines - Get pipelines from DB
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;

    const pipelines = await Pipeline.find({ locationId }).sort({ name: 1 });

    return NextResponse.json({ pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipelines', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/location/[locationId]/pipelines - Sync pipelines from GHL
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
    const { pipelines } = await client.getPipelines();

    let synced = 0;
    for (const pipeline of pipelines) {
      await Pipeline.findOneAndUpdate(
        { ghlId: pipeline.id, locationId },
        {
          ghlId: pipeline.id,
          locationId,
          name: pipeline.name,
          stages: pipeline.stages,
          syncedAt: new Date(),
        },
        { upsert: true, returnDocument: 'after' }
      );
      synced++;
    }

    const updatedPipelines = await Pipeline.find({ locationId }).sort({ name: 1 });

    return NextResponse.json({
      success: true,
      synced,
      pipelines: updatedPipelines,
    });
  } catch (error) {
    console.error('Error syncing pipelines:', error);
    return NextResponse.json(
      { error: 'Failed to sync pipelines', details: String(error) },
      { status: 500 }
    );
  }
}
