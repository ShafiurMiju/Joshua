import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';

// GET /api/location/[locationId] - Check if location exists, return status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;

    let location = await Location.findOne({ locationId });

    if (!location) {
      // Create new location entry
      location = await Location.create({ locationId, apiKey: '', name: '' });
      return NextResponse.json({
        exists: true,
        hasApiKey: false,
        location: {
          locationId: location.locationId,
          name: location.name,
          hasApiKey: false,
        },
      });
    }

    return NextResponse.json({
      exists: true,
      hasApiKey: !!location.apiKey,
      location: {
        locationId: location.locationId,
        name: location.name,
        hasApiKey: !!location.apiKey,
      },
    });
  } catch (error) {
    console.error('Error checking location:', error);
    return NextResponse.json(
      { error: 'Failed to check location', details: String(error) },
      { status: 500 }
    );
  }
}
