/**
 * Transforms a DB ViewConfig (Prisma shape) into the WebApp ViewConfig JSON shape
 * consumed by the WebApp frontend components (ViewConfigProvider → MapLayoutCarouselView).
 *
 * The WebApp receives this shape from PropertyService. We replicate it here so the
 * visual-cms preview can render identically without going through PropertyService.
 */

import { MarkerTypes as CmsMarkerTypes, MarkerSubTypes as CmsMarkerSubTypes } from './cdnUtils';

const BLOB_BASE_URL = 'https://worlddev.aldar.com/assets/';

// -- WebApp enums (string-based, matching WebApp/src/types) --

const BackplateFormatMap: Record<number, string> = {
  0: 'Image',
  1: 'Video',
  2: 'Tiled',
  3: 'MapBox',
};

const BackplateThemeMap: Record<number, string> = {
  0: 'Day',
  1: 'Night',
};

const ViewTypeNameMap: Record<number, string> = {
  0: 'Globe',
  1: 'Nation',
  2: 'City',
  3: 'Project',
  4: 'Cluster',
  5: 'Amenity',
  6: 'Property',
  7: 'Floor',
  8: 'Interior',
  9: 'Gallery',
  10: 'ParkingFloorplan',
  11: 'ParkingUpgrade',
  12: 'ParkingUpgradeGallery',
};

const MarkerTypeNameMap: Record<number, string> = {};
{
  const enumObj = CmsMarkerTypes as unknown as Record<string, string | number>;
  for (const key of Object.keys(enumObj)) {
    const val = enumObj[key];
    if (typeof val === 'number') {
      MarkerTypeNameMap[val] = key;
    }
  }
}

// -- Helpers --

function resolveUrl(path: string | null | undefined, cdnBase?: string): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${BLOB_BASE_URL}${cdnBase || ''}${path}`;
}

function resolveIconUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('#')) return path;
  return `${BLOB_BASE_URL}${path}`;
}

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json || json.trim() === '') return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

// -- Transform functions --

/* eslint-disable @typescript-eslint/no-explicit-any */

function transformMarkerState(
  title: string | null | undefined,
  titleVisible: boolean | null | undefined,
  iconUrl: string | null | undefined,
  iconVersion: number | null | undefined,
  iconWidth: number | null | undefined,
  iconHeight: number | null | undefined,
  scale: number | null | undefined,
  keepScale: boolean,
) {
  const state: any = { keepScale };
  if (title != null) state.title = title;
  if (titleVisible != null) state.titleVisible = titleVisible;
  if (scale != null) state.scale = scale;
  if (iconUrl) {
    state.icon = {
      url: resolveIconUrl(iconUrl),
      width: iconWidth ?? 0,
      height: iconHeight ?? 0,
    };
    if (iconVersion != null) state.icon.version = iconVersion;
  }
  return state;
}

function transformMarker(dbMarker: any): any {
  const kind = MarkerTypeNameMap[dbMarker.Kind] || 'Base';

  const marker: any = {
    id: dbMarker.MarkerIndex,
    kind,
    code: dbMarker.Code || '',
    position: {
      left: dbMarker.PositionLeft,
      top: dbMarker.PositionTop,
    },
    keepScale: Boolean(dbMarker.KeepScale),
    isExploreDisabled: !dbMarker.IsExplorable,
    isHidden: !dbMarker.IsVisible,
    title: dbMarker.Title || '',
    titleVisible: Boolean(dbMarker.TitleVisible),
    navigateTo: dbMarker.NavigateTo || undefined,
    minZoom: dbMarker.MinZoom,
    maxZoom: dbMarker.MaxZoom,
    mobileMinZoom: dbMarker.MobileMinZoom,
    mobileMaxZoom: dbMarker.MobileMaxZoom,
    mobileScale: dbMarker.MobileScale,
    version: dbMarker.Version,
    isPriority: dbMarker.IsPriority,
  };

  if (dbMarker.Scale != null) {
    marker.scale = dbMarker.Scale;
  }

  if (dbMarker.SubType != null) {
    const subTypeName = CmsMarkerSubTypes[dbMarker.SubType];
    if (subTypeName) marker.subType = subTypeName;
  }

  if (dbMarker.IconUrl) {
    marker.icon = {
      url: resolveIconUrl(dbMarker.IconUrl),
      width: dbMarker.IconWidth ?? 0,
      height: dbMarker.IconHeight ?? 0,
    };
    if (dbMarker.IconVersion != null) marker.icon.version = dbMarker.IconVersion;
  }

  if (dbMarker.LinkToMarkerIndex != null) {
    marker.linkToMarker = dbMarker.LinkToMarkerIndex;
  }

  if (dbMarker.AnchorPositionTop != null && dbMarker.AnchorPositionLeft != null) {
    marker.anchorPosition = {
      left: dbMarker.AnchorPositionLeft,
      top: dbMarker.AnchorPositionTop,
    };
  }

  if (dbMarker.LngLatJson) {
    const ll = safeJsonParse(dbMarker.LngLatJson, null);
    if (ll) marker.lngLat = ll;
  }

  if (dbMarker.ConnectionLineJson) {
    const cl = safeJsonParse(dbMarker.ConnectionLineJson, null);
    if (cl) marker.connectionLine = cl;
  }

  if (dbMarker.HoverTitle || dbMarker.HoverIconUrl) {
    marker.hover = transformMarkerState(
      dbMarker.HoverTitle, dbMarker.HoverTitleVisible,
      dbMarker.HoverIconUrl, dbMarker.HoverIconVersion,
      dbMarker.HoverIconWidth, dbMarker.HoverIconHeight,
      dbMarker.HoverScale, Boolean(dbMarker.KeepScale),
    );
  }

  if (dbMarker.SelectedTitle || dbMarker.SelectedIconUrl) {
    marker.selected = transformMarkerState(
      dbMarker.SelectedTitle, dbMarker.SelectedTitleVisible,
      dbMarker.SelectedIconUrl, dbMarker.SelectedIconVersion,
      dbMarker.SelectedIconWidth, dbMarker.SelectedIconHeight,
      dbMarker.SelectedScale, Boolean(dbMarker.KeepScale),
    );
  }

  if (dbMarker.Logo != null) {
    const logoMap: Record<number, string> = { 0: 'Aldar', 1: 'LondonSquare' };
    if (logoMap[dbMarker.Logo]) marker.logo = logoMap[dbMarker.Logo];
  }

  return marker;
}

function transformBackplate(dbBp: any, cdnBase: string): any {
  return {
    backplateUrl: resolveUrl(dbBp.Url, cdnBase),
    version: dbBp.Version ?? 1,
    width: dbBp.Width ?? 0,
    height: dbBp.Height ?? 0,
    videoLoopEnabled: Boolean(dbBp.VideoLoopEnabled),
    videoAutoplay: Boolean(dbBp.VideoAutoplay),
    showVideoControls: Boolean(dbBp.ShowVideoControls),
    backplateFormat: BackplateFormatMap[dbBp.Type ?? 0] || 'Image',
    theme: BackplateThemeMap[dbBp.Theme ?? 0] || 'Day',
    thumbnailUrl: resolveUrl(dbBp.ThumbnailUrl, cdnBase),
    thumbnailVersion: dbBp.ThumbnailVersion ?? 1,
    thumbnailWidth: dbBp.ThumbnailWidth ?? 0,
    thumbnailHeight: dbBp.ThumbnailHeight ?? 0,
    lngLat: safeJsonParse(dbBp.LngLatJson, undefined),
    lngLatBounds: safeJsonParse(dbBp.LngLatBoundsJson, undefined),
    minZoomLevel: dbBp.MinZoomLevel ?? 0,
    maxZoomLevel: dbBp.MaxZoomLevel ?? 0,
  };
}

function transformLayout(dbLayout: any, cdnBase: string): any {
  const backplates = (dbLayout.Backplates || [])
    .sort((a: any, b: any) => (a.Theme ?? 0) - (b.Theme ?? 0))
    .map((bp: any) => transformBackplate(bp, cdnBase));

  // Primary backplate: first backplate or synthesized from layout fields
  const primaryBackplate = backplates[0] || {
    backplateUrl: resolveUrl(dbLayout.BackplateUrl, cdnBase),
    version: dbLayout.BackplateVersion ?? 1,
    width: dbLayout.BackplateWidth ?? 0,
    height: dbLayout.BackplateHeight ?? 0,
    videoLoopEnabled: Boolean(dbLayout.VideoLoopEnabled),
    videoAutoplay: Boolean(dbLayout.VideoAutoplay),
    showVideoControls: Boolean(dbLayout.ShowVideoControls),
    backplateFormat: BackplateFormatMap[dbLayout.BackplateFormat ?? 0] || 'Image',
    theme: 'Day',
    thumbnailUrl: resolveUrl(dbLayout.BackplateThumbnailUrl, cdnBase),
    thumbnailVersion: dbLayout.BackplateThumbnailVersion ?? 1,
    thumbnailWidth: dbLayout.BackplateThumbnailWidth ?? 0,
    thumbnailHeight: dbLayout.BackplateThumbnailHeight ?? 0,
  };

  // Markers grouped by kind (WebApp expects Record<MarkerType, Marker[]>)
  const markersRaw = (dbLayout.Markers || [])
    .sort((a: any, b: any) => (a.MarkerIndex ?? 0) - (b.MarkerIndex ?? 0))
    .map(transformMarker);

  const markersByKind: Record<string, any[]> = {};
  for (const m of markersRaw) {
    if (!markersByKind[m.kind]) markersByKind[m.kind] = [];
    markersByKind[m.kind].push(m);
  }

  const desktopTransform = safeJsonParse(dbLayout.DesktopTransformSettingsJson, {
    disabled: false,
    minScale: 1,
    maxScale: 12,
    ui: { hideZoomControls: false },
  });
  const mobileTransform = safeJsonParse(dbLayout.MobileTransformSettingsJson, {
    disabled: false,
    minScale: 1,
    maxScale: 12,
    ui: { hideZoomControls: false },
  });

  const markerConnectionSettings = safeJsonParse(dbLayout.MarkerConnectionSettings, { connections: [] });
  const northBearing = dbLayout.NorthBearing ? Number(dbLayout.NorthBearing) || undefined : undefined;

  return {
    id: dbLayout.Id,
    displayOrder: dbLayout.DisplayOrder ?? 0,
    displayName: dbLayout.DisplayName || '',
    isDefault: Boolean(dbLayout.IsDefault),
    hasCallbackWindow: Boolean(dbLayout.HasCallbackWindow),
    backplate: primaryBackplate,
    backplates,
    backplateThumbnail: primaryBackplate,
    markers: Object.keys(markersByKind).length > 0 ? markersByKind : undefined,
    geoLayers: [],
    focusedMarkerId: dbLayout.FocusedMarkerId ?? -1,
    desktopTransformSettings: desktopTransform,
    mobileTransformSettings: mobileTransform,
    markerConnectionSettings,
    thumbnails: {},
    northBearing,
    toTransitions: new Map(),
    overlays: (dbLayout.Overlays || []).map((o: any) => ({
      url: resolveUrl(o.Url, cdnBase),
      version: o.Version ?? 1,
      type: o.Type || 'Project',
    })),
  };
}

export function transformDbToWebAppViewConfig(dbViewConfig: any): any {
  const cdnBase = dbViewConfig.CdnBaseUrl || '';
  const kind = ViewTypeNameMap[dbViewConfig.Kind] || 'Project';

  const layouts = (dbViewConfig.Layout2Ds || [])
    .sort((a: any, b: any) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
    .map((l: any) => transformLayout(l, cdnBase));

  const defaultIdx = layouts.findIndex((l: any) => l.isDefault);

  return {
    id: dbViewConfig.Id,
    kind,
    code: dbViewConfig.Code || '',
    title: dbViewConfig.Title || '',
    subtitle: dbViewConfig.Subtitle || '',
    mapLayouts: layouts,
    contentHash: '',
    navigations: (dbViewConfig.Navigations || [])
      .sort((a: any, b: any) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0))
      .map((n: any) => ({
        displayName: n.DisplayName || '',
        displaySubName: n.DisplaySubName || '',
        displayOrder: n.DisplayOrder ?? 0,
        cardImageUrl: n.CardImageUrl || '',
        isPriority: Boolean(n.IsPriority),
        navigationUrl: n.NavigationUrl || '',
      })),
    hasGallery: Boolean(dbViewConfig.HasGallery),
    galleryItems: [],
    defaultMapLayoutIndex: defaultIdx >= 0 ? defaultIdx : 0,
  };
}

/**
 * Generates the WebApp URL path for a ViewConfig based on its Kind and Code.
 * This is what would appear in the address bar when viewing this page in the WebApp.
 */
export function generateWebAppPath(kind: number, code: string): string {
  if (!code) return '/';

  switch (kind) {
    case 1: // Nation
      return `/${code}`;
    case 2: { // City
      // Code pattern: cityCode (city is nested under nation, but we can't know nation from code alone)
      return `/<nation>/${code}`;
    }
    case 3: { // Project
      // Code pattern: projectCode
      return `/<nation>/<city>/${code}`;
    }
    case 4: { // Cluster
      // Code pattern: projectCode_clusterCode
      const parts = code.split('_');
      const projectCode = parts[0] || code;
      const clusterCode = parts.slice(1).join('_') || code;
      return `/<nation>/<city>/${projectCode}/${clusterCode}`;
    }
    case 5: { // Amenity
      const parts = code.split('_');
      const projectCode = parts[0] || code;
      const amenityCode = parts.slice(1).join('_') || code;
      return `/<nation>/<city>/${projectCode}/amenity/${amenityCode}`;
    }
    default:
      return `/${code}`;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
