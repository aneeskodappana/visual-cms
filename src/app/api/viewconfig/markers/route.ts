import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const layout2dId = searchParams.get('layout2dId');

    if (!layout2dId) {
      return NextResponse.json(
        { error: 'Provide layout2dId parameter' },
        { status: 400 }
      );
    }

    // Use raw SQL to fetch markers and handle NaN values
    const markers = await prisma.$queryRaw`
      SELECT 
        "Id",
        "Kind",
        "SubType",
        "MarkerIndex",
        "Code",
        "IsVisible",
        "IsExplorable",
        "NavigateTo",
        "IsShallowLink",
        CASE WHEN "PositionTop" != 'NaN'::float8 THEN "PositionTop" ELSE NULL END as "PositionTop",
        CASE WHEN "PositionLeft" != 'NaN'::float8 THEN "PositionLeft" ELSE NULL END as "PositionLeft",
        "KeepScale",
        "LngLatJson",
        "ConnectionLineJson",
        CASE WHEN "Scale" != 'NaN'::float8 THEN "Scale" ELSE 100 END as "Scale",
        CASE WHEN "MinZoom" != 'NaN'::float8 THEN "MinZoom" ELSE 0.0 END as "MinZoom",
        CASE WHEN "MaxZoom" != 'NaN'::float8 THEN "MaxZoom" ELSE 2.5 END as "MaxZoom",
        CASE WHEN "MobileScale" != 'NaN'::float8 THEN "MobileScale" ELSE 100 END as "MobileScale",
        CASE WHEN "MobileMinZoom" != 'NaN'::float8 THEN "MobileMinZoom" ELSE 0.0 END as "MobileMinZoom",
        CASE WHEN "MobileMaxZoom" != 'NaN'::float8 THEN "MobileMaxZoom" ELSE 2.5 END as "MobileMaxZoom",
        "LinkToMarkerIndex",
        CASE WHEN "AnchorPositionTop" != 'NaN'::float8 THEN "AnchorPositionTop" ELSE NULL END as "AnchorPositionTop",
        CASE WHEN "AnchorPositionLeft" != 'NaN'::float8 THEN "AnchorPositionLeft" ELSE NULL END as "AnchorPositionLeft",
        "HoverTitle",
        "HoverTitleVisible",
        "HoverIconUrl",
        "HoverIconVersion",
        CASE WHEN "HoverIconWidth" != 'NaN'::float8 THEN "HoverIconWidth" ELSE NULL END as "HoverIconWidth",
        CASE WHEN "HoverIconHeight" != 'NaN'::float8 THEN "HoverIconHeight" ELSE NULL END as "HoverIconHeight",
        CASE WHEN "HoverScale" != 'NaN'::float8 THEN "HoverScale" ELSE NULL END as "HoverScale",
        "SelectedTitle",
        "SelectedTitleVisible",
        "SelectedIconUrl",
        "SelectedIconVersion",
        CASE WHEN "SelectedIconWidth" != 'NaN'::float8 THEN "SelectedIconWidth" ELSE NULL END as "SelectedIconWidth",
        CASE WHEN "SelectedIconHeight" != 'NaN'::float8 THEN "SelectedIconHeight" ELSE NULL END as "SelectedIconHeight",
        CASE WHEN "SelectedScale" != 'NaN'::float8 THEN "SelectedScale" ELSE NULL END as "SelectedScale",
        "Title",
        "TitleVisible",
        "IconUrl",
        "IconVersion",
        CASE WHEN "IconWidth" != 'NaN'::float8 THEN "IconWidth" ELSE NULL END as "IconWidth",
        CASE WHEN "IconHeight" != 'NaN'::float8 THEN "IconHeight" ELSE NULL END as "IconHeight",
        "Version",
        "IsPriority",
        "Logo",
        "Layout2DId"
      FROM "Markers"
      WHERE "Layout2DId" = ${layout2dId}::uuid
      ORDER BY "MarkerIndex"
    `;

    return NextResponse.json({
      status: 'success',
      count: (markers as any[]).length,
      data: markers,
    });
  } catch (error: any) {
    console.error('Markers fetch error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newId, sourceMarkerId, offsetTop = 20, offsetLeft = 20, title: titleOverride, iconUrl: iconUrlOverride } = body;

    if (!sourceMarkerId) {
      return NextResponse.json(
        { error: 'Provide sourceMarkerId' },
        { status: 400 }
      );
    }

    const source = await prisma.marker.findUnique({ where: { Id: sourceMarkerId } });
    if (!source) {
      return NextResponse.json({ error: 'Source marker not found' }, { status: 404 });
    }

    const maxIndex: any[] = await prisma.$queryRaw`
      SELECT COALESCE(MAX("MarkerIndex"), -1) + 1 as "nextIndex"
      FROM "Markers"
      WHERE "Layout2DId" = ${source.Layout2DId}::uuid
    `;
    const nextIndex = Number(maxIndex[0]?.nextIndex ?? 0);

    const safeFloat = (v: any) => (v != null && !isNaN(v) ? v : null);

    const newMarker = await prisma.marker.create({
      data: {
        ...(newId ? { Id: newId } : {}),
        Kind: source.Kind,
        SubType: source.SubType,
        MarkerIndex: nextIndex,
        Code: source.Code,
        IsVisible: source.IsVisible,
        IsExplorable: source.IsExplorable,
        NavigateTo: source.NavigateTo,
        IsShallowLink: source.IsShallowLink,
        PositionTop: source.PositionTop + offsetTop,
        PositionLeft: source.PositionLeft + offsetLeft,
        KeepScale: source.KeepScale,
        LngLatJson: source.LngLatJson,
        ConnectionLineJson: source.ConnectionLineJson,
        Scale: safeFloat(source.Scale),
        MinZoom: safeFloat(source.MinZoom),
        MaxZoom: safeFloat(source.MaxZoom),
        MobileScale: safeFloat(source.MobileScale),
        MobileMinZoom: safeFloat(source.MobileMinZoom),
        MobileMaxZoom: safeFloat(source.MobileMaxZoom),
        LinkToMarkerIndex: source.LinkToMarkerIndex,
        AnchorPositionTop: safeFloat(source.AnchorPositionTop),
        AnchorPositionLeft: safeFloat(source.AnchorPositionLeft),
        HoverTitle: source.HoverTitle,
        HoverTitleVisible: source.HoverTitleVisible,
        HoverIconUrl: source.HoverIconUrl,
        HoverIconVersion: source.HoverIconVersion,
        HoverIconWidth: safeFloat(source.HoverIconWidth),
        HoverIconHeight: safeFloat(source.HoverIconHeight),
        HoverScale: safeFloat(source.HoverScale),
        SelectedTitle: source.SelectedTitle,
        SelectedTitleVisible: source.SelectedTitleVisible,
        SelectedIconUrl: source.SelectedIconUrl,
        SelectedIconVersion: source.SelectedIconVersion,
        SelectedIconWidth: safeFloat(source.SelectedIconWidth),
        SelectedIconHeight: safeFloat(source.SelectedIconHeight),
        SelectedScale: safeFloat(source.SelectedScale),
        Title: titleOverride !== undefined ? titleOverride : (source.Title ? `${source.Title} (copy)` : ''),
        TitleVisible: source.TitleVisible,
        IconUrl: iconUrlOverride !== undefined ? (iconUrlOverride || null) : source.IconUrl,
        IconVersion: source.IconVersion,
        IconWidth: safeFloat(source.IconWidth),
        IconHeight: safeFloat(source.IconHeight),
        Version: source.Version,
        IsPriority: source.IsPriority,
        Logo: source.Logo,
        Layout2DId: source.Layout2DId,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: newMarker,
    });
  } catch (error: any) {
    console.error('Marker replicate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, iconUrl } = body;

    if (!id) {
      return NextResponse.json({ error: 'Provide marker id' }, { status: 400 });
    }

    const setClauses: string[] = [];
    if (title !== undefined) setClauses.push(`"Title" = '${title.replace(/'/g, "''")}'`);
    if (iconUrl !== undefined) {
      setClauses.push(iconUrl ? `"IconUrl" = '${iconUrl.replace(/'/g, "''")}'` : `"IconUrl" = NULL`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Provide at least one field to update (title, iconUrl)' }, { status: 400 });
    }

    const sql = `UPDATE "Markers" SET ${setClauses.join(', ')} WHERE "Id" = '${id}'::uuid`;
    await prisma.$executeRawUnsafe(sql);

    const updated = await prisma.marker.findUnique({ where: { Id: id } });

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error('Marker patch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Provide marker id' }, { status: 400 });
    }

    const existing = await prisma.marker.findUnique({ where: { Id: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Marker not found' }, { status: 404 });
    }

    await prisma.marker.delete({ where: { Id: id } });

    return NextResponse.json({ status: 'success', deletedId: id });
  } catch (error: any) {
    console.error('Marker delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of updates with id, positionTop, positionLeft' },
        { status: 400 }
      );
    }

    const results = [];
    for (const update of updates) {
      const { id, positionTop, positionLeft } = update;
      if (!id || positionTop === undefined || positionLeft === undefined) {
        return NextResponse.json(
          { error: `Invalid update entry: each must have id, positionTop, positionLeft` },
          { status: 400 }
        );
      }

      await prisma.$executeRaw`
        UPDATE "Markers"
        SET "PositionTop" = ${positionTop}::float8,
            "PositionLeft" = ${positionLeft}::float8
        WHERE "Id" = ${id}::uuid
      `;
      results.push({ id, positionTop, positionLeft });
    }

    return NextResponse.json({
      status: 'success',
      updated: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Marker update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
