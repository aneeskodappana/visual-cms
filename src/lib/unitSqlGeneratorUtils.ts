export type SqlOperation = 'update' | 'delete' | 'select';

export interface FlatUnitRecord {
  Id: string;
  Code: string;
  DisplayName?: string;
  Title?: string;
  UnitNumber: string;
  UnitStatus: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  IsFurnished?: boolean;
  projectCode: string;
  projectTitle: string;
  clusterTitle: string;
  propertyCode: string;
  propertyTitle: string;
  floorCode: string;
  floorTitle: string;
}

interface ProjectUnitShape {
  Id: string;
  Code: string;
  DisplayName?: string;
  Title?: string;
  UnitNumber: string;
  UnitStatus: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  IsFurnished?: boolean;
}

interface ProjectShape {
  Code: string;
  Title?: string;
  Clusters?: Array<{
    Code?: string;
    Title?: string;
    Properties?: Array<{
      Code?: string;
      Title?: string;
      PropertyFloors?: Array<{
        Code?: string;
        Title?: string;
        Units?: ProjectUnitShape[];
      }>;
    }>;
  }>;
}

interface UnitSearchShape {
  Id: string;
  Code: string;
  DisplayName?: string;
  Title?: string;
  UnitNumber: string;
  UnitStatus: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  IsFurnished?: boolean;
  PropertyFloor?: {
    Code?: string;
    Title?: string;
    Property?: {
      Code?: string;
      Title?: string;
      Cluster?: {
        Code?: string;
        Title?: string;
        Project?: {
          Code?: string;
          Title?: string;
        };
      };
    };
  };
}

export interface UnitUrlLookup {
  input: string;
  pathname: string;
  pathSegments: string[];
  supported: boolean;
  reason: string | null;
  projectCode: string;
  unitNumber: string;
  normalizedLookup: string;
  levelCode: string;
  scheme: string;
  unitState: string;
  furnished: boolean | null;
}

export const UNIT_STATUS_OPTIONS = ['Available', 'Reserved', 'Sold', 'Unavailable'] as const;

export const escapeSqlString = (value: string) => value.replace(/'/g, "''");

export const sqlLiteral = (value: string) => `'${escapeSqlString(value)}'`;

export function normalizeLookupToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildUnitLookupAliases(unit: FlatUnitRecord): string[] {
  const values = new Set<string>();
  const projectCode = normalizeLookupToken(unit.projectCode);
  const propertyCode = normalizeLookupToken(unit.propertyCode || unit.propertyTitle);
  const normalizedUnitNumber = normalizeLookupToken(unit.UnitNumber);
  const normalizedCode = normalizeLookupToken(unit.Code);
  const normalizedDisplayName = normalizeLookupToken(unit.DisplayName || unit.Title || '');

  for (const candidate of [normalizedUnitNumber, normalizedCode, normalizedDisplayName]) {
    if (candidate) {
      values.add(candidate);
      if (projectCode) {
        values.add(`${projectCode}_${candidate}`);
      }
      if (projectCode && propertyCode && candidate.startsWith(propertyCode + '_')) {
        values.add(`${projectCode}_${candidate}`);
      }
    }
  }

  return Array.from(values);
}

export function buildUnitWhereClause(units: FlatUnitRecord[]) {
  const unitsWithNumbers = units.filter((unit) => Boolean(unit.UnitNumber));
  const unitNumbers = Array.from(new Set(unitsWithNumbers.map((unit) => unit.UnitNumber))).sort();

  if (unitsWithNumbers.length !== units.length) {
    const ids = Array.from(new Set(units.map((unit) => unit.Id))).sort();
    if (ids.length === 1) {
      return `"Id"=${sqlLiteral(ids[0])}::uuid`;
    }
    return `"Id" IN (${ids.map((id) => `${sqlLiteral(id)}::uuid`).join(', ')})`;
  }

  if (unitNumbers.length === 1) {
    return `"UnitNumber"=${sqlLiteral(unitNumbers[0])}`;
  }

  return `"UnitNumber" IN (${unitNumbers.map(sqlLiteral).join(', ')})`;
}

export function buildUnitSql(
  units: FlatUnitRecord[],
  options: {
    sqlOperation: SqlOperation;
    unitStatus: string;
    isVisible: boolean;
    isExplorable: boolean;
  }
) {
  const whereClause = buildUnitWhereClause(units);
  const unitNumbers = units.map((unit) => unit.UnitNumber).sort().join(', ');
  const header = [
    `-- ${options.sqlOperation.toUpperCase()} SQL for ${units.length} Unit(s): ${unitNumbers}`,
    `-- Generated at: ${new Date().toISOString()}`,
  ].join('\n');

  if (options.sqlOperation === 'update') {
    return `${header}\nUPDATE public."Units"\nSET "IsVisible"=${options.isVisible}, "IsExplorable"=${options.isExplorable}, "UnitStatus"=${sqlLiteral(options.unitStatus)}\nWHERE ${whereClause};`;
  }

  if (options.sqlOperation === 'delete') {
    return `${header}\nDELETE FROM public."Units"\nWHERE ${whereClause};`;
  }

  return `${header}\nSELECT *\nFROM public."Units"\nWHERE ${whereClause}\nORDER BY "UnitNumber";`;
}

export function flattenProjectUnits(project: ProjectShape): FlatUnitRecord[] {
  const units: FlatUnitRecord[] = [];

  for (const cluster of project.Clusters || []) {
    for (const property of cluster.Properties || []) {
      for (const floor of property.PropertyFloors || []) {
        for (const unit of floor.Units || []) {
          units.push({
            Id: unit.Id,
            Code: unit.Code,
            DisplayName: unit.DisplayName,
            Title: unit.Title,
            UnitNumber: unit.UnitNumber,
            UnitStatus: unit.UnitStatus,
            IsVisible: unit.IsVisible,
            IsExplorable: unit.IsExplorable,
            IsFurnished: unit.IsFurnished,
            projectCode: project.Code || '',
            projectTitle: project.Title || project.Code || '-',
            clusterTitle: cluster.Title || cluster.Code || '-',
            propertyCode: property.Code || '',
            propertyTitle: property.Title || property.Code || '-',
            floorCode: floor.Code || '',
            floorTitle: floor.Title || floor.Code || '-',
          });
        }
      }
    }
  }

  return units;
}

export function mapUnitSearchResultToFlatUnit(unit: UnitSearchShape): FlatUnitRecord {
  const property = unit.PropertyFloor?.Property;
  const cluster = property?.Cluster;
  const project = cluster?.Project;

  return {
    Id: unit.Id,
    Code: unit.Code,
    DisplayName: unit.DisplayName,
    Title: unit.Title,
    UnitNumber: unit.UnitNumber,
    UnitStatus: unit.UnitStatus,
    IsVisible: unit.IsVisible,
    IsExplorable: unit.IsExplorable,
    IsFurnished: unit.IsFurnished,
    projectCode: project?.Code || '',
    projectTitle: project?.Title || project?.Code || '-',
    clusterTitle: cluster?.Title || cluster?.Code || '-',
    propertyCode: property?.Code || '',
    propertyTitle: property?.Title || property?.Code || '-',
    floorCode: unit.PropertyFloor?.Code || '',
    floorTitle: unit.PropertyFloor?.Title || unit.PropertyFloor?.Code || '-',
  };
}

export function dedupeFlatUnits(units: FlatUnitRecord[]) {
  return Array.from(new Map(units.map((unit) => [unit.Id, unit])).values());
}

function parseUrlInput(input: string): URL {
  const trimmedInput = input.trim();

  if (/^https?:\/\//i.test(trimmedInput)) {
    return new URL(trimmedInput);
  }

  if (/^[^/\s]+:\d+(\/|$)/i.test(trimmedInput)) {
    return new URL(`http://${trimmedInput}`);
  }

  if (/^[^/\s]+\.[^/\s]+(\/|$)/i.test(trimmedInput)) {
    return new URL(`https://${trimmedInput}`);
  }

  const normalizedPath = trimmedInput.startsWith('/') ? trimmedInput : `/${trimmedInput}`;
  return new URL(normalizedPath, 'http://unit-sql.local');
}

export function resolveUnitLookupFromUrl(input: string): UnitUrlLookup {
  const emptyResult: UnitUrlLookup = {
    input,
    pathname: '/',
    pathSegments: [],
    supported: false,
    reason: 'Please enter a URL or path',
    projectCode: '',
    unitNumber: '',
    normalizedLookup: '',
    levelCode: '',
    scheme: '',
    unitState: '',
    furnished: null,
  };

  if (!input.trim()) {
    return emptyResult;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = parseUrlInput(input);
  } catch {
    return {
      ...emptyResult,
      reason: 'Unable to parse the provided URL',
    };
  }

  const pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).trim().toLowerCase());

  const propertyIndex = pathSegments.indexOf('property');
  if (propertyIndex === -1) {
    return {
      ...emptyResult,
      pathname,
      pathSegments,
      reason: 'Only property URLs are supported for unit lookup',
    };
  }

  const projectCode = pathSegments[propertyIndex - 1] || '';
  const unitNumber = decodeURIComponent(pathname.split('/').filter(Boolean)[propertyIndex + 1] || '').trim();
  const levelCode = pathSegments[propertyIndex + 2] || '';
  const scheme = parsedUrl.searchParams.get('scheme')?.trim() || '';
  const unitState = parsedUrl.searchParams.get('unitstate')?.trim().toLowerCase() || '';
  const furnishedValue = parsedUrl.searchParams.get('furnished');
  const furnished =
    furnishedValue == null ? null : ['1', 'true', 'yes'].includes(furnishedValue.trim().toLowerCase());
  const normalizedLookup = normalizeLookupToken(`${projectCode}_${unitNumber}`);

  if (!projectCode || !unitNumber) {
    return {
      ...emptyResult,
      pathname,
      pathSegments,
      reason: 'The property URL must include both a project code and unit number',
    };
  }

  return {
    input,
    pathname,
    pathSegments,
    supported: true,
    reason: null,
    projectCode,
    unitNumber,
    normalizedLookup,
    levelCode,
    scheme,
    unitState,
    furnished,
  };
}
