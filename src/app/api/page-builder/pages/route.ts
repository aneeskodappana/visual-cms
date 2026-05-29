import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/page-builder/pages
 *
 * Lists all ViewConfigs with summary info (layout count, marker count).
 * Supports optional query params: ?kind=3&search=yasparkplace
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get('kind');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const where: Record<string, unknown> = {};
    if (kindParam && !isNaN(Number(kindParam))) {
      where.Kind = Number(kindParam);
    }
    if (search) {
      where.OR = [
        { Code: { contains: search, mode: 'insensitive' } },
        { Title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.viewConfig.count({ where });

    const viewConfigs = await prisma.viewConfig.findMany({
      where,
      orderBy: [{ Kind: 'asc' }, { Code: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        Id: true,
        Kind: true,
        Code: true,
        Title: true,
        Subtitle: true,
        CdnBaseUrl: true,
        HasGallery: true,
        NationId: true,
        CityId: true,
        ProjectId: true,
        ClusterId: true,
        AmenityId: true,
        UnitId: true,
        _count: {
          select: {
            Layout2Ds: true,
            Navigations: true,
          },
        },
        Layout2Ds: {
          select: {
            _count: {
              select: { Markers: true, Backplates: true },
            },
          },
        },
      },
    });

    const pages = viewConfigs.map((vc) => {
      const markerCount = vc.Layout2Ds.reduce(
        (sum, l) => sum + l._count.Markers,
        0,
      );
      const backplateCount = vc.Layout2Ds.reduce(
        (sum, l) => sum + l._count.Backplates,
        0,
      );

      const parentLink = vc.ProjectId
        ? { field: 'ProjectId', id: vc.ProjectId }
        : vc.ClusterId
          ? { field: 'ClusterId', id: vc.ClusterId }
          : vc.CityId
            ? { field: 'CityId', id: vc.CityId }
            : vc.NationId
              ? { field: 'NationId', id: vc.NationId }
              : vc.AmenityId
                ? { field: 'AmenityId', id: vc.AmenityId }
                : vc.UnitId
                  ? { field: 'UnitId', id: vc.UnitId }
                  : null;

      return {
        id: vc.Id,
        kind: vc.Kind,
        code: vc.Code,
        title: vc.Title,
        subtitle: vc.Subtitle,
        layoutCount: vc._count.Layout2Ds,
        markerCount,
        backplateCount,
        navigationCount: vc._count.Navigations,
        parentLink,
      };
    });

    return NextResponse.json({
      status: 'success',
      data: pages,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Failed to list pages' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/page-builder/pages?id=xxx
 *
 * Deletes a ViewConfig and all its children (cascades via Prisma).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ status: 'error', error: 'id param required' }, { status: 400 });
    }

    await prisma.viewConfig.delete({ where: { Id: id } });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Failed to delete page' },
      { status: 500 },
    );
  }
}
