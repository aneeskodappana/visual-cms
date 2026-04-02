import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const codeQuery = searchParams.get('code');
    const uuidQuery = searchParams.get('uuid');
    const kindQuery = searchParams.get('kind');
    const codeMatchType = searchParams.get('codeMatchType') || 'ilike'; // 'ilike' or 'exact'

    if (!codeQuery && !uuidQuery && !kindQuery) {
      return NextResponse.json(
        { error: 'Provide either code, uuid, or kind parameter' },
        { status: 400 }
      );
    }

    let results = [];

    // Build base filter with kind if provided
    const buildBaseWhere = () => {
      const where: any = {};
      if (kindQuery) {
        where.Kind = parseInt(kindQuery, 10);
      }
      return where;
    };

    // Build code search condition based on match type
    const buildCodeWhere = () => {
      const baseWhere = buildBaseWhere();
      if (codeMatchType === 'exact') {
        return {
          ...baseWhere,
          Code: {
            equals: codeQuery,
            mode: 'insensitive',
          },
        };
      } else {
        // Default to ilike (contains)
        return {
          ...baseWhere,
          Code: {
            contains: codeQuery,
            mode: 'insensitive',
          },
        };
      }
    };

    // Search by code
    if (codeQuery) {
      results = await prisma.viewConfig.findMany({
        where: buildCodeWhere(),
        include: {
          Layout3D: {
            include: {
              HotspotGroup: {
                include: {
                  Hotspots: true,
                },
              },
            },
          },
          Layout2Ds: {
            include: {
              Backplates: true,
              Overlays: true,
              GeoLayers: true,
              Markers: true,
            },
          },
          Navigations: true,
          GalleryItems: true,
          Nation: true,
          City: true,
          Project: true,
          Cluster: true,
          Amenity: true,
          Unit: true,
          UnitVariantExterior: true,
          UnitVariantFloor: true,
          UnitVariantInterior: true,
          ParkingFloorplan: true,
          ParkingUpgrade: true,
          ParkingUpgradeGallery: true,
        },
      });
    }

    // Search by UUID (single or multiple) or Kind only
    if (uuidQuery || (!codeQuery && kindQuery)) {
      const where: any = buildBaseWhere();
      
      if (uuidQuery) {
        const uuids = uuidQuery
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0);

        if (uuids.length > 0) {
          where.Id = {
            in: uuids,
          };
        }
      }

      const uuidResults = await prisma.viewConfig.findMany({
        where,
        include: {
          Layout3D: {
            include: {
              HotspotGroup: {
                include: {
                  Hotspots: true,
                },
              },
            },
          },
          Layout2Ds: {
            include: {
              Backplates: true,
              Overlays: true,
              GeoLayers: true,
              Markers: true,
            },
          },
          Navigations: true,
          GalleryItems: true,
          Nation: true,
          City: true,
          Project: true,
          Cluster: true,
          Amenity: true,
          Unit: true,
          UnitVariantExterior: true,
          UnitVariantFloor: true,
          UnitVariantInterior: true,
          ParkingFloorplan: true,
          ParkingUpgrade: true,
          ParkingUpgradeGallery: true,
        },
      });

      if (codeQuery) {
        results = [...results, ...uuidResults];
      } else {
        results = uuidResults;
      }
    }

    return NextResponse.json({
      status: 'success',
      count: results.length,
      data: results,
      note: 'Markers data excluded due to NaN values in position fields. Use /api/viewconfig/markers endpoint for marker details.',
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
