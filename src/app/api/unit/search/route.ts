import { prisma } from '@/lib/prisma';
import { buildUnitLookupAliases, normalizeLookupToken } from '@/lib/unitSqlGeneratorUtils';
import { NextRequest, NextResponse } from 'next/server';

function parseUuidList(value: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseStructuredLookup(value: string) {
  const normalized = normalizeLookupToken(value);
  const parts = normalized.split('_').filter(Boolean);
  if (parts.length < 4) {
    return null;
  }

  return {
    normalized,
    projectCode: parts[0],
    unitTokens: parts.slice(1),
  };
}

function buildProjectFilter(projectCode: string | null) {
  if (!projectCode) return null;

  return {
    PropertyFloor: {
      Property: {
        Cluster: {
          Project: {
            Code: {
              equals: projectCode,
              mode: 'insensitive' as const,
            },
          },
        },
      },
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const codeQuery = searchParams.get('code');
    const uuidQuery = searchParams.get('uuid');
    const codeMatchType = searchParams.get('codeMatchType') || 'ilike';
    const projectCodeQuery = searchParams.get('projectCode');
    const furnishedQuery = searchParams.get('furnished');
    const limitQuery = searchParams.get('limit');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 1000;

    if (!codeQuery && !uuidQuery) {
      return NextResponse.json(
        { error: 'Provide either code or uuid parameter' },
        { status: 400 }
      );
    }

    const includeRelations = {
      ViewConfigs: true,
      UnitVariant: {
        include: {
          UnitVariantExteriors: true,
          UnitVariantFloors: true,
          UnitVariantInteriors: true,
        },
      },
      PropertyFloor: {
        include: {
          Property: {
            include: {
              Cluster: {
                include: {
                  Project: {
                    include: {
                      City: {
                        include: {
                          Nation: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const structuredLookup = codeQuery ? parseStructuredLookup(codeQuery) : null;
    const effectiveProjectCode = (projectCodeQuery || structuredLookup?.projectCode || '').trim() || null;
    const projectFilter = buildProjectFilter(effectiveProjectCode);
    const furnishedFilter =
      furnishedQuery == null
        ? null
        : {
            IsFurnished: ['1', 'true', 'yes'].includes(furnishedQuery.trim().toLowerCase()),
          };

    const baseFilters = [projectFilter, furnishedFilter].filter(Boolean) as Record<string, unknown>[];
    const results: any[] = [];

    if (codeQuery) {
      const codeFilters = [...baseFilters];

      if (structuredLookup) {
        for (const token of structuredLookup.unitTokens) {
          codeFilters.push({
            OR: [
              { UnitNumber: { contains: token, mode: 'insensitive' as const } },
              { Code: { contains: token, mode: 'insensitive' as const } },
              { DisplayName: { contains: token, mode: 'insensitive' as const } },
              { Title: { contains: token, mode: 'insensitive' as const } },
            ],
          });
        }
      } else {
        const comparator =
          codeMatchType === 'exact'
            ? { equals: codeQuery, mode: 'insensitive' as const }
            : { contains: codeQuery, mode: 'insensitive' as const };

        codeFilters.push({
          OR: [
            { UnitNumber: comparator },
            { Code: comparator },
            { DisplayName: comparator },
            { Title: comparator },
          ],
        });
      }

      const codeWhere = codeFilters.length > 0 ? { AND: codeFilters } : {};
      results.push(
        ...(await prisma.unit.findMany({
          where: codeWhere,
          take: limit,
          include: includeRelations,
        }))
      );
    }

    const uuids = parseUuidList(uuidQuery);
    if (uuids.length > 0 || (!codeQuery && uuidQuery != null)) {
      const uuidFilters = [...baseFilters];

      if (uuids.length > 0) {
        uuidFilters.push({
          Id: {
            in: uuids,
          },
        });
      }

      const uuidWhere = uuidFilters.length > 0 ? { AND: uuidFilters } : {};
      results.push(
        ...(await prisma.unit.findMany({
          where: uuidWhere,
          take: limit,
          include: includeRelations,
        }))
      );
    }

    let finalResults = Array.from(new Map(results.map((unit) => [unit.Id, unit])).values());

    if (codeQuery) {
      const normalizedQuery = normalizeLookupToken(codeQuery);
      const shouldApplyAliasFilter = structuredLookup || normalizedQuery.includes('_');

      if (shouldApplyAliasFilter) {
        finalResults = finalResults.filter((unit) => {
          const aliases = buildUnitLookupAliases({
            Id: unit.Id,
            Code: unit.Code,
            DisplayName: unit.DisplayName,
            Title: unit.Title,
            UnitNumber: unit.UnitNumber,
            UnitStatus: unit.UnitStatus,
            IsVisible: unit.IsVisible,
            IsExplorable: unit.IsExplorable,
            IsFurnished: unit.IsFurnished,
            projectCode: unit.PropertyFloor?.Property?.Cluster?.Project?.Code || '',
            projectTitle: unit.PropertyFloor?.Property?.Cluster?.Project?.Title || '',
            clusterTitle: unit.PropertyFloor?.Property?.Cluster?.Title || '',
            propertyCode: unit.PropertyFloor?.Property?.Code || '',
            propertyTitle: unit.PropertyFloor?.Property?.Title || '',
            floorCode: unit.PropertyFloor?.Code || '',
            floorTitle: unit.PropertyFloor?.Title || '',
          });

          if (codeMatchType === 'exact') {
            return aliases.includes(normalizedQuery);
          }

          return aliases.some((alias) => alias.includes(normalizedQuery));
        });
      }
    }

    return NextResponse.json({
      status: 'success',
      count: finalResults.length,
      data: finalResults,
    });
  } catch (error: any) {
    console.error('Unit search error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
