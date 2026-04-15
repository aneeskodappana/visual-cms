import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const whereCondition = searchParams.get('where');

    if (!whereCondition) {
      return NextResponse.json(
        { error: 'WHERE condition is required' },
        { status: 400 }
      );
    }

    const rawQuery = `
      SELECT vc."Id", vc."Code", vc."Kind", l2d."Id" as "Layout2DId"
      FROM public."ViewConfigs" AS vc
      LEFT JOIN public."Layout2Ds" AS l2d ON l2d."ViewConfigId" = vc."Id"
      WHERE ${whereCondition}
      ORDER BY vc."Code"
    `;

    const results = await prisma.$queryRawUnsafe<Array<{
      Id: string;
      Code: string;
      Kind: number;
      Layout2DId: string | null;
    }>>(rawQuery);

    const grouped = results.reduce((acc, row) => {
      const existing = acc.find(v => v.Id === row.Id);
      if (existing) {
        if (row.Layout2DId && !existing.Layout2Ds.some(l => l.Id === row.Layout2DId)) {
          existing.Layout2Ds.push({ Id: row.Layout2DId });
        }
      } else {
        acc.push({
          Id: row.Id,
          Code: row.Code,
          Kind: row.Kind,
          Layout2Ds: row.Layout2DId ? [{ Id: row.Layout2DId }] : [],
        });
      }
      return acc;
    }, [] as Array<{ Id: string; Code: string; Kind: number; Layout2Ds: Array<{ Id: string }> }>);

    return NextResponse.json({
      status: 'success',
      count: grouped.length,
      data: grouped,
    });
  } catch (error: any) {
    console.error('Floorplates query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floorplates' },
      { status: 500 }
    );
  }
}
