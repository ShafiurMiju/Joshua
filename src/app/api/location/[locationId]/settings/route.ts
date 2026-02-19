import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';

// GET /api/location/[locationId]/settings - Get location settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;

    const location = await Location.findOne({ locationId });
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      paginationEnabled: location.paginationEnabled ?? false,
      pageSize: location.pageSize ?? 100,
      paginationPerStage: location.paginationPerStage ?? false,
      sortField: location.sortField ?? null,
      sortOrder: location.sortOrder ?? 'desc',
      cardFieldSettings: location.cardFieldSettings ?? {
        layout: 'default',
        visibleFields: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'],
        fieldOrder: ['smartTags', 'opportunityName', 'businessName', 'contact', 'pipeline', 'stage', 'status'],
      },
      quickActions: location.quickActions ?? {
        visibleActions: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes'],
        actionOrder: ['call', 'sms', 'email', 'appointment', 'tasks', 'notes'],
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/location/[locationId]/settings - Update location settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const body = await request.json();
    
    const updateData: any = {};
    if (body.paginationEnabled !== undefined) updateData.paginationEnabled = body.paginationEnabled;
    if (body.pageSize !== undefined) updateData.pageSize = body.pageSize;
    if (body.paginationPerStage !== undefined) updateData.paginationPerStage = body.paginationPerStage;
    if (body.sortField !== undefined) updateData.sortField = body.sortField;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.cardFieldSettings !== undefined) updateData.cardFieldSettings = body.cardFieldSettings;
    if (body.quickActions !== undefined) updateData.quickActions = body.quickActions;

    const location = await Location.findOneAndUpdate(
      { locationId },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );

    return NextResponse.json({
      success: true,
      paginationEnabled: location.paginationEnabled,
      pageSize: location.pageSize,
      paginationPerStage: location.paginationPerStage,
      sortField: location.sortField,
      sortOrder: location.sortOrder,
      cardFieldSettings: location.cardFieldSettings,
      quickActions: location.quickActions,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
