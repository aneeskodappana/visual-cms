type SqlValue = string | number | boolean | null | undefined | object;

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function toSqlValue(value: SqlValue): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'object') return `'${escapeSqlString(JSON.stringify(value))}'`;
  return `'${escapeSqlString(String(value))}'`;
}

function toUuidSql(value: string | null | undefined): string {
  if (!value) return 'NULL';
  return `'${escapeSqlString(value)}'::uuid`;
}

function buildBulkInsert(table: string, columns: string[], rows: SqlValue[][]): string {
  if (rows.length === 0) return '';
  const colList = columns.map((c) => `"${c}"`).join(', ');
  const valueRows = rows.map((row) => `  (${row.map(toSqlValue).join(', ')})`).join(',\n');
  return `INSERT INTO "${table}" (${colList})\nVALUES\n${valueRows};\n`;
}

function generateViewConfigInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'Kind', 'Code', 'Title', 'Subtitle', 'HasGallery', 'CdnBaseUrl',
    'NationId', 'CityId', 'ProjectId', 'ClusterId', 'AmenityId', 'UnitId',
    'UnitVariantExteriorId', 'UnitVariantFloorId', 'UnitVariantInteriorId',
    'ParkingFloorplanId', 'ParkingUpgradeId', 'ParkingUpgradeGalleryId',
  ];
  const rows = viewConfigs.map((vc) => [
    vc.Id, vc.Kind, vc.Code, vc.Title, vc.Subtitle, vc.HasGallery, vc.CdnBaseUrl,
    vc.NationId, vc.CityId, vc.ProjectId, vc.ClusterId, vc.AmenityId, vc.UnitId,
    vc.UnitVariantExteriorId, vc.UnitVariantFloorId, vc.UnitVariantInteriorId,
    vc.ParkingFloorplanId, vc.ParkingUpgradeId, vc.ParkingUpgradeGalleryId,
  ]);
  return buildBulkInsert('ViewConfigs', columns, rows);
}

function generateNavigationInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'DisplayName', 'DisplaySubName', 'CardImageUrl',
    'DisplayOrder', 'IsPriority', 'NavigationUrl', 'ViewConfigId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const nav of vc.Navigations || []) {
      rows.push([
        nav.Id, nav.DisplayName, nav.DisplaySubName, nav.CardImageUrl,
        nav.DisplayOrder, nav.IsPriority, nav.NavigationUrl, nav.ViewConfigId ?? vc.Id,
      ]);
    }
  }
  return buildBulkInsert('Navigations', columns, rows);
}

function generateGalleryItemInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'Title', 'IsDefault', 'DisplayOrder', 'MediaUrl',
    'MediaVersion', 'MediaFormat', 'Description', 'Subtitle', 'Code', 'ViewConfigId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const gi of vc.GalleryItems || []) {
      rows.push([
        gi.Id, gi.Title, gi.IsDefault, gi.DisplayOrder, gi.MediaUrl,
        gi.MediaVersion, gi.MediaFormat, gi.Description, gi.Subtitle, gi.Code,
        gi.ViewConfigId ?? vc.Id,
      ]);
    }
  }
  return buildBulkInsert('GalleryItems', columns, rows);
}

function generateLayout3DInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'ModelUrl', 'DefaultHotspotGroupIndex', 'ModelScaleJson', 'ViewConfigId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    const l3d = vc.Layout3D;
    if (!l3d) continue;
    rows.push([
      l3d.Id, l3d.ModelUrl, l3d.DefaultHotspotGroupIndex, l3d.ModelScaleJson,
      l3d.ViewConfigId ?? vc.Id,
    ]);
  }
  return buildBulkInsert('Layout3Ds', columns, rows);
}

function generateHotspotGroupInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'Name', 'HotspotGroupIndex', 'DefaultHotspotIndex',
    'IsVisible', 'IsExplorable', 'Layout3DId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    const l3d = vc.Layout3D;
    if (!l3d) continue;
    for (const hg of l3d.HotspotGroup || []) {
      rows.push([
        hg.Id, hg.Name, hg.HotspotGroupIndex, hg.DefaultHotspotIndex,
        hg.IsVisible, hg.IsExplorable, hg.Layout3DId ?? l3d.Id,
      ]);
    }
  }
  return buildBulkInsert('HotspotGroups', columns, rows);
}

function generateHotspotInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'HotspotIndex', 'IsVisible', 'IsExplorable', 'Name',
    'MediaUrl', 'MediaVersion', 'MediaThumbnailUrl', 'MediaThumbnailVersion',
    'PositionJson', 'OffsetRotationJson', 'DefaultCameraRotationJson',
    'CameraSettingsJson', 'HotspotGroupId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    const l3d = vc.Layout3D;
    if (!l3d) continue;
    for (const hg of l3d.HotspotGroup || []) {
      for (const hs of hg.Hotspots || []) {
        rows.push([
          hs.Id, hs.HotspotIndex, hs.IsVisible, hs.IsExplorable, hs.Name,
          hs.MediaUrl, hs.MediaVersion, hs.MediaThumbnailUrl, hs.MediaThumbnailVersion,
          hs.PositionJson, hs.OffsetRotationJson, hs.DefaultCameraRotationJson,
          hs.CameraSettingsJson, hs.HotspotGroupId ?? hg.Id,
        ]);
      }
    }
  }
  return buildBulkInsert('Hotspots', columns, rows);
}

function generateLayout2DInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'IsDefault', 'DisplayName', 'DisplayOrder',
    'DesktopTransformSettingsJson', 'MobileTransformSettingsJson',
    'BackplateUrl', 'BackplateVersion', 'BackplateWidth', 'BackplateHeight',
    'VideoLoopEnabled', 'VideoAutoplay', 'ShowVideoControls', 'BackplateFormat',
    'NorthBearing', 'BackplateThumbnailUrl', 'BackplateThumbnailVersion',
    'BackplateThumbnailWidth', 'BackplateThumbnailHeight',
    'HasCallbackWindow', 'MarkerConnectionSettings', 'FocusedMarkerId', 'ViewConfigId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      rows.push([
        l2d.Id, l2d.IsDefault, l2d.DisplayName, l2d.DisplayOrder,
        l2d.DesktopTransformSettingsJson, l2d.MobileTransformSettingsJson,
        l2d.BackplateUrl, l2d.BackplateVersion, l2d.BackplateWidth, l2d.BackplateHeight,
        l2d.VideoLoopEnabled, l2d.VideoAutoplay, l2d.ShowVideoControls, l2d.BackplateFormat,
        l2d.NorthBearing, l2d.BackplateThumbnailUrl, l2d.BackplateThumbnailVersion,
        l2d.BackplateThumbnailWidth, l2d.BackplateThumbnailHeight,
        l2d.HasCallbackWindow, l2d.MarkerConnectionSettings, l2d.FocusedMarkerId,
        l2d.ViewConfigId ?? vc.Id,
      ]);
    }
  }
  return buildBulkInsert('Layout2Ds', columns, rows);
}

function generateMarkerInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'Kind', 'SubType', 'MarkerIndex', 'Code',
    'IsVisible', 'IsExplorable', 'NavigateTo', 'IsShallowLink',
    'PositionTop', 'PositionLeft', 'KeepScale',
    'LngLatJson', 'ConnectionLineJson',
    'Scale', 'MinZoom', 'MaxZoom', 'MobileScale', 'MobileMinZoom', 'MobileMaxZoom',
    'LinkToMarkerIndex', 'AnchorPositionTop', 'AnchorPositionLeft',
    'HoverTitle', 'HoverTitleVisible', 'HoverIconUrl', 'HoverIconVersion',
    'HoverIconWidth', 'HoverIconHeight', 'HoverScale',
    'SelectedTitle', 'SelectedTitleVisible', 'SelectedIconUrl', 'SelectedIconVersion',
    'SelectedIconWidth', 'SelectedIconHeight', 'SelectedScale',
    'Title', 'TitleVisible', 'IconUrl', 'IconVersion', 'IconWidth', 'IconHeight',
    'Version', 'IsPriority', 'Logo', 'Layout2DId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const m of l2d.Markers || []) {
        rows.push([
          m.Id, m.Kind, m.SubType, m.MarkerIndex, m.Code,
          m.IsVisible, m.IsExplorable, m.NavigateTo, m.IsShallowLink,
          m.PositionTop, m.PositionLeft, m.KeepScale,
          m.LngLatJson, m.ConnectionLineJson,
          m.Scale, m.MinZoom, m.MaxZoom, m.MobileScale, m.MobileMinZoom, m.MobileMaxZoom,
          m.LinkToMarkerIndex, m.AnchorPositionTop, m.AnchorPositionLeft,
          m.HoverTitle, m.HoverTitleVisible, m.HoverIconUrl, m.HoverIconVersion,
          m.HoverIconWidth, m.HoverIconHeight, m.HoverScale,
          m.SelectedTitle, m.SelectedTitleVisible, m.SelectedIconUrl, m.SelectedIconVersion,
          m.SelectedIconWidth, m.SelectedIconHeight, m.SelectedScale,
          m.Title, m.TitleVisible, m.IconUrl, m.IconVersion, m.IconWidth, m.IconHeight,
          m.Version, m.IsPriority, m.Logo, m.Layout2DId ?? l2d.Id,
        ]);
      }
    }
  }
  return buildBulkInsert('Markers', columns, rows);
}

function generateBackplateInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'Url', 'Version', 'Width', 'Height', 'Type', 'Theme',
    'LngLatJson', 'LngLatBoundsJson', 'MinZoomLevel', 'MaxZoomLevel',
    'VideoLoopEnabled', 'VideoAutoplay', 'ShowVideoControls',
    'ThumbnailUrl', 'ThumbnailVersion', 'ThumbnailWidth', 'ThumbnailHeight',
    'Layout2DId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const bp of l2d.Backplates || []) {
        rows.push([
          bp.Id, bp.Url, bp.Version, bp.Width, bp.Height, bp.Type, bp.Theme,
          bp.LngLatJson, bp.LngLatBoundsJson, bp.MinZoomLevel, bp.MaxZoomLevel,
          bp.VideoLoopEnabled, bp.VideoAutoplay, bp.ShowVideoControls,
          bp.ThumbnailUrl, bp.ThumbnailVersion, bp.ThumbnailWidth, bp.ThumbnailHeight,
          bp.Layout2DId ?? l2d.Id,
        ]);
      }
    }
  }
  return buildBulkInsert('Backplates', columns, rows);
}

function generateOverlayInserts(viewConfigs: any[]): string {
  const columns = ['Id', 'Url', 'Type', 'Version', 'Layout2DId'];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const ov of l2d.Overlays || []) {
        rows.push([ov.Id, ov.Url, ov.Type, ov.Version, ov.Layout2DId ?? l2d.Id]);
      }
    }
  }
  return buildBulkInsert('Overlays', columns, rows);
}

function generateGeoLayerInserts(viewConfigs: any[]): string {
  const columns = ['Id', 'Code', 'Version', 'MinZoom', 'MaxZoom', 'BehaviorJson', 'Layout2DId'];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const gl of l2d.GeoLayers || []) {
        rows.push([gl.Id, gl.Code, gl.Version, gl.MinZoom, gl.MaxZoom, gl.BehaviorJson, gl.Layout2DId ?? l2d.Id]);
      }
    }
  }
  return buildBulkInsert('GeoLayers', columns, rows);
}

function generateGeoLayerDataInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'SourceType', 'SourceLayer', 'CoordinatesJson',
    'Url', 'GeoJsonDataJson', 'GeoLayerStyleJson', 'GeoLayerId',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const gl of l2d.GeoLayers || []) {
        const data = gl.Data;
        if (!data) continue;
        rows.push([
          data.Id, data.SourceType, data.SourceLayer, data.CoordinatesJson,
          data.Url, data.GeoJsonDataJson, data.GeoLayerStyleJson, data.GeoLayerId ?? gl.Id,
        ]);
      }
    }
  }
  return buildBulkInsert('GeoLayerData', columns, rows);
}

export function generateInsertSql(selectedViewConfigs: any[]): string {
  if (selectedViewConfigs.length === 0) return '';

  const parts: string[] = [];
  const vcCodes = selectedViewConfigs.map((vc) => vc.Code).join(', ');

  parts.push(`-- SQL Export for ${selectedViewConfigs.length} ViewConfig(s): ${vcCodes}`);
  parts.push(`-- Generated at: ${new Date().toISOString()}`);
  parts.push('');
  parts.push('BEGIN;');
  parts.push('');

  const generators = [
    { label: 'ViewConfigs', fn: generateViewConfigInserts },
    { label: 'Navigations', fn: generateNavigationInserts },
    { label: 'GalleryItems', fn: generateGalleryItemInserts },
    { label: 'Layout3Ds', fn: generateLayout3DInserts },
    { label: 'HotspotGroups', fn: generateHotspotGroupInserts },
    { label: 'Hotspots', fn: generateHotspotInserts },
    { label: 'Layout2Ds', fn: generateLayout2DInserts },
    { label: 'Markers', fn: generateMarkerInserts },
    { label: 'Backplates', fn: generateBackplateInserts },
    { label: 'Overlays', fn: generateOverlayInserts },
    { label: 'GeoLayers', fn: generateGeoLayerInserts },
    { label: 'GeoLayerData', fn: generateGeoLayerDataInserts },
  ];

  for (const { label, fn } of generators) {
    const sql = fn(selectedViewConfigs);
    if (sql) {
      parts.push(`-- ${label}`);
      parts.push(sql);
    }
  }

  parts.push('COMMIT;');
  parts.push('');

  return parts.join('\n');
}

export function downloadSqlFile(sql: string): void {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, '');
  const filename = `viewconfig_export_${timestamp}.sql`;

  const blob = new Blob([sql], { type: 'application/sql' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
