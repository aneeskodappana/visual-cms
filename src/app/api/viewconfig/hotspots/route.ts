import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Provide an array of updates with id and at least one of positionJson or name' },
        { status: 400 }
      );
    }

    const results = [];
    for (const update of updates) {
      const { id, positionJson, name } = update;
      if (!id || (!positionJson && name === undefined)) {
        return NextResponse.json(
          { error: 'Each update must have id and at least one of positionJson or name' },
          { status: 400 }
        );
      }

      if (positionJson && name !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Hotspots"
          SET "PositionJson" = ${positionJson}, "Name" = ${name}
          WHERE "Id" = ${id}::uuid
        `;
      } else if (positionJson) {
        await prisma.$executeRaw`
          UPDATE "Hotspots"
          SET "PositionJson" = ${positionJson}
          WHERE "Id" = ${id}::uuid
        `;
      } else if (name !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Hotspots"
          SET "Name" = ${name}
          WHERE "Id" = ${id}::uuid
        `;
      }
      results.push({ id, ...(positionJson && { positionJson }), ...(name !== undefined && { name }) });
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
