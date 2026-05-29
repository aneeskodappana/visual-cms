import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface FloorplanUnit {
  csvFile: string;
  backplateFile: string;
  thumbnailFile: string;
  code: string;
  title: string;
}

interface GenerateRequest {
  units: FloorplanUnit[];
  csvFolderPath: string;
  backplateSubfolder: string;
  cdnBaseUrl: string;
  backplateWidth: number;
  backplateHeight: number;
  backplateVersion: number;
  thumbnailVersion: number;
}

function parseCSV(content: string): { name: string; posY: number; posX: number }[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(',');
      return {
        name: parts[0]?.trim().replace(/\uFEFF/g, '') || '',
        posY: parseFloat(parts[1]) || 0,
        posX: parseFloat(parts[2]) || 0,
      };
    })
    .filter((r) => r.name && r.posX > 0 && r.posY > 0);
}

function escapeSQL(val: string): string {
  return val.replace(/'/g, "''");
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const {
      units,
      csvFolderPath,
      backplateSubfolder,
      cdnBaseUrl,
      backplateWidth = 4096,
      backplateHeight = 4096,
      backplateVersion = 2,
      thumbnailVersion = 7,
    } = body;

    if (!units || units.length === 0) {
      return NextResponse.json(
        { status: 'error', error: 'No units provided' },
        { status: 400 },
      );
    }

    const transformSettings = JSON.stringify({
      Disabled: false,
      MinScale: 1.0,
      MaxScale: 2.5,
      Wheel: { Disabled: false, WheelDisabled: false, TouchPadDisabled: false, Step: 0.2, SmoothStep: 0.001 },
      Pan: { Disabled: false, VelocityDisabled: false, LockAxisX: false, LockAxisY: false },
      Pinch: { Disabled: false, Step: 5.0 },
      DoubleClick: { Disabled: false, Step: 0.7, Mode: 'zoomIn', AnimationTime: 200.0, AnimationType: 'easeOut' },
      UI: { HideZoomControls: false },
    });

    const viewConfigRows: string[] = [];
    const layout2DRows: string[] = [];
    const markerRows: string[] = [];
    const errors: string[] = [];
    let processedCount = 0;

    for (const unit of units) {
      try {
        const csvContent = await fs.readFile(path.join(csvFolderPath, unit.csvFile), 'utf-8');
        const rooms = parseCSV(csvContent);

        const viewConfigId = uuidv4();
        const layout2DId = uuidv4();

        const backplateUrl = `${backplateSubfolder}/${unit.backplateFile}`;
        const thumbnailUrl = unit.thumbnailFile
          ? `${backplateSubfolder}/${unit.thumbnailFile}`
          : '';

        viewConfigRows.push(
          `  ('${viewConfigId}', 7, '${escapeSQL(unit.code)}', '${escapeSQL(unit.title || unit.code)}', '', FALSE, '${escapeSQL(cdnBaseUrl)}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
        );

        layout2DRows.push(
          `  ('${layout2DId}', FALSE, '', 0, '${escapeSQL(transformSettings)}', '${escapeSQL(transformSettings)}', '${escapeSQL(backplateUrl)}', ${backplateVersion}, ${backplateWidth}, ${backplateHeight}, FALSE, FALSE, FALSE, 0, '', '${escapeSQL(thumbnailUrl)}', ${thumbnailVersion}, 256, 256, FALSE, '{"Connections":[]}', -1, '${viewConfigId}')`,
        );

        rooms.forEach((room, idx) => {
          const markerId = uuidv4();
          markerRows.push(
            `  ('${markerId}', 9, NULL, ${idx}, '${idx}', TRUE, FALSE, '', FALSE, ${room.posY}, ${room.posX}, FALSE, '', '', 100, 0, 2.5, 100, 0, 2.5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, TRUE, '/pins/floorplan-waypoint-current.png', NULL, 24, 24, 100, '${escapeSQL(room.name)}', TRUE, '/pins/floorplan-waypoint-default.png', NULL, 24, 24, NULL, NULL, NULL, '${layout2DId}')`,
          );
        });

        processedCount++;
      } catch (e) {
        errors.push(`${unit.code}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    let sql = `-- Floorplan SQL for ${processedCount} units\n-- Generated at: ${new Date().toISOString()}\n\nBEGIN;\n\n`;

    if (viewConfigRows.length > 0) {
      sql += `-- ViewConfigs\nINSERT INTO "ViewConfigs" ("Id", "Kind", "Code", "Title", "Subtitle", "HasGallery", "CdnBaseUrl", "NationId", "CityId", "ProjectId", "ClusterId", "AmenityId", "UnitId", "UnitVariantExteriorId", "UnitVariantFloorId", "UnitVariantInteriorId", "ParkingFloorplanId", "ParkingUpgradeId", "ParkingUpgradeGalleryId")\nVALUES\n${viewConfigRows.join(',\n')};\n\n`;
    }

    if (layout2DRows.length > 0) {
      sql += `-- Layout2Ds\nINSERT INTO "Layout2Ds" ("Id", "IsDefault", "DisplayName", "DisplayOrder", "DesktopTransformSettingsJson", "MobileTransformSettingsJson", "BackplateUrl", "BackplateVersion", "BackplateWidth", "BackplateHeight", "VideoLoopEnabled", "VideoAutoplay", "ShowVideoControls", "BackplateFormat", "NorthBearing", "BackplateThumbnailUrl", "BackplateThumbnailVersion", "BackplateThumbnailWidth", "BackplateThumbnailHeight", "HasCallbackWindow", "MarkerConnectionSettings", "FocusedMarkerId", "ViewConfigId")\nVALUES\n${layout2DRows.join(',\n')};\n\n`;
    }

    if (markerRows.length > 0) {
      sql += `-- Markers\nINSERT INTO "Markers" ("Id", "Kind", "SubType", "MarkerIndex", "Code", "IsVisible", "IsExplorable", "NavigateTo", "IsShallowLink", "PositionTop", "PositionLeft", "KeepScale", "LngLatJson", "ConnectionLineJson", "Scale", "MinZoom", "MaxZoom", "MobileScale", "MobileMinZoom", "MobileMaxZoom", "LinkToMarkerIndex", "AnchorPositionTop", "AnchorPositionLeft", "HoverTitle", "HoverTitleVisible", "HoverIconUrl", "HoverIconVersion", "HoverIconWidth", "HoverIconHeight", "HoverScale", "SelectedTitle", "SelectedTitleVisible", "SelectedIconUrl", "SelectedIconVersion", "SelectedIconWidth", "SelectedIconHeight", "SelectedScale", "Title", "TitleVisible", "IconUrl", "IconVersion", "IconWidth", "IconHeight", "Version", "IsPriority", "Logo", "Layout2DId")\nVALUES\n${markerRows.join(',\n')};\n\n`;
    }

    sql += 'COMMIT;\n';

    return NextResponse.json({
      status: 'success',
      data: {
        sql,
        processedCount,
        totalMarkers: markerRows.length,
        errors,
      },
    });
  } catch (error) {
    console.error('Error generating floorplan SQL:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
