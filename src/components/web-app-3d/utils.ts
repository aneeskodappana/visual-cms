import { Vector3 } from 'three';
import { constructCdnUrl } from '@/lib/cdnUtils';
import {
  CameraSettings,
  CameraSettingsJson,
  CameraSettingsRule,
  CmsHotspotData,
  CmsHotspotGroupData,
  CmsLayout3DData,
  NormalizedHotspot,
  NormalizedHotspotGroup,
  NormalizedLayout3D,
  RotationLike,
  Vector3Like,
} from './types';

export const WEB_APP_3D_CONSTANTS = {
  CAMERA_FOV: 90,
  CAMERA_NEAR: 1,
  CAMERA_FAR: 1000,
  MODEL_POSITION: [0, 0, 0] as [number, number, number],
  MODEL_SCALE: { x: 10, y: 10, z: 10 } as Vector3Like,
  CURSOR_STYLE: 'none',
  POINTER_TEXTURE_URL: '/common/icons/interiorSvgs/interior-cursor.svg',
  HOTSPOT_TEXTURE_URL: '/common/icons/interiorSvgs/interior-waypoint.svg',
  COLLISION_GROUP_NAME: 'collisionModel',
  RAYCAST_GROUP_NAME: 'collisionModel',
  HOTSPOT_GROUP_NAME: 'hotspotCollisionModel',
  SCALAR_MULTIPLIER: 0.1,
  MINIMUM_CLICK_MOVE_THRESHOLD: 5,
  HOTSPOT_SCALE_FACTOR: 10,
  HOTSPOT_INITIAL_OFFSET: new Vector3(0, 2.5, 0),
  HOTSPOT_TEXT_OFFSET: new Vector3(0, 3.5, 0),
  WORLD_UP_VECTOR: new Vector3(0, 1, 0),
  WORLD_DOWN_VECTOR: new Vector3(0, -1, 0),
  DRACO_DECODER_URL: 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
  MOUSE_SENSITIVITY_X: 0.5,
  MOUSE_SENSITIVITY_Y: 0.3,
  TOUCH_SENSITIVITY_X: 2,
  TOUCH_SENSITIVITY_Y: 1.1,
  MIN_VERTICAL_ANGLE: Math.PI - 0.1,
  MAX_VERTICAL_ANGLE: 0.1,
} as const;

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseVector3Json(value: string | null | undefined, fallback: Vector3Like = { x: 0, y: 0, z: 0 }): Vector3Like {
  const parsed = parseJson<Record<string, number> | null>(value, null);
  if (!parsed) return fallback;
  return {
    x: parsed.x ?? parsed.X ?? fallback.x,
    y: parsed.y ?? parsed.Y ?? fallback.y,
    z: parsed.z ?? parsed.Z ?? fallback.z,
  };
}

export function parseRotationJson(value: string | null | undefined, fallback: RotationLike = { x: 0, y: 0, z: 0 }): RotationLike {
  const parsed = parseJson<Record<string, number> | null>(value, null);
  if (!parsed) return fallback;
  return {
    x: parsed.x ?? parsed.X ?? fallback.x,
    y: parsed.y ?? parsed.Y ?? fallback.y,
    z: parsed.z ?? parsed.Z ?? fallback.z,
  };
}

export function normalizeHotspot(hotspot: CmsHotspotData): NormalizedHotspot {
  return {
    id: hotspot.Id,
    index: hotspot.HotspotIndex,
    isVisible: hotspot.IsVisible,
    isExplorable: hotspot.IsExplorable,
    name: hotspot.Name,
    mediaUrl: hotspot.MediaUrl,
    mediaThumbnailUrl: hotspot.MediaThumbnailUrl,
    position: parseVector3Json(hotspot.PositionJson),
    offsetRotation: parseRotationJson(hotspot.OffsetRotationJson),
    defaultCameraRotation: parseRotationJson(hotspot.DefaultCameraRotationJson),
    cameraSettingsJson: hotspot.CameraSettingsJson,
    hotspotGroupId: hotspot.HotspotGroupId,
  };
}

export function normalizeHotspotGroup(group: CmsHotspotGroupData): NormalizedHotspotGroup {
  const hotspots = (group.Hotspots || [])
    .map(normalizeHotspot)
    .sort((a, b) => a.index - b.index);
  const defaultHotspot = hotspots.find((hotspot) => hotspot.index === group.DefaultHotspotIndex) ?? hotspots[0] ?? null;

  return {
    id: group.Id,
    name: group.Name,
    hotspotGroupIndex: group.HotspotGroupIndex,
    defaultHotspotId: defaultHotspot?.id ?? null,
    isVisible: group.IsVisible,
    isExplorable: group.IsExplorable,
    hotspots,
  };
}

export function normalizeLayout3D(layout3D: CmsLayout3DData): NormalizedLayout3D {
  const hotspotGroups = (layout3D.HotspotGroup || [])
    .map(normalizeHotspotGroup)
    .sort((a, b) => a.hotspotGroupIndex - b.hotspotGroupIndex);
  const defaultGroup = hotspotGroups.find((group) => group.hotspotGroupIndex === layout3D.DefaultHotspotGroupIndex) ?? hotspotGroups[0] ?? null;
  return {
    id: layout3D.Id,
    modelUrl: layout3D.ModelUrl,
    defaultGroupId: defaultGroup?.id ?? null,
    modelScale: parseVector3Json(layout3D.ModelScaleJson, WEB_APP_3D_CONSTANTS.MODEL_SCALE),
    hotspotGroups,
  };
}

export function getDefaultGroup(layout3D: NormalizedLayout3D | null | undefined) {
  if (!layout3D) return null;
  return layout3D.hotspotGroups.find((group) => group.id === layout3D.defaultGroupId) ?? layout3D.hotspotGroups[0] ?? null;
}

export function getDefaultHotspot(layout3D: NormalizedLayout3D | null | undefined, groupId?: string | null) {
  if (!layout3D) return null;
  const group = groupId
    ? layout3D.hotspotGroups.find((item) => item.id === groupId)
    : getDefaultGroup(layout3D);
  if (!group) return null;
  return group.hotspots.find((item) => item.id === group.defaultHotspotId) ?? group.hotspots[0] ?? null;
}

export function resolveMediaUrl(path: string | null | undefined, cdnBaseUrl: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return constructCdnUrl(path.replace(/^\/+/, ''), cdnBaseUrl ? `${cdnBaseUrl.replace(/^\/+/, '').replace(/\/?$/, '/')}` : '');
}

export function resolveModelUrl(path: string | null | undefined, cdnBaseUrl: string) {
  return resolveMediaUrl(path, cdnBaseUrl);
}

export function resolveCameraDeterministic(
  cfg: CameraSettingsJson | null | undefined,
  vw: number,
  vh: number,
  platformDefaults: CameraSettings = { Fov: WEB_APP_3D_CONSTANTS.CAMERA_FOV }
): CameraSettings {
  let resolved = mergeSettings(platformDefaults, cfg?.default);
  const rules = cfg?.rules;
  if (!rules?.length) return clampSettings(resolved);

  let best: CameraSettingsRule | undefined;
  let bestKey: [number, number, number] | undefined;
  const INF = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    if (rule.VwMax == null && rule.VhMax == null) continue;
    const widthOk = rule.VwMax == null || vw <= rule.VwMax;
    const heightOk = rule.VhMax == null || vh <= rule.VhMax;
    if (!widthOk || !heightOk) continue;

    const vwScore = rule.VwMax ?? INF;
    const vhScore = rule.VhMax ?? INF;
    const hasBoth = (rule.VwMax != null ? 1 : 0) + (rule.VhMax != null ? 1 : 0);

    if (!best) {
      best = rule;
      bestKey = [vwScore, vhScore, hasBoth];
      continue;
    }

    const [bestWidth, bestHeight, bestBoth] = bestKey!;
    if (
      vwScore < bestWidth ||
      (vwScore === bestWidth && vhScore < bestHeight) ||
      (vwScore === bestWidth && vhScore === bestHeight && hasBoth > bestBoth)
    ) {
      best = rule;
      bestKey = [vwScore, vhScore, hasBoth];
    }
  }

  if (best) {
    resolved = mergeSettings(resolved, best);
  }

  return clampSettings(resolved);
}

function mergeSettings(base: CameraSettings, over?: CameraSettings): CameraSettings {
  if (!over) return { ...base };
  return {
    ...base,
    ...(over.Fov !== undefined ? { Fov: over.Fov } : null),
  };
}

function clampSettings(settings: CameraSettings): CameraSettings {
  const fov = settings.Fov ?? WEB_APP_3D_CONSTANTS.CAMERA_FOV;
  return { Fov: Math.max(0, Math.min(180, fov)) };
}
