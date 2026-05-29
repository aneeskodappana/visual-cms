import { prisma } from '@/lib/prisma';
import { transformDbToWebAppViewConfig } from '@/lib/previewTransform';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/page-builder/preview/[id]
 *
 * Loads a ViewConfig by Id from the DB, transforms it into the WebApp-shaped JSON,
 * and returns it for the preview renderer.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { status: 'error', error: 'id param is required' },
        { status: 400 },
      );
    }

    const viewConfig = await prisma.viewConfig.findUnique({
      where: { Id: id },
      include: {
        Layout2Ds: {
          orderBy: { DisplayOrder: 'asc' },
          include: {
            Backplates: true,
            Markers: { orderBy: { MarkerIndex: 'asc' } },
            Overlays: true,
          },
        },
        Navigations: { orderBy: { DisplayOrder: 'asc' } },
      },
    });

    if (!viewConfig) {
      return NextResponse.json(
        { status: 'error', error: `No ViewConfig found for id "${id}"` },
        { status: 404 },
      );
    }

    const webAppViewConfig = transformDbToWebAppViewConfig(viewConfig);

    return NextResponse.json({ status: 'success', data: webAppViewConfig });
  } catch (error) {
    console.error('Error loading preview:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load preview',
      },
      { status: 500 },
    );
  }
}
