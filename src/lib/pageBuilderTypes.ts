import { v4 as uuidv4 } from 'uuid';

/**
 * Draft model for the Visual Page Builder.
 *
 * Field names intentionally match the Prisma column names 1:1 (PascalCase) so a draft entity can be
 * turned into an INSERT row by spreading it (minus the local-only child arrays) and adding the FK.
 * See `sqlBuilder.ts`. Theme convention: 0 = light, 1 = dark.
 */

// ---------------------------------------------------------------------------------------------
// Backplate (table "Backplates")
// ---------------------------------------------------------------------------------------------
export interface BackplateDraft {
  Id: string;
  Url: string;
  Version: number;
  Width: number;
  Height: number;
  Type: number;
  Theme: number; // 0 = light, 1 = dark
  LngLatJson: string;
  LngLatBoundsJson: string;
  MinZoomLevel: number;
  MaxZoomLevel: number;
  VideoLoopEnabled: boolean;
  VideoAutoplay: boolean;
  ShowVideoControls: boolean;
  ThumbnailUrl: string | null;
  ThumbnailVersion: number | null;
  ThumbnailWidth: number | null;
  ThumbnailHeight: number | null;
}

// ---------------------------------------------------------------------------------------------
// Marker (table "Markers")
// ---------------------------------------------------------------------------------------------
export interface MarkerDraft {
  Id: string;
  Kind: number;
  SubType: number | null;
  MarkerIndex: number;
  Code: string;
  IsVisible: boolean;
  IsExplorable: boolean;
  NavigateTo: string | null;
  IsShallowLink: boolean;
  PositionTop: number;
  PositionLeft: number;
  KeepScale: boolean;
  LngLatJson: string;
  ConnectionLineJson: string;
  Scale: number;
  MinZoom: number;
  MaxZoom: number;
  MobileScale: number;
  MobileMinZoom: number;
  MobileMaxZoom: number;
  LinkToMarkerIndex: number | null;
  AnchorPositionTop: number | null;
  AnchorPositionLeft: number | null;
  HoverTitle: string | null;
  HoverTitleVisible: boolean | null;
  HoverIconUrl: string | null;
  HoverIconVersion: number | null;
  HoverIconWidth: number | null;
  HoverIconHeight: number | null;
  HoverScale: number | null;
  SelectedTitle: string | null;
  SelectedTitleVisible: boolean | null;
  SelectedIconUrl: string | null;
  SelectedIconVersion: number | null;
  SelectedIconWidth: number | null;
  SelectedIconHeight: number | null;
  SelectedScale: number | null;
  Title: string;
  TitleVisible: boolean;
  IconUrl: string | null;
  IconVersion: number | null;
  IconWidth: number | null;
  IconHeight: number | null;
  Version: number | null;
  IsPriority: boolean | null;
  Logo: number | null;
}

// ---------------------------------------------------------------------------------------------
// Layout2D (table "Layout2Ds")
// ---------------------------------------------------------------------------------------------
export interface LayoutDraft {
  Id: string;
  IsDefault: boolean;
  DisplayName: string;
  DisplayOrder: number;
  DesktopTransformSettingsJson: string;
  MobileTransformSettingsJson: string;
  BackplateUrl: string;
  BackplateVersion: number;
  BackplateWidth: number;
  BackplateHeight: number;
  VideoLoopEnabled: boolean;
  VideoAutoplay: boolean;
  ShowVideoControls: boolean;
  BackplateFormat: number;
  NorthBearing: string;
  BackplateThumbnailUrl: string | null;
  BackplateThumbnailVersion: number | null;
  BackplateThumbnailWidth: number | null;
  BackplateThumbnailHeight: number | null;
  HasCallbackWindow: boolean;
  MarkerConnectionSettings: string;
  FocusedMarkerId: number;
  // Local-only children (not columns on Layout2Ds)
  backplates: BackplateDraft[];
  markers: MarkerDraft[];
}

// ---------------------------------------------------------------------------------------------
// ViewConfig (table "ViewConfigs")
// ---------------------------------------------------------------------------------------------
/** The parent entity a ViewConfig links to. The tool cannot infer this id, so it is entered manually. */
export type ParentLinkField =
  | 'ProjectId'
  | 'ClusterId'
  | 'CityId'
  | 'NationId'
  | 'AmenityId'
  | 'UnitId';

export interface PageDraft {
  Id: string;
  Kind: number; // ViewTypes enum value
  Code: string;
  Title: string;
  Subtitle: string;
  CdnBaseUrl: string;
  HasGallery: boolean;
  ParentLinkField: ParentLinkField;
  ParentLinkId: string; // empty = omit the FK column from the generated INSERT
  layouts: LayoutDraft[];
}

// ---------------------------------------------------------------------------------------------
// Factories — defaults mirror the schema's @default(...) values.
// ---------------------------------------------------------------------------------------------
export function newBackplate(theme = 0): BackplateDraft {
  return {
    Id: uuidv4(),
    Url: '',
    Version: 1,
    Width: 0,
    Height: 0,
    Type: 0,
    Theme: theme,
    LngLatJson: '',
    LngLatBoundsJson: '',
    MinZoomLevel: 0,
    MaxZoomLevel: 0,
    VideoLoopEnabled: false,
    VideoAutoplay: false,
    ShowVideoControls: false,
    ThumbnailUrl: '',
    ThumbnailVersion: 1,
    ThumbnailWidth: null,
    ThumbnailHeight: null,
  };
}

export function newMarker(
  markerIndex: number,
  positionLeft = 50,
  positionTop = 50,
): MarkerDraft {
  return {
    Id: uuidv4(),
    Kind: 0,
    SubType: null,
    MarkerIndex: markerIndex,
    Code: '',
    IsVisible: true,
    IsExplorable: true,
    NavigateTo: '',
    IsShallowLink: false,
    PositionTop: positionTop,
    PositionLeft: positionLeft,
    KeepScale: false,
    LngLatJson: '',
    ConnectionLineJson: '',
    Scale: 100,
    MinZoom: 0.0,
    MaxZoom: 2.5,
    MobileScale: 100,
    MobileMinZoom: 0.0,
    MobileMaxZoom: 2.5,
    LinkToMarkerIndex: null,
    AnchorPositionTop: null,
    AnchorPositionLeft: null,
    HoverTitle: null,
    HoverTitleVisible: null,
    HoverIconUrl: null,
    HoverIconVersion: null,
    HoverIconWidth: null,
    HoverIconHeight: null,
    HoverScale: null,
    SelectedTitle: null,
    SelectedTitleVisible: null,
    SelectedIconUrl: null,
    SelectedIconVersion: null,
    SelectedIconWidth: null,
    SelectedIconHeight: null,
    SelectedScale: null,
    Title: '',
    TitleVisible: true,
    IconUrl: '',
    IconVersion: 1,
    IconWidth: null,
    IconHeight: null,
    Version: null,
    IsPriority: null,
    Logo: null,
  };
}

export function newLayout(displayOrder: number, isDefault = false): LayoutDraft {
  return {
    Id: uuidv4(),
    IsDefault: isDefault,
    DisplayName: `Layout ${displayOrder + 1}`,
    DisplayOrder: displayOrder,
    DesktopTransformSettingsJson: '',
    MobileTransformSettingsJson: '',
    BackplateUrl: '',
    BackplateVersion: 1,
    BackplateWidth: 0,
    BackplateHeight: 0,
    VideoLoopEnabled: false,
    VideoAutoplay: false,
    ShowVideoControls: false,
    BackplateFormat: 0,
    NorthBearing: '',
    BackplateThumbnailUrl: '',
    BackplateThumbnailVersion: 1,
    BackplateThumbnailWidth: null,
    BackplateThumbnailHeight: null,
    HasCallbackWindow: false,
    MarkerConnectionSettings: '',
    FocusedMarkerId: -1,
    backplates: [],
    markers: [],
  };
}

export function newPageDraft(): PageDraft {
  return {
    Id: uuidv4(),
    Kind: 3, // ViewTypes.Project
    Code: '',
    Title: '',
    Subtitle: '',
    CdnBaseUrl: '',
    HasGallery: false,
    ParentLinkField: 'ProjectId',
    ParentLinkId: '',
    layouts: [newLayout(0, true)],
  };
}

// ---------------------------------------------------------------------------------------------
// DB row -> Draft mappers (used by the load-existing API response).
// Rows arrive with the exact column names, so we coerce them through the factories to guarantee
// every draft field is present even if the DB omitted a nullable/optional column.
// ---------------------------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
export function backplateFromRow(row: any): BackplateDraft {
  return { ...newBackplate(row.Theme ?? 0), ...row, Id: row.Id };
}

export function markerFromRow(row: any): MarkerDraft {
  return { ...newMarker(row.MarkerIndex ?? 0), ...row, Id: row.Id };
}

export function layoutFromRow(row: any): LayoutDraft {
  const base = newLayout(row.DisplayOrder ?? 0, row.IsDefault ?? false);
  return {
    ...base,
    ...row,
    Id: row.Id,
    backplates: Array.isArray(row.Backplates) ? row.Backplates.map(backplateFromRow) : [],
    markers: Array.isArray(row.Markers) ? row.Markers.map(markerFromRow) : [],
  };
}

export function pageFromRow(row: any): PageDraft {
  const base = newPageDraft();
  const parent = detectParentLink(row);
  return {
    ...base,
    Id: row.Id,
    Kind: row.Kind ?? base.Kind,
    Code: row.Code ?? '',
    Title: row.Title ?? '',
    Subtitle: row.Subtitle ?? '',
    CdnBaseUrl: row.CdnBaseUrl ?? '',
    HasGallery: row.HasGallery ?? false,
    ParentLinkField: parent.field,
    ParentLinkId: parent.id,
    layouts: Array.isArray(row.Layout2Ds) && row.Layout2Ds.length
      ? row.Layout2Ds.map(layoutFromRow)
      : base.layouts,
  };
}

export function clonePageDraft(source: PageDraft): PageDraft {
  const newPageId = uuidv4();
  return {
    ...source,
    Id: newPageId,
    layouts: source.layouts.map((layout) => {
      const newLayoutId = uuidv4();
      return {
        ...layout,
        Id: newLayoutId,
        backplates: layout.backplates.map((bp) => ({ ...bp, Id: uuidv4() })),
        markers: layout.markers.map((mk) => ({ ...mk, Id: uuidv4() })),
      };
    }),
  };
}

function detectParentLink(row: any): { field: ParentLinkField; id: string } {
  const fields: ParentLinkField[] = [
    'ProjectId',
    'ClusterId',
    'CityId',
    'NationId',
    'AmenityId',
    'UnitId',
  ];
  for (const field of fields) {
    if (row[field]) return { field, id: String(row[field]) };
  }
  return { field: 'ProjectId', id: '' };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
