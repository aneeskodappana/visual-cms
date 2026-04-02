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

function buildBulkInsert(table: string, columns: string[], rows: SqlValue[][], onConflict?: string): string {
  if (rows.length === 0) return '';
  const colList = columns.map((c) => `"${c}"`).join(', ');
  const valueRows = rows.map((row) => `  (${row.map(toSqlValue).join(', ')})`).join(',\n');
  const conflict = onConflict ? `\n${onConflict}` : '';
  return `INSERT INTO "${table}" (${colList})\nVALUES\n${valueRows}${conflict};\n`;
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

function generateVideoTransitionInserts(viewConfigs: any[]): string {
  const columns = [
    'Id', 'FromLayout2dId', 'ToLayout2dId', 'FromLayout3dId', 'ToLayout3dId',
    'MediaUrl', 'Theme', 'Version',
  ];
  const rows: SqlValue[][] = [];
  for (const vc of viewConfigs) {
    for (const l2d of vc.Layout2Ds || []) {
      for (const vt of l2d.FromTransitions || []) {
        rows.push([
          vt.Id, vt.FromLayout2dId ?? l2d.Id, vt.ToLayout2dId,
          vt.FromLayout3dId, vt.ToLayout3dId,
          vt.MediaUrl, vt.Theme, vt.Version,
        ]);
      }
      for (const vt of l2d.ToTransitions || []) {
        rows.push([
          vt.Id, vt.FromLayout2dId, vt.ToLayout2dId ?? l2d.Id,
          vt.FromLayout3dId, vt.ToLayout3dId,
          vt.MediaUrl, vt.Theme, vt.Version,
        ]);
      }
    }
    const l3d = vc.Layout3D;
    if (l3d) {
      for (const vt of l3d.FromTransitions || []) {
        rows.push([
          vt.Id, vt.FromLayout2dId, vt.ToLayout2dId,
          vt.FromLayout3dId ?? l3d.Id, vt.ToLayout3dId,
          vt.MediaUrl, vt.Theme, vt.Version,
        ]);
      }
      for (const vt of l3d.ToTransitions || []) {
        rows.push([
          vt.Id, vt.FromLayout2dId, vt.ToLayout2dId,
          vt.FromLayout3dId, vt.ToLayout3dId ?? l3d.Id,
          vt.MediaUrl, vt.Theme, vt.Version,
        ]);
      }
    }
  }
  return buildBulkInsert('VideoTransitions', columns, rows);
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
    { label: 'VideoTransitions', fn: generateVideoTransitionInserts },
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

// ============ Unit SQL Export ============

function generateUnitInserts(units: any[]): string {
  const columns = [
    'Id', 'Code', 'Title', 'IsVisible', 'IsExplorable',
    'UnitType', 'UnitStatus', 'UnitCategory', 'FeatureSpecification',
    'IsPremium', 'SaleableArea', 'BalconyArea', 'PlotArea', 'PaymentPlan', 'Price',
    'OnlineStatus', 'LocationId', 'DownPaymentPercentage', 'DisableUnit',
    'ClusterName', 'BedroomCount', 'BathroomCount', 'UnitNumber',
    'Plex', 'Mirror', 'DefaultFloor', 'FloorsOccupied', 'NorthBearing',
    'IsFurnished', 'SalesAgentId', 'HasInterior', 'HasFloorplan', 'DisplayName',
    'IsShowHome', 'HasUniqueView', 'EnableForKiosk',
    'UnitVariantId', 'PropertyFloorId',
  ];
  const rows = units.map((u) => [
    u.Id, u.Code, u.Title, u.IsVisible, u.IsExplorable,
    u.UnitType, u.UnitStatus, u.UnitCategory, u.FeatureSpecification,
    u.IsPremium, u.SaleableArea, u.BalconyArea, u.PlotArea, u.PaymentPlan, u.Price,
    u.OnlineStatus, u.LocationId, u.DownPaymentPercentage, u.DisableUnit,
    u.ClusterName, u.BedroomCount, u.BathroomCount, u.UnitNumber,
    u.Plex, u.Mirror, u.DefaultFloor, u.FloorsOccupied, u.NorthBearing,
    u.IsFurnished, u.SalesAgentId, u.HasInterior, u.HasFloorplan, u.DisplayName,
    u.IsShowHome, u.HasUniqueView, u.EnableForKiosk,
    u.UnitVariantId, u.PropertyFloorId,
  ]);
  return buildBulkInsert('Units', columns, rows);
}

function generateUnitVariantInserts(units: any[]): string {
  const columns = ['Id', 'Code', 'Title'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const uv = u.UnitVariant;
    if (!uv || seen.has(uv.Id)) continue;
    seen.add(uv.Id);
    rows.push([uv.Id, uv.Code, uv.Title]);
  }
  return buildBulkInsert('UnitVariants', columns, rows, 'ON CONFLICT ("Code") DO NOTHING');
}

function generateUnitVariantExteriorInsertsFromUnits(units: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'UnitVariantId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const uv = u.UnitVariant;
    if (!uv) continue;
    for (const uve of uv.UnitVariantExteriors || []) {
      if (seen.has(uve.Id)) continue;
      seen.add(uve.Id);
      rows.push([uve.Id, uve.Code, uve.Title, uve.IsVisible, uve.IsExplorable, uve.UnitVariantId ?? uv.Id]);
    }
  }
  return buildBulkInsert('UnitVariantExteriors', columns, rows);
}

function generateUnitVariantFloorInsertsFromUnits(units: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'UnitVariantId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const uv = u.UnitVariant;
    if (!uv) continue;
    for (const uvf of uv.UnitVariantFloors || []) {
      if (seen.has(uvf.Id)) continue;
      seen.add(uvf.Id);
      rows.push([uvf.Id, uvf.Code, uvf.Title, uvf.IsVisible, uvf.IsExplorable, uvf.UnitVariantId ?? uv.Id]);
    }
  }
  return buildBulkInsert('UnitVariantFloors', columns, rows);
}

function generateUnitVariantInteriorInsertsFromUnits(units: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'UnitVariantId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const uv = u.UnitVariant;
    if (!uv) continue;
    for (const uvi of uv.UnitVariantInteriors || []) {
      if (seen.has(uvi.Id)) continue;
      seen.add(uvi.Id);
      rows.push([uvi.Id, uvi.Code, uvi.Title, uvi.IsVisible, uvi.IsExplorable, uvi.UnitVariantId ?? uv.Id]);
    }
  }
  return buildBulkInsert('UnitVariantInteriors', columns, rows);
}

function generatePropertyFloorInsertsFromUnits(units: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'PropertyId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const pf = u.PropertyFloor;
    if (!pf || seen.has(pf.Id)) continue;
    seen.add(pf.Id);
    rows.push([pf.Id, pf.Code, pf.Title, pf.IsVisible, pf.IsExplorable, pf.PropertyId]);
  }
  return buildBulkInsert('PropertyFloors', columns, rows);
}

function generatePropertyInsertsFromUnits(units: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'CommunityName', 'ClusterId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const u of units) {
    const prop = u.PropertyFloor?.Property;
    if (!prop || seen.has(prop.Id)) continue;
    seen.add(prop.Id);
    rows.push([prop.Id, prop.Code, prop.Title, prop.IsVisible, prop.IsExplorable, prop.CommunityName, prop.ClusterId]);
  }
  return buildBulkInsert('Properties', columns, rows);
}

export function generateUnitInsertSql(selectedUnits: any[]): string {
  if (selectedUnits.length === 0) return '';

  const parts: string[] = [];
  const unitCodes = selectedUnits.map((u) => u.Code).join(', ');

  parts.push(`-- SQL Export for ${selectedUnits.length} Unit(s): ${unitCodes}`);
  parts.push(`-- Generated at: ${new Date().toISOString()}`);
  parts.push('');
  parts.push('BEGIN;');
  parts.push('');

  const generators = [
    { label: 'UnitVariants', fn: generateUnitVariantInserts },
    { label: 'UnitVariantExteriors', fn: generateUnitVariantExteriorInsertsFromUnits },
    { label: 'UnitVariantFloors', fn: generateUnitVariantFloorInsertsFromUnits },
    { label: 'UnitVariantInteriors', fn: generateUnitVariantInteriorInsertsFromUnits },
    { label: 'Properties', fn: generatePropertyInsertsFromUnits },
    { label: 'PropertyFloors', fn: generatePropertyFloorInsertsFromUnits },
    { label: 'Units', fn: generateUnitInserts },
  ];

  for (const { label, fn } of generators) {
    const sql = fn(selectedUnits);
    if (sql) {
      parts.push(`-- ${label}`);
      parts.push(sql);
    }
  }

  parts.push('COMMIT;');
  parts.push('');

  return parts.join('\n');
}

// ============ Project SQL Export ============

function generateProjectInserts(projects: any[]): string {
  const columns = [
    'Id', 'Code', 'MulesoftCode', 'CommunityKey', 'Title', 'IsVisible', 'IsExplorable', 'CityId',
  ];
  const rows = projects.map((p) => [
    p.Id, p.Code, p.MulesoftCode, p.CommunityKey, p.Title, p.IsVisible, p.IsExplorable, p.CityId,
  ]);
  return buildBulkInsert('Projects', columns, rows);
}

function generateCityInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'NationId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    const city = p.City;
    if (!city || seen.has(city.Id)) continue;
    seen.add(city.Id);
    rows.push([city.Id, city.Code, city.Title, city.IsVisible, city.IsExplorable, city.NationId]);
  }
  return buildBulkInsert('Cities', columns, rows);
}

function generateNationInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    const nation = p.City?.Nation;
    if (!nation || seen.has(nation.Id)) continue;
    seen.add(nation.Id);
    rows.push([nation.Id, nation.Code, nation.Title, nation.IsVisible, nation.IsExplorable]);
  }
  return buildBulkInsert('Nations', columns, rows);
}

function generateClusterInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'ProjectId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const c of p.Clusters || []) {
      if (seen.has(c.Id)) continue;
      seen.add(c.Id);
      rows.push([c.Id, c.Code, c.Title, c.IsVisible, c.IsExplorable, c.ProjectId ?? p.Id]);
    }
  }
  return buildBulkInsert('Clusters', columns, rows);
}

function generatePropertyInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'CommunityName', 'ClusterId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const c of p.Clusters || []) {
      for (const prop of c.Properties || []) {
        if (seen.has(prop.Id)) continue;
        seen.add(prop.Id);
        rows.push([prop.Id, prop.Code, prop.Title, prop.IsVisible, prop.IsExplorable, prop.CommunityName, prop.ClusterId ?? c.Id]);
      }
    }
  }
  return buildBulkInsert('Properties', columns, rows);
}

function generatePropertyFloorInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'PropertyId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const c of p.Clusters || []) {
      for (const prop of c.Properties || []) {
        for (const pf of prop.PropertyFloors || []) {
          if (seen.has(pf.Id)) continue;
          seen.add(pf.Id);
          rows.push([pf.Id, pf.Code, pf.Title, pf.IsVisible, pf.IsExplorable, pf.PropertyId ?? prop.Id]);
        }
      }
    }
  }
  return buildBulkInsert('PropertyFloors', columns, rows);
}

function generateUnitInsertsFromProjects(projects: any[]): string {
  const columns = [
    'Id', 'Code', 'Title', 'IsVisible', 'IsExplorable',
    'UnitType', 'UnitStatus', 'UnitCategory', 'FeatureSpecification',
    'IsPremium', 'SaleableArea', 'BalconyArea', 'PlotArea', 'PaymentPlan', 'Price',
    'OnlineStatus', 'LocationId', 'DownPaymentPercentage', 'DisableUnit',
    'ClusterName', 'BedroomCount', 'BathroomCount', 'UnitNumber',
    'Plex', 'Mirror', 'DefaultFloor', 'FloorsOccupied', 'NorthBearing',
    'IsFurnished', 'SalesAgentId', 'HasInterior', 'HasFloorplan', 'DisplayName',
    'IsShowHome', 'HasUniqueView', 'EnableForKiosk',
    'UnitVariantId', 'PropertyFloorId',
  ];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const c of p.Clusters || []) {
      for (const prop of c.Properties || []) {
        for (const pf of prop.PropertyFloors || []) {
          for (const u of pf.Units || []) {
            if (seen.has(u.Id)) continue;
            seen.add(u.Id);
            rows.push([
              u.Id, u.Code, u.Title, u.IsVisible, u.IsExplorable,
              u.UnitType, u.UnitStatus, u.UnitCategory, u.FeatureSpecification,
              u.IsPremium, u.SaleableArea, u.BalconyArea, u.PlotArea, u.PaymentPlan, u.Price,
              u.OnlineStatus, u.LocationId, u.DownPaymentPercentage, u.DisableUnit,
              u.ClusterName, u.BedroomCount, u.BathroomCount, u.UnitNumber,
              u.Plex, u.Mirror, u.DefaultFloor, u.FloorsOccupied, u.NorthBearing,
              u.IsFurnished, u.SalesAgentId, u.HasInterior, u.HasFloorplan, u.DisplayName,
              u.IsShowHome, u.HasUniqueView, u.EnableForKiosk,
              u.UnitVariantId, u.PropertyFloorId ?? pf.Id,
            ]);
          }
        }
      }
    }
  }
  return buildBulkInsert('Units', columns, rows);
}

function generateAmenityInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'ProjectId', 'ClusterId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const a of p.Amenities || []) {
      if (seen.has(a.Id)) continue;
      seen.add(a.Id);
      rows.push([a.Id, a.Code, a.Title, a.IsVisible, a.IsExplorable, a.ProjectId ?? p.Id, a.ClusterId]);
    }
    for (const c of p.Clusters || []) {
      for (const a of c.Amenities || []) {
        if (seen.has(a.Id)) continue;
        seen.add(a.Id);
        rows.push([a.Id, a.Code, a.Title, a.IsVisible, a.IsExplorable, a.ProjectId, a.ClusterId ?? c.Id]);
      }
    }
  }
  return buildBulkInsert('Amenities', columns, rows);
}

function generateParkingFloorplanInsertsFromProjects(projects: any[]): string {
  const columns = ['Id', 'Code', 'Title', 'IsVisible', 'IsExplorable', 'ClusterId'];
  const seen = new Set<string>();
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    for (const c of p.Clusters || []) {
      for (const pf of c.ParkingFloorplans || []) {
        if (seen.has(pf.Id)) continue;
        seen.add(pf.Id);
        rows.push([pf.Id, pf.Code, pf.Title, pf.IsVisible, pf.IsExplorable, pf.ClusterId ?? c.Id]);
      }
    }
  }
  return buildBulkInsert('ParkingFloorplans', columns, rows);
}

function generateProjectCacheInfoInserts(projects: any[]): string {
  const columns = ['Id', 'MulesoftDataKey', 'ProcessedDataKey', 'ProjectId'];
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    const ci = p.CacheInfo;
    if (!ci) continue;
    rows.push([ci.Id, ci.MulesoftDataKey, ci.ProcessedDataKey, ci.ProjectId ?? p.Id]);
  }
  return buildBulkInsert('ProjectCacheInfo', columns, rows);
}

function generateProjectSalesLeadInfoInserts(projects: any[]): string {
  const columns = [
    'Id', 'LeadSource', 'EnquiryCategory', 'EnquiryTrigger', 'SalesType',
    'PropertyUsage', 'ProjectName', 'OfferDomestic', 'OfferInternational', 'ProjectId',
  ];
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    const sli = p.ProjectSalesLeadInfo;
    if (!sli) continue;
    rows.push([
      sli.Id, sli.LeadSource, sli.EnquiryCategory, sli.EnquiryTrigger, sli.SalesType,
      sli.PropertyUsage, sli.ProjectName, sli.OfferDomestic, sli.OfferInternational,
      sli.ProjectId ?? p.Id,
    ]);
  }
  return buildBulkInsert('ProjectSalesLeadInfo', columns, rows);
}

function generateProjectVariantsInfoInserts(projects: any[]): string {
  const columns = ['Id', 'UnitVariantTypes', 'ProjectId'];
  const rows: SqlValue[][] = [];
  for (const p of projects) {
    const vi = p.VariantInfo;
    if (!vi) continue;
    rows.push([vi.Id, vi.UnitVariantTypes, vi.ProjectId ?? p.Id]);
  }
  return buildBulkInsert('ProjectVariantsInfo', columns, rows);
}

export function generateProjectInsertSql(selectedProjects: any[]): string {
  if (selectedProjects.length === 0) return '';

  const parts: string[] = [];
  const projectCodes = selectedProjects.map((p) => p.Code).join(', ');

  parts.push(`-- SQL Export for ${selectedProjects.length} Project(s): ${projectCodes}`);
  parts.push(`-- Generated at: ${new Date().toISOString()}`);
  parts.push('');
  parts.push('BEGIN;');
  parts.push('');

  const generators = [
    { label: 'Projects', fn: generateProjectInserts },
    { label: 'ProjectCacheInfo', fn: generateProjectCacheInfoInserts },
    { label: 'ProjectSalesLeadInfo', fn: generateProjectSalesLeadInfoInserts },
    { label: 'ProjectVariantsInfo', fn: generateProjectVariantsInfoInserts },
    { label: 'Clusters', fn: generateClusterInsertsFromProjects },
    { label: 'Amenities', fn: generateAmenityInsertsFromProjects },
    { label: 'ParkingFloorplans', fn: generateParkingFloorplanInsertsFromProjects },
  ];

  for (const { label, fn } of generators) {
    const sql = fn(selectedProjects);
    if (sql) {
      parts.push(`-- ${label}`);
      parts.push(sql);
    }
  }

  parts.push('COMMIT;');
  parts.push('');

  return parts.join('\n');
}

export function downloadSqlFile(sql: string, prefix: string = 'viewconfig'): void {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\.\d+Z$/, '');
  const filename = `${prefix}_export_${timestamp}.sql`;

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
