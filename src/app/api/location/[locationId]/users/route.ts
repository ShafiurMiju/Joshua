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
    if (!location?.apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 401 });
    }

    const client = new GHLClient(location.apiKey, locationId);
    const data = await client.getLocationUsers();

    const users = (data.users || []).map((u) => ({
      id: u.id,
      name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
      email: u.email || '',
      phone: u.phone || '',
      profilePhoto: u.profilePhoto || '',
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: String(error) },
      { status: 500 }
    );
  }
}
