
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ViewConfigScalarFieldEnum = {
  Id: 'Id',
  Kind: 'Kind',
  Code: 'Code',
  Title: 'Title',
  Subtitle: 'Subtitle',
  HasGallery: 'HasGallery',
  CdnBaseUrl: 'CdnBaseUrl',
  NationId: 'NationId',
  CityId: 'CityId',
  ProjectId: 'ProjectId',
  ClusterId: 'ClusterId',
  AmenityId: 'AmenityId',
  UnitId: 'UnitId',
  UnitVariantExteriorId: 'UnitVariantExteriorId',
  UnitVariantFloorId: 'UnitVariantFloorId',
  UnitVariantInteriorId: 'UnitVariantInteriorId',
  ParkingFloorplanId: 'ParkingFloorplanId',
  ParkingUpgradeId: 'ParkingUpgradeId',
  ParkingUpgradeGalleryId: 'ParkingUpgradeGalleryId'
};

exports.Prisma.Layout2DScalarFieldEnum = {
  Id: 'Id',
  IsDefault: 'IsDefault',
  DisplayName: 'DisplayName',
  DisplayOrder: 'DisplayOrder',
  DesktopTransformSettingsJson: 'DesktopTransformSettingsJson',
  MobileTransformSettingsJson: 'MobileTransformSettingsJson',
  BackplateUrl: 'BackplateUrl',
  BackplateVersion: 'BackplateVersion',
  BackplateWidth: 'BackplateWidth',
  BackplateHeight: 'BackplateHeight',
  VideoLoopEnabled: 'VideoLoopEnabled',
  VideoAutoplay: 'VideoAutoplay',
  ShowVideoControls: 'ShowVideoControls',
  BackplateFormat: 'BackplateFormat',
  NorthBearing: 'NorthBearing',
  BackplateThumbnailUrl: 'BackplateThumbnailUrl',
  BackplateThumbnailVersion: 'BackplateThumbnailVersion',
  BackplateThumbnailWidth: 'BackplateThumbnailWidth',
  BackplateThumbnailHeight: 'BackplateThumbnailHeight',
  HasCallbackWindow: 'HasCallbackWindow',
  MarkerConnectionSettings: 'MarkerConnectionSettings',
  FocusedMarkerId: 'FocusedMarkerId',
  ViewConfigId: 'ViewConfigId'
};

exports.Prisma.Layout3DScalarFieldEnum = {
  Id: 'Id',
  ModelUrl: 'ModelUrl',
  DefaultHotspotGroupIndex: 'DefaultHotspotGroupIndex',
  ModelScaleJson: 'ModelScaleJson',
  ViewConfigId: 'ViewConfigId'
};

exports.Prisma.MarkerScalarFieldEnum = {
  Id: 'Id',
  Kind: 'Kind',
  SubType: 'SubType',
  MarkerIndex: 'MarkerIndex',
  Code: 'Code',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  NavigateTo: 'NavigateTo',
  IsShallowLink: 'IsShallowLink',
  PositionTop: 'PositionTop',
  PositionLeft: 'PositionLeft',
  KeepScale: 'KeepScale',
  LngLatJson: 'LngLatJson',
  ConnectionLineJson: 'ConnectionLineJson',
  Scale: 'Scale',
  MinZoom: 'MinZoom',
  MaxZoom: 'MaxZoom',
  MobileScale: 'MobileScale',
  MobileMinZoom: 'MobileMinZoom',
  MobileMaxZoom: 'MobileMaxZoom',
  LinkToMarkerIndex: 'LinkToMarkerIndex',
  AnchorPositionTop: 'AnchorPositionTop',
  AnchorPositionLeft: 'AnchorPositionLeft',
  HoverTitle: 'HoverTitle',
  HoverTitleVisible: 'HoverTitleVisible',
  HoverIconUrl: 'HoverIconUrl',
  HoverIconVersion: 'HoverIconVersion',
  HoverIconWidth: 'HoverIconWidth',
  HoverIconHeight: 'HoverIconHeight',
  HoverScale: 'HoverScale',
  SelectedTitle: 'SelectedTitle',
  SelectedTitleVisible: 'SelectedTitleVisible',
  SelectedIconUrl: 'SelectedIconUrl',
  SelectedIconVersion: 'SelectedIconVersion',
  SelectedIconWidth: 'SelectedIconWidth',
  SelectedIconHeight: 'SelectedIconHeight',
  SelectedScale: 'SelectedScale',
  Title: 'Title',
  TitleVisible: 'TitleVisible',
  IconUrl: 'IconUrl',
  IconVersion: 'IconVersion',
  IconWidth: 'IconWidth',
  IconHeight: 'IconHeight',
  Version: 'Version',
  IsPriority: 'IsPriority',
  Logo: 'Logo',
  Layout2DId: 'Layout2DId'
};

exports.Prisma.HotspotScalarFieldEnum = {
  Id: 'Id',
  HotspotIndex: 'HotspotIndex',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  Name: 'Name',
  MediaUrl: 'MediaUrl',
  MediaVersion: 'MediaVersion',
  MediaThumbnailUrl: 'MediaThumbnailUrl',
  MediaThumbnailVersion: 'MediaThumbnailVersion',
  PositionJson: 'PositionJson',
  OffsetRotationJson: 'OffsetRotationJson',
  DefaultCameraRotationJson: 'DefaultCameraRotationJson',
  CameraSettingsJson: 'CameraSettingsJson',
  HotspotGroupId: 'HotspotGroupId'
};

exports.Prisma.HotspotGroupScalarFieldEnum = {
  Id: 'Id',
  Name: 'Name',
  HotspotGroupIndex: 'HotspotGroupIndex',
  DefaultHotspotIndex: 'DefaultHotspotIndex',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  Layout3DId: 'Layout3DId'
};

exports.Prisma.NavigationScalarFieldEnum = {
  Id: 'Id',
  DisplayName: 'DisplayName',
  DisplaySubName: 'DisplaySubName',
  CardImageUrl: 'CardImageUrl',
  DisplayOrder: 'DisplayOrder',
  IsPriority: 'IsPriority',
  NavigationUrl: 'NavigationUrl',
  ViewConfigId: 'ViewConfigId'
};

exports.Prisma.GalleryItemScalarFieldEnum = {
  Id: 'Id',
  Title: 'Title',
  IsDefault: 'IsDefault',
  DisplayOrder: 'DisplayOrder',
  MediaUrl: 'MediaUrl',
  MediaVersion: 'MediaVersion',
  MediaFormat: 'MediaFormat',
  Description: 'Description',
  Subtitle: 'Subtitle',
  Code: 'Code',
  ViewConfigId: 'ViewConfigId'
};

exports.Prisma.AmenityScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  ProjectId: 'ProjectId',
  ClusterId: 'ClusterId'
};

exports.Prisma.CityScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  NationId: 'NationId'
};

exports.Prisma.ClusterScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  ProjectId: 'ProjectId'
};

exports.Prisma.NationScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable'
};

exports.Prisma.ProjectScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  MulesoftCode: 'MulesoftCode',
  CommunityKey: 'CommunityKey',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  CityId: 'CityId'
};

exports.Prisma.PropertyScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  CommunityName: 'CommunityName',
  ClusterId: 'ClusterId'
};

exports.Prisma.PropertyFloorScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  PropertyId: 'PropertyId'
};

exports.Prisma.UnitScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  UnitType: 'UnitType',
  UnitStatus: 'UnitStatus',
  UnitCategory: 'UnitCategory',
  FeatureSpecification: 'FeatureSpecification',
  IsPremium: 'IsPremium',
  SaleableArea: 'SaleableArea',
  BalconyArea: 'BalconyArea',
  PlotArea: 'PlotArea',
  PaymentPlan: 'PaymentPlan',
  Price: 'Price',
  OnlineStatus: 'OnlineStatus',
  LocationId: 'LocationId',
  DownPaymentPercentage: 'DownPaymentPercentage',
  DisableUnit: 'DisableUnit',
  ClusterName: 'ClusterName',
  BedroomCount: 'BedroomCount',
  BathroomCount: 'BathroomCount',
  UnitNumber: 'UnitNumber',
  Plex: 'Plex',
  Mirror: 'Mirror',
  DefaultFloor: 'DefaultFloor',
  FloorsOccupied: 'FloorsOccupied',
  NorthBearing: 'NorthBearing',
  IsFurnished: 'IsFurnished',
  SalesAgentId: 'SalesAgentId',
  HasInterior: 'HasInterior',
  HasFloorplan: 'HasFloorplan',
  DisplayName: 'DisplayName',
  IsShowHome: 'IsShowHome',
  HasUniqueView: 'HasUniqueView',
  EnableForKiosk: 'EnableForKiosk',
  UnitVariantId: 'UnitVariantId',
  PropertyFloorId: 'PropertyFloorId'
};

exports.Prisma.UnitVariantScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title'
};

exports.Prisma.UnitVariantExteriorScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  UnitVariantId: 'UnitVariantId'
};

exports.Prisma.UnitVariantFloorScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  UnitVariantId: 'UnitVariantId'
};

exports.Prisma.UnitVariantInteriorScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  UnitVariantId: 'UnitVariantId'
};

exports.Prisma.ParkingFloorplanScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  ClusterId: 'ClusterId'
};

exports.Prisma.ParkingUpgradeScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  ParkingFloorplanId: 'ParkingFloorplanId'
};

exports.Prisma.ParkingUpgradeGalleryScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Title: 'Title',
  IsVisible: 'IsVisible',
  IsExplorable: 'IsExplorable',
  ParkingUpgradeId: 'ParkingUpgradeId'
};

exports.Prisma.ProjectCacheInfoScalarFieldEnum = {
  Id: 'Id',
  MulesoftDataKey: 'MulesoftDataKey',
  ProcessedDataKey: 'ProcessedDataKey',
  ProjectId: 'ProjectId'
};

exports.Prisma.BackplateScalarFieldEnum = {
  Id: 'Id',
  Url: 'Url',
  Version: 'Version',
  Width: 'Width',
  Height: 'Height',
  Type: 'Type',
  Theme: 'Theme',
  LngLatJson: 'LngLatJson',
  LngLatBoundsJson: 'LngLatBoundsJson',
  MinZoomLevel: 'MinZoomLevel',
  MaxZoomLevel: 'MaxZoomLevel',
  VideoLoopEnabled: 'VideoLoopEnabled',
  VideoAutoplay: 'VideoAutoplay',
  ShowVideoControls: 'ShowVideoControls',
  ThumbnailUrl: 'ThumbnailUrl',
  ThumbnailVersion: 'ThumbnailVersion',
  ThumbnailWidth: 'ThumbnailWidth',
  ThumbnailHeight: 'ThumbnailHeight',
  Layout2DId: 'Layout2DId'
};

exports.Prisma.VideoTransitionScalarFieldEnum = {
  Id: 'Id',
  FromLayout2dId: 'FromLayout2dId',
  ToLayout2dId: 'ToLayout2dId',
  FromLayout3dId: 'FromLayout3dId',
  ToLayout3dId: 'ToLayout3dId',
  MediaUrl: 'MediaUrl',
  Theme: 'Theme',
  Version: 'Version'
};

exports.Prisma.ProjectSalesLeadInfoScalarFieldEnum = {
  Id: 'Id',
  LeadSource: 'LeadSource',
  EnquiryCategory: 'EnquiryCategory',
  EnquiryTrigger: 'EnquiryTrigger',
  SalesType: 'SalesType',
  PropertyUsage: 'PropertyUsage',
  ProjectName: 'ProjectName',
  OfferDomestic: 'OfferDomestic',
  OfferInternational: 'OfferInternational',
  ProjectId: 'ProjectId'
};

exports.Prisma.ParkingProjectScalarFieldEnum = {
  Id: 'Id',
  ProjectName: 'ProjectName',
  ProjectId: 'ProjectId',
  CommunityName: 'CommunityName',
  BuildingName: 'BuildingName',
  BuildingId: 'BuildingId'
};

exports.Prisma.ParkingSlotScalarFieldEnum = {
  Id: 'Id',
  ProductId: 'ProductId',
  Type: 'Type',
  Tier: 'Tier',
  RefId: 'RefId',
  Group: 'Group',
  Segment: 'Segment',
  Category: 'Category',
  SlotId: 'SlotId',
  DistanceFromLobby: 'DistanceFromLobby',
  Capacity: 'Capacity',
  ListPrice: 'ListPrice',
  Status: 'Status',
  ParkingProjectId: 'ParkingProjectId'
};

exports.Prisma.ProjectVariantsInfoScalarFieldEnum = {
  Id: 'Id',
  UnitVariantTypes: 'UnitVariantTypes',
  ProjectId: 'ProjectId'
};

exports.Prisma.OverlayScalarFieldEnum = {
  Id: 'Id',
  Url: 'Url',
  Type: 'Type',
  Version: 'Version',
  Layout2DId: 'Layout2DId'
};

exports.Prisma.GeoLayerScalarFieldEnum = {
  Id: 'Id',
  Code: 'Code',
  Version: 'Version',
  MinZoom: 'MinZoom',
  MaxZoom: 'MaxZoom',
  BehaviorJson: 'BehaviorJson',
  Layout2DId: 'Layout2DId'
};

exports.Prisma.GeoLayerDataScalarFieldEnum = {
  Id: 'Id',
  SourceType: 'SourceType',
  SourceLayer: 'SourceLayer',
  CoordinatesJson: 'CoordinatesJson',
  Url: 'Url',
  GeoJsonDataJson: 'GeoJsonDataJson',
  GeoLayerStyleJson: 'GeoLayerStyleJson',
  GeoLayerId: 'GeoLayerId'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  ViewConfig: 'ViewConfig',
  Layout2D: 'Layout2D',
  Layout3D: 'Layout3D',
  Marker: 'Marker',
  Hotspot: 'Hotspot',
  HotspotGroup: 'HotspotGroup',
  Navigation: 'Navigation',
  GalleryItem: 'GalleryItem',
  Amenity: 'Amenity',
  City: 'City',
  Cluster: 'Cluster',
  Nation: 'Nation',
  Project: 'Project',
  Property: 'Property',
  PropertyFloor: 'PropertyFloor',
  Unit: 'Unit',
  UnitVariant: 'UnitVariant',
  UnitVariantExterior: 'UnitVariantExterior',
  UnitVariantFloor: 'UnitVariantFloor',
  UnitVariantInterior: 'UnitVariantInterior',
  ParkingFloorplan: 'ParkingFloorplan',
  ParkingUpgrade: 'ParkingUpgrade',
  ParkingUpgradeGallery: 'ParkingUpgradeGallery',
  ProjectCacheInfo: 'ProjectCacheInfo',
  Backplate: 'Backplate',
  VideoTransition: 'VideoTransition',
  ProjectSalesLeadInfo: 'ProjectSalesLeadInfo',
  ParkingProject: 'ParkingProject',
  ParkingSlot: 'ParkingSlot',
  ProjectVariantsInfo: 'ProjectVariantsInfo',
  Overlay: 'Overlay',
  GeoLayer: 'GeoLayer',
  GeoLayerData: 'GeoLayerData'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
