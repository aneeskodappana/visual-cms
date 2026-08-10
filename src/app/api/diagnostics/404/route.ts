import { NextRequest, NextResponse } from 'next/server';
import { getActiveDbUrl, prisma } from '@/lib/prisma';
import { getViewTypeName } from '@/lib/cdnUtils';
import { resolveViewConfigLookupFromUrl, viewConfigDetailInclude } from '@/lib/viewConfigUtils';

type IssueSeverity = 'error' | 'warning' | 'info';

interface DiagnosticIssue {
  code: string;
  severity: IssueSeverity;
  title: string;
  details: string;
  inspectSql?: string;
  fixSql?: string;
}

interface ViewConfigSummary {
  Id: string;
  Code: string;
  Kind: number;
  KindName: string;
  Title: string;
  Subtitle: string;
  Layout2DCount: number;
  HasLayout3D: boolean;
  Relation: string;
  CandidateFixSql?: string;
}

interface RelationRow {
  Id: string;
  Code: string;
  IsVisible?: boolean;
  IsExplorable?: boolean;
}

interface ViewConfigRecord {
  Id: string;
  Code: string;
  Kind: number;
  Title: string;
  Subtitle: string;
  Layout2Ds?: unknown[];
  Layout3D?: unknown | null;
  Nation?: RelationRow | null;
  City?: RelationRow | null;
  Project?: RelationRow | null;
  Cluster?: RelationRow | null;
  Amenity?: RelationRow | null;
  Unit?: RelationRow | null;
  UnitVariantExterior?: RelationRow | null;
  UnitVariantFloor?: RelationRow | null;
  UnitVariantInterior?: RelationRow | null;
  ParkingFloorplan?: RelationRow | null;
  ParkingUpgrade?: RelationRow | null;
  ParkingUpgradeGallery?: RelationRow | null;
}

interface UnitRecord {
  Id: string;
  Code: string;
  Title: string;
  UnitNumber: string;
  DisplayName: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  DisableUnit: boolean;
  HasFloorplan: boolean;
  HasInterior: boolean;
  UnitVariant?: {
    Code: string;
    Title: string;
  } | null;
  PropertyFloor?: {
    Property?: {
      Cluster?: {
        Code: string;
        Project?: {
          Code: string;
        } | null;
      } | null;
    } | null;
  } | null;
}

interface PropertyUnitLookup {
  rawUnitCode: string;
  normalizedUnitCode: string;
  requestedState: string;
  candidates: UnitRecord[];
  inspectSql: string;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteSqlList(values: string[]): string {
  return values.map((value) => `'${escapeSqlString(value)}'`).join(', ');
}

function buildViewConfigLookupSql(code: string, kind: number): string {
  return `SELECT * FROM "ViewConfigs" WHERE LOWER("Code") = LOWER('${escapeSqlString(code)}') AND "Kind" = ${kind};`;
}

function buildViewConfigUpdateSql(id: string, code: string, kind: number): string {
  return `UPDATE "ViewConfigs"\nSET "Code" = '${escapeSqlString(code)}', "Kind" = ${kind}\nWHERE "Id" = '${escapeSqlString(id)}';`;
}

function buildVisibilityFixSql(tableName: string, id: string): string {
  return `UPDATE "${tableName}"\nSET "IsVisible" = TRUE, "IsExplorable" = TRUE\nWHERE "Id" = '${escapeSqlString(id)}';`;
}

function normalizePropertyUnitCode(unitCode: string): string {
  const parts = unitCode
    .trim()
    .toLowerCase()
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const prefix = parts[0];
  const rawSuffix = parts.slice(1).join('');
  const suffix = /^\d+$/.test(rawSuffix) ? String(parseInt(rawSuffix, 10)) : rawSuffix;

  return `${prefix}-${suffix}`;
}

function parseUrlInput(input: string): URL {
  const trimmedInput = input.trim();

  if (/^https?:\/\//i.test(trimmedInput)) {
    return new URL(trimmedInput);
  }

  const normalizedPath = trimmedInput.startsWith('/') ? trimmedInput : `/${trimmedInput}`;
  return new URL(normalizedPath, 'http://diagnostics.local');
}

function summarizeViewConfig(viewConfig: ViewConfigRecord, expectedCode?: string, expectedKind?: number): ViewConfigSummary {
  const relations = [
    ['Nation', viewConfig.Nation],
    ['City', viewConfig.City],
    ['Project', viewConfig.Project],
    ['Cluster', viewConfig.Cluster],
    ['Amenity', viewConfig.Amenity],
    ['Unit', viewConfig.Unit],
    ['UnitVariantExterior', viewConfig.UnitVariantExterior],
    ['UnitVariantFloor', viewConfig.UnitVariantFloor],
    ['UnitVariantInterior', viewConfig.UnitVariantInterior],
    ['ParkingFloorplan', viewConfig.ParkingFloorplan],
    ['ParkingUpgrade', viewConfig.ParkingUpgrade],
    ['ParkingUpgradeGallery', viewConfig.ParkingUpgradeGallery],
  ].filter(([, value]) => Boolean(value));

  const summary: ViewConfigSummary = {
    Id: viewConfig.Id,
    Code: viewConfig.Code,
    Kind: viewConfig.Kind,
    KindName: getViewTypeName(viewConfig.Kind),
    Title: viewConfig.Title,
    Subtitle: viewConfig.Subtitle,
    Layout2DCount: viewConfig.Layout2Ds?.length ?? 0,
    HasLayout3D: Boolean(viewConfig.Layout3D),
    Relation: relations.map(([label]) => label).join(', ') || '-',
  };

  if (expectedCode && expectedKind !== undefined) {
    summary.CandidateFixSql = buildViewConfigUpdateSql(viewConfig.Id, expectedCode, expectedKind);
  }

  return summary;
}

function getExpectedRelation(viewConfig: ViewConfigRecord): { label: string; tableName: string; row: RelationRow | null } | null {
  const relationByKind: Record<number, { label: string; tableName: string; key: string }> = {
    1: { label: 'Nation', tableName: 'Nations', key: 'Nation' },
    2: { label: 'City', tableName: 'Cities', key: 'City' },
    3: { label: 'Project', tableName: 'Projects', key: 'Project' },
    4: { label: 'Cluster', tableName: 'Clusters', key: 'Cluster' },
    5: { label: 'Amenity', tableName: 'Amenities', key: 'Amenity' },
    7: { label: 'Unit', tableName: 'Units', key: 'Unit' },
    8: { label: 'Unit', tableName: 'Units', key: 'Unit' },
    10: { label: 'ParkingFloorplan', tableName: 'ParkingFloorplans', key: 'ParkingFloorplan' },
    11: { label: 'ParkingUpgrade', tableName: 'ParkingUpgrades', key: 'ParkingUpgrade' },
    12: { label: 'ParkingUpgradeGallery', tableName: 'ParkingUpgradeGalleries', key: 'ParkingUpgradeGallery' },
  };

  const relation = relationByKind[viewConfig.Kind];
  if (!relation) return null;

  return {
    label: relation.label,
    tableName: relation.tableName,
    row: (viewConfig[relation.key as keyof ViewConfigRecord] as RelationRow | null | undefined) ?? null,
  };
}

async function getNearbyViewConfigs(code: string, kind: number) {
  const codeParts = code.split('_').filter(Boolean);
  const firstPart = codeParts[0] || code;
  const lastPart = codeParts[codeParts.length - 1] || code;

  const candidates = await prisma.viewConfig.findMany({
    where: {
      OR: [
        {
          Code: {
            equals: code,
            mode: 'insensitive',
          },
        },
        {
          Kind: kind,
          Code: {
            contains: firstPart,
            mode: 'insensitive',
          },
        },
        {
          Kind: kind,
          Code: {
            contains: lastPart,
            mode: 'insensitive',
          },
        },
      ],
    },
    include: viewConfigDetailInclude,
    take: 20,
  });

  const unique = new Map<string, ViewConfigRecord>();
  candidates.forEach((candidate) => unique.set(candidate.Id, candidate));

  return Array.from(unique.values());
}

async function getPropertyUnitLookup(rawUrl: string): Promise<PropertyUnitLookup | null> {
  let parsedUrl: URL;

  try {
    parsedUrl = parseUrlInput(rawUrl);
  } catch {
    return null;
  }

  const segments = decodeURIComponent(parsedUrl.pathname)
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.trim().toLowerCase());
  const propertyIndex = segments.indexOf('property');

  if (propertyIndex === -1 || !segments[propertyIndex + 1]) {
    return null;
  }

  const rawUnitCode = segments[propertyIndex + 1];
  const normalizedUnitCode = normalizePropertyUnitCode(rawUnitCode);
  const requestedState = parsedUrl.searchParams.get('unitstate')?.trim().toLowerCase() || '';
  const unitCandidates = Array.from(
    new Set([
      rawUnitCode,
      normalizedUnitCode,
      rawUnitCode.replace(/-/g, ''),
      normalizedUnitCode.replace(/-/g, ''),
    ].filter(Boolean))
  );

  const candidates = await prisma.unit.findMany({
    where: {
      OR: [
        { Code: { in: unitCandidates, mode: 'insensitive' } },
        { UnitNumber: { in: unitCandidates, mode: 'insensitive' } },
        { DisplayName: { in: unitCandidates, mode: 'insensitive' } },
      ],
    },
    include: {
      UnitVariant: true,
      PropertyFloor: {
        include: {
          Property: {
            include: {
              Cluster: {
                include: {
                  Project: true,
                },
              },
            },
          },
        },
      },
    },
    take: 10,
  });

  return {
    rawUnitCode,
    normalizedUnitCode,
    requestedState,
    candidates,
    inspectSql:
      `SELECT * FROM "Units"\n` +
      `WHERE LOWER("Code") IN (${quoteSqlList(unitCandidates.map((value) => value.toLowerCase()))})\n` +
      `   OR LOWER("UnitNumber") IN (${quoteSqlList(unitCandidates.map((value) => value.toLowerCase()))})\n` +
      `   OR LOWER("DisplayName") IN (${quoteSqlList(unitCandidates.map((value) => value.toLowerCase()))});`,
  };
}

function buildUnitFlagFixSql(unit: UnitRecord, requestedState: string): string {
  const updates = ['"IsVisible" = TRUE', '"IsExplorable" = TRUE', '"DisableUnit" = FALSE'];

  if (requestedState === 'floorplan') {
    updates.push('"HasFloorplan" = TRUE');
  } else if (requestedState === 'interior') {
    updates.push('"HasInterior" = TRUE');
  } else {
    updates.push('"HasFloorplan" = TRUE', '"HasInterior" = TRUE');
  }

  return `UPDATE "Units"\nSET ${updates.join(',\n    ')}\nWHERE "Id" = '${escapeSqlString(unit.Id)}';`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function handleDiagnose(rawUrl: string | null) {
  const input = rawUrl?.trim() || '';

  if (!input) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const issues: DiagnosticIssue[] = [];
  const resolved = resolveViewConfigLookupFromUrl(input);

  if (!resolved.supported || !resolved.code || resolved.kind === null) {
    issues.push({
      code: 'unsupported-url',
      severity: 'error',
      title: 'URL pattern is not supported by the diagnostic parser',
      details: resolved.reason || 'The URL could not be converted into a ViewConfig code and kind.',
    });

    return NextResponse.json({
      status: 'failed',
      resolved,
      issues,
      lookupSql: null,
      exactMatches: [],
      nearbyMatches: [],
      propertyUnitLookup: null,
    });
  }

  const lookupSql = buildViewConfigLookupSql(resolved.code, resolved.kind);
  const activeDbUrl = getActiveDbUrl();

  if (!activeDbUrl) {
    issues.push({
      code: 'database-not-configured',
      severity: 'error',
      title: 'Visual CMS database connection is not configured',
      details:
        'Set CAPTIVATE_DATABASE_URL in visual-cms/.env.local or DATABASE_URL in Captivate.PropertyService/.env.local, then restart the Visual CMS dev server. The diagnostic can resolve the URL pattern, but it cannot inspect DB data until Prisma has an active connection string.',
      inspectSql: lookupSql,
    });

    return NextResponse.json({
      status: 'failed',
      resolved,
      lookupSql,
      issues,
      exactMatches: [],
      nearbyMatches: [],
      propertyUnitLookup: null,
    });
  }

  let propertyUnitLookup: PropertyUnitLookup | null = null;
  let exactMatches: ViewConfigRecord[] = [];
  let nearbyMatches: ViewConfigRecord[] = [];

  try {
    propertyUnitLookup = await getPropertyUnitLookup(input);

    exactMatches = await prisma.viewConfig.findMany({
      where: {
        Code: {
          equals: resolved.code,
          mode: 'insensitive',
        },
        Kind: resolved.kind,
      },
      include: viewConfigDetailInclude,
    });

    nearbyMatches = exactMatches.length === 0
      ? await getNearbyViewConfigs(resolved.code, resolved.kind)
      : [];
  } catch (error: unknown) {
    issues.push({
      code: 'database-query-failed',
      severity: 'error',
      title: 'Database query failed',
      details: getErrorMessage(
        error,
        'Visual CMS found a database connection string, but Prisma could not query the database.'
      ),
      inspectSql: lookupSql,
    });

    return NextResponse.json({
      status: 'failed',
      resolved,
      lookupSql,
      issues,
      exactMatches: [],
      nearbyMatches: [],
      propertyUnitLookup: null,
    });
  }

  if (exactMatches.length === 0) {
    issues.push({
      code: 'viewconfig-not-found',
      severity: 'error',
      title: 'No ViewConfig matches this URL',
      details: `The web app will call the viewconfig API with code "${resolved.code}" and kind ${resolved.kind} (${getViewTypeName(resolved.kind)}), but no row matches that lookup.`,
      inspectSql: lookupSql,
      fixSql: nearbyMatches.length > 0
        ? nearbyMatches
            .slice(0, 5)
            .map((candidate) => buildViewConfigUpdateSql(candidate.Id, resolved.code!, resolved.kind!))
            .join('\n\n')
        : `-- No nearby ViewConfig row was found to safely update.\n-- Create or clone a complete ViewConfig with Code='${escapeSqlString(resolved.code)}' and Kind=${resolved.kind}, including its layouts/backplates/markers.`,
    });
  }

  if (exactMatches.length > 1) {
    issues.push({
      code: 'duplicate-viewconfig',
      severity: 'warning',
      title: 'Multiple ViewConfigs match the same URL',
      details: 'The backend uses findFirst(), so duplicate rows can make the rendered page depend on database row order.',
      inspectSql: lookupSql,
      fixSql:
        `-- Keep one valid ViewConfig and change or remove the duplicates after review.\n` +
        exactMatches.map((match) => `SELECT * FROM "ViewConfigs" WHERE "Id" = '${escapeSqlString(match.Id)}';`).join('\n'),
    });
  }

  exactMatches.forEach((match) => {
    const relation = getExpectedRelation(match);

    if ((match.Layout2Ds?.length ?? 0) === 0 && !match.Layout3D) {
      issues.push({
        code: `empty-viewconfig-${match.Id}`,
        severity: 'warning',
        title: 'Matched ViewConfig has no layout data',
        details: 'The lookup succeeds, but the backend response may be incomplete because this ViewConfig has neither Layout2Ds nor Layout3D.',
        inspectSql: `SELECT * FROM "ViewConfigs" WHERE "Id" = '${escapeSqlString(match.Id)}';`,
      });
    }

    if (relation && !relation.row) {
      issues.push({
        code: `missing-relation-${match.Id}`,
        severity: 'warning',
        title: `${relation.label} relation is not connected`,
        details: `This ViewConfig has kind ${match.Kind} (${getViewTypeName(match.Kind)}) but is not linked to a ${relation.label} row. The current backend lookup can still find the ViewConfig, but CMS data is inconsistent.`,
        inspectSql: `SELECT * FROM "ViewConfigs" WHERE "Id" = '${escapeSqlString(match.Id)}';`,
      });
    }

    if (relation?.row && (relation.row.IsVisible === false || relation.row.IsExplorable === false)) {
      issues.push({
        code: `hidden-relation-${match.Id}`,
        severity: 'error',
        title: `${relation.label} is hidden or not explorable`,
        details: `${relation.label} "${relation.row.Code}" is linked to the ViewConfig but has IsVisible or IsExplorable disabled.`,
        inspectSql: `SELECT * FROM "${relation.tableName}" WHERE "Id" = '${escapeSqlString(relation.row.Id)}';`,
        fixSql: buildVisibilityFixSql(relation.tableName, relation.row.Id),
      });
    }
  });

  if (propertyUnitLookup) {
    if (propertyUnitLookup.candidates.length === 0) {
      issues.push({
        code: 'property-unit-not-found',
        severity: 'error',
        title: 'Property unit was not found',
        details: `The property URL contains unit "${propertyUnitLookup.rawUnitCode}", but no matching Unit row was found by Code, UnitNumber, or DisplayName.`,
        inspectSql: propertyUnitLookup.inspectSql,
      });
    }

    propertyUnitLookup.candidates.forEach((unit) => {
      const requestedState = propertyUnitLookup.requestedState;
      const floorplanBlocked = requestedState === 'floorplan' && !unit.HasFloorplan;
      const interiorBlocked = requestedState === 'interior' && !unit.HasInterior;
      const noViewAvailable = !unit.HasFloorplan && !unit.HasInterior;
      const unitBlocked = !unit.IsExplorable || unit.IsVisible === false || unit.DisableUnit || floorplanBlocked || interiorBlocked || noViewAvailable;

      if (!unitBlocked) return;

      issues.push({
        code: `blocked-unit-${unit.Id}`,
        severity: 'error',
        title: 'Property unit flags can trigger the 404 page',
        details:
          `Unit "${unit.Code || unit.UnitNumber}" has one or more blocking flags: ` +
          `IsVisible=${unit.IsVisible}, IsExplorable=${unit.IsExplorable}, DisableUnit=${unit.DisableUnit}, ` +
          `HasFloorplan=${unit.HasFloorplan}, HasInterior=${unit.HasInterior}.`,
        inspectSql: `SELECT * FROM "Units" WHERE "Id" = '${escapeSqlString(unit.Id)}';`,
        fixSql: buildUnitFlagFixSql(unit, requestedState),
      });
    });
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error');

  if (!hasErrors && issues.length === 0) {
    issues.push({
      code: 'no-db-issue-detected',
      severity: 'info',
      title: 'No obvious database issue detected',
      details: 'The expected ViewConfig exists and the diagnostic did not find a blocking visibility, relation, or property-unit flag issue.',
      inspectSql: lookupSql,
    });
  }

  return NextResponse.json({
    status: hasErrors ? 'failed' : 'passed',
    resolved,
    lookupSql,
    issues,
    exactMatches: exactMatches.map((match) => summarizeViewConfig(match)),
    nearbyMatches: nearbyMatches.map((match) => summarizeViewConfig(match, resolved.code!, resolved.kind!)),
    propertyUnitLookup: propertyUnitLookup
      ? {
          ...propertyUnitLookup,
          candidates: propertyUnitLookup.candidates.map((unit) => ({
            Id: unit.Id,
            Code: unit.Code,
            Title: unit.Title,
            UnitNumber: unit.UnitNumber,
            DisplayName: unit.DisplayName,
            IsVisible: unit.IsVisible,
            IsExplorable: unit.IsExplorable,
            DisableUnit: unit.DisableUnit,
            HasFloorplan: unit.HasFloorplan,
            HasInterior: unit.HasInterior,
            UnitVariant: unit.UnitVariant
              ? {
                  Code: unit.UnitVariant.Code,
                  Title: unit.UnitVariant.Title,
                }
              : null,
            ProjectCode: unit.PropertyFloor?.Property?.Cluster?.Project?.Code ?? null,
            ClusterCode: unit.PropertyFloor?.Property?.Cluster?.Code ?? null,
          })),
        }
      : null,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handleDiagnose(request.nextUrl.searchParams.get('url'));
  } catch (error: unknown) {
    console.error('404 diagnostic error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to diagnose URL') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return await handleDiagnose(body?.url ?? null);
  } catch (error: unknown) {
    console.error('404 diagnostic error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to diagnose URL') },
      { status: 500 }
    );
  }
}
