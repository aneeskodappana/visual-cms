import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of updates with id and positionJson' },
        { status: 400 }
      );
    }

    const results = [];
    for (const update of updates) {
      const { id, positionJson } = update;
      if (!id || !positionJson) {
        return NextResponse.json(
          { error: 'Each update must have id and positionJson' },
          { status: 400 }
        );
      }

      await prisma.$executeRaw`
        UPDATE "Hotspots"
        SET "PositionJson" = ${positionJson}
        WHERE "Id" = ${id}::uuid
      `;
      results.push({ id, positionJson });
    }

    return NextResponse.json({
      status: 'success',
      updated: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Hotspot update error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
