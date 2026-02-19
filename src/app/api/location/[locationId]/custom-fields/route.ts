import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Location from '@/lib/models/Location';
import CustomField from '@/lib/models/CustomField';
import { GHLClient } from '@/lib/ghl';

// GET /api/location/[locationId]/custom-fields?model=opportunity
// Fetches custom field definitions from GHL, resolves folder details,
// caches everything in DB, and returns fields + folders for the sidebar.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    await connectDB();
    const { locationId } = await params;
    const model = (request.nextUrl.searchParams.get('model') || 'opportunity') as 'opportunity' | 'contact';
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

    // ── Check DB cache first (unless forced refresh) ──────────────────
    if (!forceRefresh) {
      const cached = await CustomField.find({ locationId, fieldModel: model }).sort({ position: 1 }).lean();
      // Only use cache if it has folder entries already resolved
      const hasFolders = cached.some((c) => (c as Record<string, unknown>).isFolder);
      const hasFields = cached.some((c) => !(c as Record<string, unknown>).isFolder);
      if (hasFields && (hasFolders || cached.every((c) => !(c as Record<string, unknown>).parentId))) {
        return NextResponse.json(buildResponse(cached));
      }
    }

    // ── Fetch from GHL API ────────────────────────────────────────────
    const location = await Location.findOne({ locationId });
    if (!location?.apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 401 }
      );
    }

    const client = new GHLClient(location.apiKey, locationId);
    const { customFields } = await client.getCustomFields(model);

    // ── Resolve folders by fetching each unique parentId ──────────────
    // The V1 list endpoint does NOT include folder entries—only actual fields.
    // We need to fetch each unique parentId individually to get folder details.
    const uniqueParentIds = [
      ...new Set(customFields.map((cf) => cf.parentId).filter(Boolean) as string[]),
    ];

    const folderMap = new Map<string, { id: string; name: string; position: number; standard: boolean }>();

    // Fetch folder details in parallel
    const folderFetches = uniqueParentIds.map(async (parentId) => {
      try {
        const { customField: folder } = await client.getCustomField(parentId);
        if (folder && folder.documentType === 'folder') {
          folderMap.set(parentId, {
            id: folder.id,
            name: folder.name,
            position: folder.position ?? 0,
            standard: folder.standard ?? false,
          });
        }
      } catch (err) {
        console.warn(`[custom-fields] Could not fetch folder ${parentId}:`, err);
      }
    });

    await Promise.all(folderFetches);

    // ── Persist fields + folders to DB via bulkWrite ──────────────────
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bulkOps: any[] = [];

    // Upsert each field
    for (const cf of customFields) {
      const parentFolder = cf.parentId ? folderMap.get(cf.parentId) : undefined;
      bulkOps.push({
        updateOne: {
          filter: { ghlId: cf.id, locationId },
          update: {
            $set: {
              ghlId: cf.id,
              locationId,
              name: cf.name,
              fieldKey: cf.fieldKey || '',
              dataType: cf.dataType || '',
              placeholder: cf.placeholder || '',
              position: cf.position ?? 0,
              picklistOptions: cf.picklistOptions || [],
              picklistImageOptions: cf.picklistImageOptions || [],
              allowCustomOption: cf.allowCustomOption || false,
              isMultiFileAllowed: cf.isMultiFileAllowed || false,
              maxFileLimit: cf.maxFileLimit || 0,
              isRequired: cf.isRequired || false,
              fieldModel: model,
              parentId: cf.parentId || '',
              parentName: parentFolder?.name || '',
              isFolder: false,
              syncedAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    // Upsert each resolved folder
    for (const [, folder] of folderMap) {
      bulkOps.push({
        updateOne: {
          filter: { ghlId: folder.id, locationId },
          update: {
            $set: {
              ghlId: folder.id,
              locationId,
              name: folder.name,
              fieldKey: '',
              dataType: 'FOLDER',
              placeholder: '',
              position: folder.position,
              picklistOptions: [],
              picklistImageOptions: [],
              allowCustomOption: false,
              isMultiFileAllowed: false,
              maxFileLimit: 0,
              isRequired: false,
              fieldModel: model,
              parentId: '',
              parentName: '',
              isFolder: true,
              syncedAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await CustomField.bulkWrite(bulkOps, { ordered: false });
    }

    // Remove custom fields/folders that no longer exist in GHL
    const allGhlIds = [
      ...customFields.map((cf) => cf.id),
      ...Array.from(folderMap.keys()),
    ];
    await CustomField.deleteMany({ locationId, fieldModel: model, ghlId: { $nin: allGhlIds } });

    // ── Return fresh data ─────────────────────────────────────────────
    const persisted = await CustomField.find({ locationId, fieldModel: model }).sort({ position: 1 }).lean();
    return NextResponse.json(buildResponse(persisted));
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom fields', details: String(error) },
      { status: 500 }
    );
  }
}

// ── Helper: shape the response with folder grouping ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildResponse(fields: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const folders: Array<{ id: string; name: string; position: number; standard?: boolean }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customFields: any[] = [];

  for (const f of fields) {
    if (f.isFolder) {
      folders.push({ id: f.ghlId, name: f.name, position: f.position });
    } else {
      customFields.push({
        id: f.ghlId,
        name: f.name,
        fieldKey: f.fieldKey,
        dataType: f.dataType,
        placeholder: f.placeholder,
        position: f.position,
        picklistOptions: f.picklistOptions,
        picklistImageOptions: f.picklistImageOptions,
        allowCustomOption: f.allowCustomOption,
        isMultiFileAllowed: f.isMultiFileAllowed,
        maxFileLimit: f.maxFileLimit,
        isRequired: f.isRequired,
        model: f.fieldModel,
        parentId: f.parentId || '',
        parentName: f.parentName || '',
      });
    }
  }

  return { customFields, folders };
}
