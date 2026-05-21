import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { Code: { contains: search, mode: 'insensitive' as const } },
            { Title: { contains: search, mode: 'insensitive' as const } },
            { MulesoftCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Fetch projects with city information
    const projects = await prisma.project.findMany({
      where,
      include: {
        City: {
          select: {
            Id: true,
            Code: true,
            Title: true,
          },
        },
      },
      orderBy: {
        Title: 'asc',
      },
      skip,
      take: limit,
    });

    // Fetch total count for pagination
    const total = await prisma.project.count({ where });

    return NextResponse.json({
      status: 'success',
      data: projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
      },
      { status: 500 }
    );
  }
}
