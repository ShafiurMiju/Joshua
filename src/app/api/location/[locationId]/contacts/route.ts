import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import { GHLClient } from '@/lib/ghl';

// GET /api/location/[locationId]/contacts - Fetch contacts from GHL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';

    const location = await Location.findOne({ locationId });
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);
    
    // Fetch contacts with optional search query
    const contacts = await client.getContacts(locationId, query);

    return NextResponse.json({
      contacts: contacts.contacts || [],
      total: contacts.total || 0,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: String(error) },
      { status: 500 }
    );
  }
}
