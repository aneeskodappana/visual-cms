import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    const includeRelations = {
      ViewConfig: true,
      Clusters: {
        include: {
          ViewConfig: true,
          Properties: {
            include: {
              PropertyFloors: {
                include: {
                  Units: {
                    include: {
                      UnitVariant: true,
                    },
                  },
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

    const project = await prisma.project.findUnique({
      where: { Id: projectId },
      include: includeRelations,
    });

    if (!project) {
      return NextResponse.json(
        { status: 'error', error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch project',
      },
      { status: 500 }
    );
  }
}
