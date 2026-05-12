import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, modelScaleJson } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Layout3D ID is required' },
        { status: 400 }
      );
    }

    if (modelScaleJson === undefined) {
      return NextResponse.json(
        { error: 'modelScaleJson is required' },
        { status: 400 }
      );
    }

    const updatedLayout3D = await prisma.layout3D.update({
      where: {
        Id: id,
      },
      data: {
        ModelScaleJson: modelScaleJson,
      },
      select: {
        Id: true,
        ModelScaleJson: true,
        ViewConfigId: true,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: updatedLayout3D,
    });
  } catch (error: any) {
    console.error('Layout3D update error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Layout3D not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update Layout3D' },
      { status: 500 }
    );
  }
}
