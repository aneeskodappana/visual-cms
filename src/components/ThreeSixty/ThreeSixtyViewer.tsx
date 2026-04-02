'use client';

import { useRef, Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene, WebGLRenderer } from 'three';
import { ThreeSixtyImageMesh, ThreeSixtyVideoMesh, RetailHotspot, VIDEO_VIEWER_CONSTANTS } from '.';
import DraggableHotspot from './DraggableHotspot';
import { OrbitControls } from '@react-three/drei';

interface HotspotData {
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
  CameraSettingsJson: any;
  HotspotGroupId: string;
}

interface HotspotGroupData {
  Id: string;
  Name: string;
  HotspotGroupIndex: number;
  DefaultHotspotIndex: number;
  IsVisible: boolean;
  IsExplorable: boolean;
  Hotspots: HotspotData[];
  Layout3DId: string;
}

interface Layout3DData {
  Id: string;
  ModelUrl: string;
  DefaultHotspotGroupIndex: number;
  ModelScaleJson: string;
  HotspotGroup: HotspotGroupData[];
  ViewConfigId: string;
}

interface ThreeSixtyViewerProps {
  layout3D: Layout3DData;
  cdnBaseUrl: string;
  isEditMode?: boolean;
  selectedHotspotId?: string | null;
  positionOverrides?: Record<string, { x: number; y: number; z: number }>;
  onHotspotClick?: (hotspot: HotspotData) => void;
  onHotspotDrag?: (hotspotId: string, position: { x: number; y: number; z: number }) => void;
  hiddenHotspotIds?: Set<string>;
}

const BLOB_BASE_URL = 'https://worlddev.aldar.com/assets/';

const convertToSpherePosition = (x: number, y: number, z: number, radius = 4): [number, number, number] => {
  const imageWidth = 6000;
  const imageHeight = 3000;

  const isPixelCoordinate = x > imageWidth * 0.01 || y > imageHeight * 0.01;

  if (!isPixelCoordinate && x !== 0 && y !== 0 && z !== 0) {
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length === 0) return [0, 0, -radius];
    const scale = radius / length;
    return [x * scale, y * scale, z * scale];
  }

  const theta = (x / imageWidth) * 2 * Math.PI - Math.PI;
  const phi = (y / imageHeight) * Math.PI;

  const sphereX = radius * Math.sin(phi) * Math.sin(theta);
  const sphereY = radius * Math.cos(phi);
  const sphereZ = -radius * Math.sin(phi) * Math.cos(theta);

  return [sphereX, sphereY, sphereZ];
};

const parsePosition = (positionJson: string): { x: number; y: number; z: number } => {
  try {
    const parsed = JSON.parse(positionJson);
    return {
      x: parsed.x ?? parsed.X ?? 0,
      y: parsed.y ?? parsed.Y ?? 0,
      z: parsed.z ?? parsed.Z ?? 0,
    };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
};

export default function ThreeSixtyViewer({
  layout3D,
  cdnBaseUrl,
  isEditMode = false,
  selectedHotspotId,
  positionOverrides = {},
  onHotspotClick,
  onHotspotDrag,
  hiddenHotspotIds = new Set(),
}: ThreeSixtyViewerProps) {
  const aspectRatioRef = useRef(0);
  const [cursorStyle, setCursorStyle] = useState(VIDEO_VIEWER_CONSTANTS.CURSOR_STYLE);
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);

  const defaultGroup = useMemo(() => {
    return layout3D.HotspotGroup.find(
      (g) => g.HotspotGroupIndex === layout3D.DefaultHotspotGroupIndex
    ) ?? layout3D.HotspotGroup[0];
  }, [layout3D]);

  const defaultHotspot = useMemo(() => {
    if (!defaultGroup) return null;
    return defaultGroup.Hotspots.find(
      (h) => h.HotspotIndex === defaultGroup.DefaultHotspotIndex
    ) ?? defaultGroup.Hotspots[0] ?? null;
  }, [defaultGroup]);

  const [currentHotspot, setCurrentHotspot] = useState<HotspotData | null>(defaultHotspot);

  const mediaUrl = useMemo(() => {
    if (!currentHotspot?.MediaUrl) return null;
    const url = currentHotspot.MediaUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (cdnBaseUrl || '').replace(/\/+$/, '');
    const path = url.replace(/^\/+/, '');
    return `${BLOB_BASE_URL}${base}/${path}`;
  }, [currentHotspot, cdnBaseUrl]);

  const relatedHotspots = useMemo(() => {
    if (!defaultGroup) return [];
    return defaultGroup.Hotspots.filter(
      (h) => h.Id !== currentHotspot?.Id
    );
  }, [defaultGroup, currentHotspot]);

  const onPointerDown = () => setCursorStyle(VIDEO_VIEWER_CONSTANTS.CURSOR_GRABBING_STYLE);
  const onPointerUp = () => setCursorStyle(VIDEO_VIEWER_CONSTANTS.CURSOR_STYLE);

  const onCanvasCreated = ({ gl, scene }: { gl: WebGLRenderer; scene: Scene }) => {
    scene.background = VIDEO_VIEWER_CONSTANTS.BLACK_COLOUR;
    gl.setClearColor(VIDEO_VIEWER_CONSTANTS.BLACK_COLOUR);
    gl.domElement.addEventListener('mousedown', onPointerDown);
    gl.domElement.addEventListener('mouseup', onPointerUp);
    aspectRatioRef.current = gl.domElement.clientWidth / gl.domElement.clientHeight;
  };

  const isVideo = mediaUrl?.toLowerCase().includes('.mp4') ?? false;
  const fov = 75;

  const handleHotSpotClick = (hotspot: HotspotData) => {
    if (isEditMode) {
      onHotspotClick?.(hotspot);
    } else {
      setCurrentHotspot(hotspot);
    }
  };

  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <p>No media available for this 3D layout</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        style={{ cursor: cursorStyle, width: '100%', height: '100%' }}
        camera={{
          fov: fov,
          near: VIDEO_VIEWER_CONSTANTS.CAMERA_NEAR,
          far: VIDEO_VIEWER_CONSTANTS.CAMERA_FAR,
          position: [0, 0, 0.1],
        }}
        onCreated={onCanvasCreated}
      >
        <OrbitControls
          enabled={!isDraggingHotspot}
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.5}
          target={[0, 0, 0]}
        />

        {(isEditMode ? (defaultGroup?.Hotspots ?? []) : relatedHotspots).filter((h) => !hiddenHotspotIds.has(h.Id)).map((hotspot) => {
          const override = positionOverrides[hotspot.Id];
          const pos = override || parsePosition(hotspot.PositionJson);
          const spherePos = convertToSpherePosition(pos.x, pos.y, pos.z);

          if (isEditMode) {
            return (
              <DraggableHotspot
                key={hotspot.Id}
                title={hotspot.Name}
                position={spherePos}
                isSelected={hotspot.Id === selectedHotspotId}
                isDraggable={true}
                onClick={() => handleHotSpotClick(hotspot)}
                onDragStart={() => setIsDraggingHotspot(true)}
                onDragEnd={() => setIsDraggingHotspot(false)}
                onDrag={(position) => onHotspotDrag?.(hotspot.Id, position)}
              />
            );
          }

          return (
            <RetailHotspot
              key={hotspot.Id}
              title={hotspot.Name}
              position={spherePos}
              onClick={() => handleHotSpotClick(hotspot)}
            />
          );
        })}

        <Suspense fallback={null}>
          {isVideo ? (
            <ThreeSixtyVideoMesh mediaUrl={mediaUrl} />
          ) : (
            <ThreeSixtyImageMesh mediaUrl={mediaUrl} />
          )}
        </Suspense>
      </Canvas>

      {/* Hotspot selector panel */}
      {defaultGroup && defaultGroup.Hotspots.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
          {relatedHotspots.map((hotspot) => (
            <button
              key={hotspot.Id}
              onClick={() => handleHotSpotClick(hotspot)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                currentHotspot?.Id === hotspot.Id
                  ? 'bg-white text-gray-900'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {hotspot.Name.replace("-", " ") || `Hotspot ${hotspot.HotspotIndex}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
