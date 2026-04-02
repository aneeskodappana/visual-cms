import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const codeQuery = searchParams.get('code');
    const uuidQuery = searchParams.get('uuid');
    const codeMatchType = searchParams.get('codeMatchType') || 'ilike';
    const limitQuery = searchParams.get('limit');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 1000;

    if (!codeQuery && !uuidQuery) {
      return NextResponse.json(
        { error: 'Provide either code or uuid parameter' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    const buildCodeWhere = () => {
      if (!codeQuery) return {};
      if (codeMatchType === 'exact') {
        return {
          Code: {
            equals: codeQuery,
            mode: 'insensitive' as const,
          },
        };
      } else {
        return {
          Code: {
            contains: codeQuery,
            mode: 'insensitive' as const,
          },
        };
      }
    };

    const includeRelations = {
      ViewConfig: true,
      Clusters: {
        include: {
          ViewConfig: true,
          Properties: {
            include: {
              PropertyFloors: {
                include: {
                  Units: true,
                },
              },
            },
          },
          Amenities: true,
          ParkingFloorplans: true,
        },
      },
      Amenities: true,
      CacheInfo: true,
      ProjectSalesLeadInfo: true,
      VariantInfo: true,
      City: {
        include: {
          Nation: true,
        },
      },
    };

    if (codeQuery) {
      results = await prisma.project.findMany({
        where: buildCodeWhere(),
        take: limit,
        include: includeRelations,
      });
    }

    if (uuidQuery || (!codeQuery)) {
      const where: any = {};

      if (uuidQuery) {
        const uuids = uuidQuery
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0);

        if (uuids.length > 0) {
          where.Id = { in: uuids };
        }
      }

      const uuidResults = await prisma.project.findMany({
        where,
        take: limit,
        include: includeRelations,
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
    });
  } catch (error: any) {
    console.error('Project search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
