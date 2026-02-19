import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import { GHLClient } from '@/lib/ghl';

// POST /api/location/[locationId]/api-key - Store API key
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate API key by trying to fetch pipelines from GHL
    try {
      const client = new GHLClient(apiKey, locationId);
      await client.getPipelines();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide specific error messages based on the GHL response
      if (errorMsg.includes('401') || errorMsg.includes('Invalid JWT')) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your credentials.' },
          { status: 400 }
        );
      } else if (errorMsg.includes('403') || errorMsg.includes('does not have access')) {
        return NextResponse.json(
          { error: `This API key does not have access to location: ${locationId}` },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'Could not connect to GoHighLevel. Please try again.' },
          { status: 400 }
        );
      }
    }

    // Store the valid API key
    const location = await Location.findOneAndUpdate(
      { locationId },
      { apiKey },
      { returnDocument: 'after', upsert: true }
    );

    return NextResponse.json({
      success: true,
      location: {
        locationId: location.locationId,
        name: location.name,
        hasApiKey: true,
      },
    });
  } catch (error) {
    console.error('Error storing API key:', error);
    return NextResponse.json(
      { error: 'Failed to store API key', details: String(error) },
      { status: 500 }
    );
  }
}
