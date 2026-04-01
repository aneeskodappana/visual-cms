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
