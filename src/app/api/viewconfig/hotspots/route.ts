import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hotspots } = body;

    if (!hotspots || !Array.isArray(hotspots) || hotspots.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of hotspots to create' },
        { status: 400 }
      );
    }

    const results = [];
    for (const h of hotspots) {
      const {
        hotspotIndex,
        isVisible = true,
        isExplorable = true,
        name = '',
        mediaUrl = '',
        mediaVersion = 1,
        mediaThumbnailUrl = '',
        mediaThumbnailVersion = 1,
        positionJson = '',
        offsetRotationJson = '',
        defaultCameraRotationJson = '',
        cameraSettingsJson = { version: 1, default: { fov: 90 } },
        hotspotGroupId,
      } = h;

      if (!hotspotGroupId || hotspotIndex === undefined) {
        return NextResponse.json(
          { error: 'Each hotspot must have hotspotGroupId and hotspotIndex' },
          { status: 400 }
        );
      }

      const result = await prisma.$queryRaw`
        INSERT INTO "Hotspots" (
          "Id", "HotspotIndex", "IsVisible", "IsExplorable", "Name",
          "MediaUrl", "MediaVersion", "MediaThumbnailUrl", "MediaThumbnailVersion",
          "PositionJson", "OffsetRotationJson", "DefaultCameraRotationJson",
          "CameraSettingsJson", "HotspotGroupId"
        ) VALUES (
          gen_random_uuid(), ${hotspotIndex}::int, ${isVisible}::bool, ${isExplorable}::bool, ${name},
          ${mediaUrl}, ${mediaVersion}::int, ${mediaThumbnailUrl}, ${mediaThumbnailVersion}::int,
          ${positionJson}, ${offsetRotationJson}, ${defaultCameraRotationJson},
          ${JSON.stringify(cameraSettingsJson)}::jsonb, ${hotspotGroupId}::uuid
        )
        RETURNING "Id"
      `;
      results.push({ ...(result as any[])[0], name });
    }

    return NextResponse.json({
      status: 'success',
      created: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Hotspot create error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of hotspot ids to delete' },
        { status: 400 }
      );
    }

    for (const id of ids) {
      await prisma.$executeRaw`
        DELETE FROM "Hotspots"
        WHERE "Id" = ${id}::uuid
      `;
    }

    return NextResponse.json({
      status: 'success',
      deleted: ids.length,
    });
  } catch (error: any) {
    console.error('Hotspot delete error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of updates with id and at least one editable hotspot field' },
        { status: 400 }
      );
    }

    const results = [];
    for (const update of updates) {
      const { id, positionJson, offsetRotationJson, defaultCameraRotationJson, name } = update;
      const hasEditableField = (
        positionJson !== undefined ||
        offsetRotationJson !== undefined ||
        defaultCameraRotationJson !== undefined ||
        name !== undefined
      );

      if (!id || !hasEditableField) {
        return NextResponse.json(
          { error: 'Each update must have id and at least one editable hotspot field' },
          { status: 400 }
        );
      }

      await prisma.$executeRaw`
        UPDATE "Hotspots"
        SET
          "PositionJson" = COALESCE(${positionJson ?? null}, "PositionJson"),
          "OffsetRotationJson" = COALESCE(${offsetRotationJson ?? null}, "OffsetRotationJson"),
          "DefaultCameraRotationJson" = COALESCE(${defaultCameraRotationJson ?? null}, "DefaultCameraRotationJson"),
          "Name" = COALESCE(${name ?? null}, "Name")
        WHERE "Id" = ${id}::uuid
      `;

      results.push({
        id,
        ...(positionJson !== undefined && { positionJson }),
        ...(offsetRotationJson !== undefined && { offsetRotationJson }),
        ...(defaultCameraRotationJson !== undefined && { defaultCameraRotationJson }),
        ...(name !== undefined && { name }),
      });
    }

    return NextResponse.json({
      status: 'success',
      updated: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Hotspot update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
