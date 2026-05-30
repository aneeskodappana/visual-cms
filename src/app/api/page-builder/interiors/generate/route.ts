import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const HOTSPOT_NAMES: Record<string, string> = {
  balcony: 'Balcony', bathroom: 'Bathroom', bathroom1: 'Bathroom 1', bathroom2: 'Bathroom 2',
  bathroom3: 'Bathroom 3', bedroom: 'Bedroom', bedroom1: 'Bedroom 1', bedroom2: 'Bedroom 2',
  bedroom3: 'Bedroom 3', bedroom4: 'Bedroom 4', corridor: 'Corridor', dining: 'Dining',
  diningroom: 'Dining Room', entrance: 'Entrance', foyer: 'Foyer', hall: 'Hall',
  hallway: 'Hallway', kitchen: 'Kitchen', laundry: 'Laundry', living: 'Living',
  livingroom: 'Living Room', livingdining: 'Living Dining', maidsbathroom: 'Maids Bathroom',
  maidsroom: 'Maids Room', masterbathroom: 'Master Bathroom', masterbedroom: 'Master Bedroom',
  powderroom: 'Powder Room', stairs: 'Stairs', study: 'Study', utility: 'Utility',
  wardrobe: 'Wardrobe', walkincloset: 'Walk In Closet', terrace: 'Terrace',
  familyroom: 'Family Room', guestbedroom: 'Guest Bedroom', prepkitchen: 'Prep Kitchen',
  showkitchen: 'Show Kitchen', lobby: 'Lobby', balcony1: 'Balcony 1', balcony2: 'Balcony 2',
};

const SKIPPABLE = ['balcony'];
const DEFAULT_SEARCH_ORDER_GROUND = ['foyer', 'entrance', 'hall'];
const DEFAULT_SEARCH_ORDER_UPPER = ['foyer', 'hall', 'livingroom', 'masterbedroom'];

interface InteriorUnit {
  code: string;
  unitId: string;
  mirror: string;
  hotspotFolder: string;
  hotspotImages: string[];
  collisionFile: string;
  csvCameraFile: string;
  schemeFilter: string;
  tower: string;
  floor: string;
  unitNumber: string;
  floorPart: string;
}

function escapeSQL(val: string): string {
  return val.replace(/'/g, "''");
}

function parseCSVCamera(content: string): Record<string, number[]> {
  const rows: Record<string, number[]> = {};
  content.split('\n').filter((l) => l.trim()).forEach((line) => {
    const parts = line.split(',');
    const key = parts[0]?.trim();
    if (key) {
      rows[key] = parts.slice(1).map((v) => parseFloat(v) || 0);
    }
  });
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      units,
      hotspotBasePath,
      csvCameraBasePath,
      cdnBaseUrl,
      hotspotSubfolder,
      collisionSubfolder,
      mediaVersion = 17,
      skipBalcony = true,
      balconyException = '',
    }: {
      units: InteriorUnit[];
      hotspotBasePath: string;
      csvCameraBasePath: string;
      cdnBaseUrl: string;
      hotspotSubfolder: string;
      collisionSubfolder: string;
      mediaVersion: number;
      skipBalcony: boolean;
      balconyException: string;
    } = body;

    const shouldSkipRoom = (roomKey: string, tower: string): boolean => {
      if (!skipBalcony) return false;
      const isBalcony = roomKey.toLowerCase().includes('balcony');
      if (!isBalcony) return false;
      if (balconyException && tower.toLowerCase() === balconyException.toLowerCase()) return false;
      return true;
    };

    if (!units || units.length === 0) {
      return NextResponse.json({ status: 'error', error: 'No units provided' }, { status: 400 });
    }

    const viewConfigRows: string[] = [];
    const layout3DRows: string[] = [];
    const hotspotGroupRows: string[] = [];
    const hotspotRows: string[] = [];
    const errors: string[] = [];
    let processedCount = 0;

    for (const unit of units) {
      try {
        // Parse CSV camera file
        let csvData: Record<string, number[]> = {};
        try {
          const csvContent = await fs.readFile(path.join(csvCameraBasePath, unit.csvCameraFile), 'utf-8');
          csvData = parseCSVCamera(csvContent);
        } catch {
          errors.push(`${unit.code}: CSV camera file not found: ${unit.csvCameraFile}`);
        }

        // Group hotspot images by room name
        const hotspotsByRoom: Record<string, string[]> = {};
        const schemeFilter = unit.schemeFilter;
        unit.hotspotImages.forEach((img) => {
          if (!img.includes(schemeFilter)) return;
          const roomKey = img.split('_').at(-2)?.toLowerCase() || '';
          if (!roomKey) return;
          if (!hotspotsByRoom[roomKey]) hotspotsByRoom[roomKey] = [];
          hotspotsByRoom[roomKey].push(img);
        });

        const roomKeys = Object.keys(hotspotsByRoom).sort();
        if (roomKeys.length === 0) {
          errors.push(`${unit.code}: No hotspot images found matching scheme ${schemeFilter}`);
          continue;
        }

        const isMirrored = unit.mirror === 'MIRROR';
        const modelScale = isMirrored ? '{"X":-10.0,"Y":10.0,"Z":10.0}' : '{"X":10.0,"Y":10.0,"Z":10.0}';

        // Find default group index
        const searchOrder = unit.floorPart === '0' ? DEFAULT_SEARCH_ORDER_GROUND : DEFAULT_SEARCH_ORDER_UPPER;
        let defaultGroupIdx = 0;
        for (const key of searchOrder) {
          const idx = roomKeys.findIndex((k) => k.toLowerCase() === key);
          if (idx > -1) { defaultGroupIdx = idx; break; }
        }

        const viewConfigId = uuidv4();
        const layout3DId = uuidv4();

        // ViewConfig (Kind=8 = Interior)
        const unitIdVal = unit.unitId ? `'${unit.unitId}'` : 'NULL';
        viewConfigRows.push(
          `  ('${viewConfigId}', 8, '${escapeSQL(unit.code)}', '${escapeSQL(unit.code)}', '', FALSE, '${escapeSQL(cdnBaseUrl)}', NULL, NULL, NULL, NULL, NULL, ${unitIdVal}, NULL, NULL, NULL, NULL, NULL, NULL)`,
        );

        // Layout3D
        layout3DRows.push(
          `  ('${layout3DId}', '${escapeSQL(collisionSubfolder + '/' + unit.collisionFile)}', ${defaultGroupIdx}, '${escapeSQL(modelScale)}', '${viewConfigId}')`,
        );

        // HotspotGroups + Hotspots
        let hotspotIndex = 0;
        roomKeys.forEach((roomKey, groupIdx) => {
          if (shouldSkipRoom(roomKey, unit.tower)) return;

          const groupId = uuidv4();
          const groupName = HOTSPOT_NAMES[roomKey] || roomKey.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
          const images = hotspotsByRoom[roomKey];

          const firstHotspotIndex = hotspotIndex + 1;

          images.forEach((img) => {
            hotspotIndex++;
            const hotspotId = uuidv4();
            const identifier = img.split('_').slice(-3).join('_').split('.')[0];

            // Look up position/rotation from CSV
            const csvKey = identifier;
            const csvKeyAlt = identifier.replace('_0', '');
            const row = csvData[csvKey] || csvData[csvKeyAlt];

            let positionJson = '""';
            let rotationJson = '""';

            if (row && row.length >= 6) {
              const mirrorMult = isMirrored ? -0.01 : 0.01;
              positionJson = `'${JSON.stringify({ X: row[0] * mirrorMult, Y: row[2] * 0.01, Z: row[1] * -0.01 })}'`;

              const isLateral = row[5] !== 180 && row[5] !== 0;
              const lrOffset = isMirrored && isLateral ? 180 : 0;
              const fbOffset = !isLateral ? 180 : 0;
              const yRot = row[5] + lrOffset + fbOffset;
              rotationJson = `'{"X": ${row[3]},"Y": ${yRot},"Z": ${row[4]},"W": 1.0}'`;
            } else {
              errors.push(`${unit.code}: No CSV match for hotspot ${identifier}`);
            }

            const mediaUrl = `${hotspotSubfolder}/${unit.hotspotFolder}/${img}`;

            hotspotRows.push(
              `  ('${hotspotId}', ${hotspotIndex}, TRUE, TRUE, '${escapeSQL(groupName)}', '${escapeSQL(mediaUrl)}', ${mediaVersion}, '', 8, ${positionJson}, ${rotationJson}, ${rotationJson}, '{"default":{"fov":90},"version":1}', '${groupId}')`,
            );
          });

          hotspotGroupRows.push(
            `  ('${groupId}', '${escapeSQL(groupName)}', ${groupIdx}, ${firstHotspotIndex}, TRUE, TRUE, '${layout3DId}')`,
          );
        });

        processedCount++;
      } catch (e) {
        errors.push(`${unit.code}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    let sql = `-- Interior SQL for ${processedCount} units\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n`;

    if (viewConfigRows.length > 0) {
      sql += `-- ViewConfigs\nINSERT INTO "ViewConfigs" ("Id", "Kind", "Code", "Title", "Subtitle", "HasGallery", "CdnBaseUrl", "NationId", "CityId", "ProjectId", "ClusterId", "AmenityId", "UnitId", "UnitVariantExteriorId", "UnitVariantFloorId", "UnitVariantInteriorId", "ParkingFloorplanId", "ParkingUpgradeId", "ParkingUpgradeGalleryId")\nVALUES\n${viewConfigRows.join(',\n')};\n\n`;
    }

    if (layout3DRows.length > 0) {
      sql += `-- Layout3Ds\nINSERT INTO "Layout3Ds" ("Id", "ModelUrl", "DefaultHotspotGroupIndex", "ModelScaleJson", "ViewConfigId")\nVALUES\n${layout3DRows.join(',\n')};\n\n`;
    }

    if (hotspotGroupRows.length > 0) {
      sql += `-- HotspotGroups\nINSERT INTO "HotspotGroups" ("Id", "Name", "HotspotGroupIndex", "DefaultHotspotIndex", "IsVisible", "IsExplorable", "Layout3DId")\nVALUES\n${hotspotGroupRows.join(',\n')};\n\n`;
    }

    if (hotspotRows.length > 0) {
      sql += `-- Hotspots\nINSERT INTO "Hotspots" ("Id", "HotspotIndex", "IsVisible", "IsExplorable", "Name", "MediaUrl", "MediaVersion", "MediaThumbnailUrl", "MediaThumbnailVersion", "PositionJson", "OffsetRotationJson", "DefaultCameraRotationJson", "CameraSettingsJson", "HotspotGroupId")\nVALUES\n${hotspotRows.join(',\n')};\n\n`;
    }

    sql += 'COMMIT;\n';

    return NextResponse.json({
      status: 'success',
      data: {
        sql,
        processedCount,
        totalGroups: hotspotGroupRows.length,
        totalHotspots: hotspotRows.length,
        errors,
      },
    });
  } catch (error) {
    console.error('Error generating interior SQL:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
