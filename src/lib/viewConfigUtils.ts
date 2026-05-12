import { getViewTypeName } from './cdnUtils';

export const viewConfigDetailInclude = {
  Layout3D: {
    include: {
      HotspotGroup: {
        include: {
          Hotspots: true,
        },
      },
      FromTransitions: true,
      ToTransitions: true,
    },
  },
  Layout2Ds: {
    include: {
      Backplates: true,
      Overlays: true,
      GeoLayers: {
        include: {
          Data: true,
        },
      },
      Markers: true,
      FromTransitions: true,
      ToTransitions: true,
    },
  },
  Navigations: true,
  GalleryItems: true,
  Nation: true,
  City: true,
  Project: true,
  Cluster: true,
  Amenity: true,
  Unit: true,
  UnitVariantExterior: true,
  UnitVariantFloor: true,
  UnitVariantInterior: true,
  ParkingFloorplan: true,
  ParkingUpgrade: true,
  ParkingUpgradeGallery: true,
} as const;

export interface ResolvedViewConfigLookup {
  input: string;
  pathname: string;
  pathSegments: string[];
  code: string | null;
  kind: number | null;
  kindName: string | null;
  supported: boolean;
  reason: string | null;
}

function buildUnsupportedLookup(
  input: string,
  pathname: string,
  pathSegments: string[],
  reason: string
): ResolvedViewConfigLookup {
  return {
    input,
    pathname,
    pathSegments,
    code: null,
    kind: null,
    kindName: null,
    supported: false,
    reason,
  };
}

function buildSupportedLookup(
  input: string,
  pathname: string,
  pathSegments: string[],
  code: string,
  kind: number
): ResolvedViewConfigLookup {
  return {
    input,
    pathname,
    pathSegments,
    code,
    kind,
    kindName: getViewTypeName(kind),
    supported: true,
    reason: null,
  };
}

function normalizePathSegment(segment: string): string {
  return decodeURIComponent(segment).trim().toLowerCase();
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
  return new URL(normalizedPath, 'http://viewconfig.local');
}

function normalizePropertyUnitCode(unitCode: string): string {
  const parts = normalizePathSegment(unitCode)
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const prefix = parts[0];
  const rawSuffix = parts.slice(1).join('');
  const suffix = /^\d+$/.test(rawSuffix) ? String(parseInt(rawSuffix, 10)) : rawSuffix;

  return `${prefix}-${suffix}`;
}

export function resolveViewConfigLookupFromUrl(input: string): ResolvedViewConfigLookup {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return buildUnsupportedLookup(input, '/', [], 'Please enter a URL or path');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = parseUrlInput(trimmedInput);
  } catch {
    return buildUnsupportedLookup(input, '/', [], 'Unable to parse the provided URL');
  }

  const pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .map(normalizePathSegment);

  if (pathSegments.length === 0) {
    return buildUnsupportedLookup(input, pathname, pathSegments, 'The URL path does not contain any segments');
  }

  const propertyIndex = pathSegments.indexOf('property');

  if (propertyIndex !== -1) {
    const projectCode = pathSegments[propertyIndex - 1];
    const unitCode = pathSegments[propertyIndex + 1];
    const levelCode = pathSegments[propertyIndex + 2];
    const scheme = parsedUrl.searchParams.get('scheme')?.trim().toLowerCase() || '';
    const unitState = parsedUrl.searchParams.get('unitstate')?.trim().toLowerCase() || '';

    if (projectCode && unitCode && levelCode && scheme && (unitState === 'floorplan' || unitState === 'interior')) {
      const code = `${projectCode}_${normalizePropertyUnitCode(unitCode)}_${scheme}_${levelCode.toLowerCase()}`;
      const kind = unitState === 'floorplan' ? 7 : 8;
      return buildSupportedLookup(input, pathname, pathSegments, code, kind);
    }

    return buildUnsupportedLookup(
      input,
      pathname,
      pathSegments,
      'Property URLs are only supported for floorplan/interior cases with scheme and level segments right now'
    );
  }

  if (pathSegments.length === 1) {
    return buildSupportedLookup(input, pathname, pathSegments, pathSegments[0], 1);
  }

  if (pathSegments.length === 2) {
    return buildSupportedLookup(input, pathname, pathSegments, pathSegments[1], 2);
  }

  if (pathSegments.length === 3) {
    return buildSupportedLookup(input, pathname, pathSegments, pathSegments[2], 3);
  }

  if (pathSegments.length === 4 || pathSegments.length === 5) {
    return buildSupportedLookup(input, pathname, pathSegments, pathSegments.slice(2).join('_'), 4);
  }

  return buildUnsupportedLookup(
    input,
    pathname,
    pathSegments,
    'This URL pattern is not supported yet'
  );
}
