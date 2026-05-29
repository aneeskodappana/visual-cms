import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/page-builder?kind=<int>&code=<string>
 *
 * Loads an existing page (ViewConfig) with its Layout2Ds and, for each layout, the Backplates and
 * Markers (markers ordered by MarkerIndex). The shape is consumed by `pageFromRow` on the client.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || '';
    const code = searchParams.get('code') || '';
    const kindParam = searchParams.get('kind');

    if (!id && !code) {
      return NextResponse.json(
        { status: 'error', error: 'id or code is required' },
        { status: 400 },
      );
    }

    const include = {
      Layout2Ds: {
        orderBy: { DisplayOrder: 'asc' as const },
        include: {
          Backplates: true,
          Markers: { orderBy: { MarkerIndex: 'asc' as const } },
        },
      },
    };

    let viewConfig;
    if (id) {
      viewConfig = await prisma.viewConfig.findUnique({ where: { Id: id }, include });
    } else {
      const where: { Code: string; Kind?: number } = { Code: code };
      if (kindParam !== null && kindParam !== '') {
        const kind = parseInt(kindParam, 10);
        if (!Number.isNaN(kind)) where.Kind = kind;
      }
      viewConfig = await prisma.viewConfig.findFirst({ where, include });
    }

    if (!viewConfig) {
      return NextResponse.json(
        { status: 'error', error: `No ViewConfig found for ${id ? `id "${id}"` : `code "${code}"`}` },
        { status: 404 },
      );
    }

    return NextResponse.json(viewConfig);
  } catch (error) {
    console.error('Error loading page:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load page',
      },
      { status: 500 },
    );
  }
}
