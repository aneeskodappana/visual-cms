import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, subtitle } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ViewConfig ID is required' },
        { status: 400 }
      );
    }

    // Build the update object dynamically based on provided fields
    const updateData: any = {};
    if (title !== undefined) updateData.Title = title;
    if (subtitle !== undefined) updateData.Subtitle = subtitle;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one field (title or subtitle) must be provided' },
        { status: 400 }
      );
    }

    // Update the ViewConfig
    const updatedViewConfig = await prisma.viewConfig.update({
      where: {
        Id: id,
      },
      data: updateData,
      select: {
        Id: true,
        Title: true,
        Subtitle: true,
        Code: true,
        CdnBaseUrl: true,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: updatedViewConfig,
    });
  } catch (error: any) {
    console.error('ViewConfig update error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'ViewConfig not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update ViewConfig' },
      { status: 500 }
    );
  }
}
