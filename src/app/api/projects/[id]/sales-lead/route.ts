import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();

    // Update or create ProjectSalesLeadInfo
    const updated = await prisma.projectSalesLeadInfo.upsert({
      where: { ProjectId: projectId },
      update: body,
      create: {
        ProjectId: projectId,
        ...body,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating sales lead info:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to update sales lead info',
      },
      { status: 500 }
    );
  }
}
