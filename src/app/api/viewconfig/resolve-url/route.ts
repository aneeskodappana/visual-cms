import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveViewConfigLookupFromUrl, viewConfigDetailInclude } from '@/lib/viewConfigUtils';

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

async function handleResolve(rawUrl: string | null) {
  const input = rawUrl?.trim() || '';

  if (!input) {
    return NextResponse.json(
      { error: 'URL is required' },
      { status: 400 }
    );
  }

  const resolved = resolveViewConfigLookupFromUrl(input);

  if (!resolved.supported || !resolved.code || resolved.kind === null) {
    return NextResponse.json(
      {
        status: 'unsupported',
        resolved,
        query: null,
        count: 0,
        data: [],
      },
      { status: 400 }
    );
  }

  const query = {
    endpoint: `/api/viewconfig/search?code=${encodeURIComponent(resolved.code)}&kind=${resolved.kind}&codeMatchType=exact`,
    params: {
      code: resolved.code,
      kind: resolved.kind,
      codeMatchType: 'exact',
    },
    rawSql: `SELECT * FROM "ViewConfigs" WHERE LOWER("Code") = LOWER('${escapeSqlString(resolved.code)}') AND "Kind" = ${resolved.kind};`,
  };

  const results = await prisma.viewConfig.findMany({
    where: {
      Code: {
        equals: resolved.code,
        mode: 'insensitive',
      },
      Kind: resolved.kind,
    },
    include: viewConfigDetailInclude,
  });

  return NextResponse.json({
    status: results.length > 0 ? 'success' : 'not_found',
    resolved,
    query,
    count: results.length,
    data: results,
  });
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get('url');
    return await handleResolve(rawUrl);
  } catch (error: any) {
    console.error('Resolve URL error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve URL' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return await handleResolve(body?.url ?? null);
  } catch (error: any) {
    console.error('Resolve URL error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve URL' },
      { status: 500 }
    );
  }
}
