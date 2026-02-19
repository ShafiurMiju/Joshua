import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import { GHLClient } from '@/lib/ghl';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;

    const location = await Location.findOne({ locationId });
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const client = new GHLClient(location.apiKey, locationId);
    const data = await client.getLocationTags();

    return NextResponse.json({ tags: (data.tags || []).map((t) => t.name) });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags', details: String(error) }, { status: 500 });
  }
}
