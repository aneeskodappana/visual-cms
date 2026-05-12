export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface RotationLike {
  x: number;
  y: number;
  z: number;
}

export interface CameraSettings {
  Fov?: number;
}

export interface CameraSettingsRule extends CameraSettings {
  VwMax?: number;
  VhMax?: number;
}

export interface CameraSettingsJson {
  version?: number;
  default?: CameraSettings;
  rules?: CameraSettingsRule[];
}

export interface CmsHotspotData {
  Id: string;
  HotspotIndex: number;
  IsVisible: boolean;
  IsExplorable: boolean;
  Name: string;
  MediaUrl: string;
  MediaVersion: number;
  MediaThumbnailUrl: string;
  MediaThumbnailVersion: number;
  PositionJson: string;
  OffsetRotationJson: string;
  DefaultCameraRotationJson: string;
  CameraSettingsJson: CameraSettingsJson | null;
  HotspotGroupId: string;
}

export interface CmsHotspotGroupData {
  Id: string;
  Name: string;
  HotspotGroupIndex: number;
  DefaultHotspotIndex: number;
  IsVisible: boolean;
  IsExplorable: boolean;
  Hotspots: CmsHotspotData[];
  Layout3DId: string;
}

export interface CmsLayout3DData {
  Id: string;
  ModelUrl: string;
  DefaultHotspotGroupIndex: number;
  ModelScaleJson: string | null;
  HotspotGroup: CmsHotspotGroupData[];
  ViewConfigId: string;
}

export interface ViewConfig3DData {
  Id: string;
  Title: string;
  Subtitle: string;
  Code: string;
  CdnBaseUrl: string;
  Layout3D: CmsLayout3DData | null;
}

export interface NormalizedHotspot {
  id: string;
  index: number;
  isVisible: boolean;
  isExplorable: boolean;
  name: string;
  mediaUrl: string;
  mediaThumbnailUrl: string;
  position: Vector3Like;
  offsetRotation: RotationLike;
  defaultCameraRotation: RotationLike;
  cameraSettingsJson: CameraSettingsJson | null;
  hotspotGroupId: string;
}

export interface NormalizedHotspotGroup {
  id: string;
  name: string;
  hotspotGroupIndex: number;
  defaultHotspotId: string | null;
  isVisible: boolean;
  isExplorable: boolean;
  hotspots: NormalizedHotspot[];
}

export interface NormalizedLayout3D {
  id: string;
  modelUrl: string;
  defaultGroupId: string | null;
  modelScale: Vector3Like;
  hotspotGroups: NormalizedHotspotGroup[];
}

export interface TransitionHotspot {
  hotspot: NormalizedHotspot;
  hotspotGroupId: string;
  hotspotGroupName: string;
}
