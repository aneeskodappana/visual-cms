'use client';

import {
  createContext,
  MutableRefObject,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bvh, Html } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  LinearFilter,
  Material,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Spherical,
  Texture,
  TextureLoader,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { projectionBlendFrag, projectionBlendVertex } from './ProjectionBlend';
import {
  CmsLayout3DData,
  NormalizedHotspot,
  NormalizedHotspotGroup,
  NormalizedLayout3D,
  RotationLike,
  TransitionHotspot,
  Vector3Like,
} from './types';
import {
  WEB_APP_3D_CONSTANTS,
  getDefaultGroup,
  getDefaultHotspot,
  normalizeLayout3D,
  resolveCameraDeterministic,
  resolveMediaUrl,
  resolveModelUrl,
} from './utils';

export interface WebApp3DViewerProps {
  layout3D: CmsLayout3DData;
  cdnBaseUrl: string;
  editMode?: boolean;
  selectedHotspotId?: string | null;
  positionOverrides?: Record<string, Vector3Like>;
  offsetRotationOverrides?: Record<string, RotationLike>;
  defaultCameraRotationOverrides?: Record<string, RotationLike>;
  modelScale?: Vector3Like;
  requestedGroupId?: string | null;
  onHotspotSelect?: (hotspot: NormalizedHotspot) => void;
  onHotspotDrag?: (hotspotId: string, position: Vector3Like) => void;
  onActiveGroupChange?: (groupId: string | null) => void;
}

interface TransitionContextValue {
  fromHotspot: TransitionHotspot | undefined;
  toHotspot: TransitionHotspot | undefined;
  progress: number;
  inProgress: boolean;
  setFromHotspot: (value: TransitionHotspot | undefined) => void;
  setToHotspot: (value: TransitionHotspot | undefined) => void;
  setProgress: (value: number) => void;
  setInProgress: (value: boolean) => void;
  transitionToHotspot: (value: TransitionHotspot) => void;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

function useTransitionContext() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('TransitionContext is not available');
  }
  return context;
}

function resolveLayoutWithOverrides(
  layout: NormalizedLayout3D,
  positionOverrides: Record<string, Vector3Like>,
  offsetRotationOverrides: Record<string, RotationLike>,
  defaultCameraRotationOverrides: Record<string, RotationLike>
): NormalizedLayout3D {
  return {
    ...layout,
    hotspotGroups: layout.hotspotGroups.map((group) => ({
      ...group,
      hotspots: group.hotspots.map((hotspot) => ({
        ...hotspot,
        position: positionOverrides[hotspot.id] ?? hotspot.position,
        offsetRotation: offsetRotationOverrides[hotspot.id] ?? hotspot.offsetRotation,
        defaultCameraRotation: defaultCameraRotationOverrides[hotspot.id] ?? hotspot.defaultCameraRotation,
      })),
    })),
  };
}

function TransitionProvider({
  children,
  cdnBaseUrl,
}: {
  children: ReactNode;
  cdnBaseUrl: string;
}) {
  const [fromHotspot, setFromHotspot] = useState<TransitionHotspot | undefined>();
  const [toHotspot, setToHotspot] = useState<TransitionHotspot | undefined>();
  const [progress, setProgress] = useState(0);
  const [inProgress, setInProgress] = useState(false);
  const [cameraSettings, setCameraSettings] = useState<{ Fov?: number }>();
  const [previousCameraSettings, setPreviousCameraSettings] = useState<{ Fov?: number }>();

  useFrame(({ camera }) => {
    if (!inProgress) return;
    const perspectiveCamera = camera as PerspectiveCamera;
    const fromFov = previousCameraSettings?.Fov ?? WEB_APP_3D_CONSTANTS.CAMERA_FOV;
    const toFov = cameraSettings?.Fov ?? WEB_APP_3D_CONSTANTS.CAMERA_FOV;
    perspectiveCamera.fov = MathUtils.lerp(fromFov, toFov, progress);
    perspectiveCamera.updateProjectionMatrix();
  });

  const transitionToHotspot = useCallback(
    (newHotspot: TransitionHotspot) => {
      if (inProgress) return;
      if (toHotspot && toHotspot.hotspot.id === newHotspot.hotspot.id) return;

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const textureLoader = new TextureLoader();
      const textureUrl = resolveMediaUrl(newHotspot.hotspot.mediaUrl, cdnBaseUrl);

      const startTransition = () => {
        const previous = toHotspot || fromHotspot || newHotspot;
        setFromHotspot(previous);
        setToHotspot(newHotspot);
        setProgress(0);
        if (previous.hotspot.id !== newHotspot.hotspot.id) {
          setInProgress(true);
        }
        setPreviousCameraSettings(
          resolveCameraDeterministic(previous.hotspot.cameraSettingsJson, viewportWidth, viewportHeight)
        );
        setCameraSettings(
          resolveCameraDeterministic(newHotspot.hotspot.cameraSettingsJson, viewportWidth, viewportHeight)
        );
      };

      if (!textureUrl) {
        startTransition();
        return;
      }

      textureLoader.load(textureUrl, startTransition, undefined, startTransition);
    },
    [cdnBaseUrl, fromHotspot, inProgress, toHotspot]
  );

  const value = useMemo(
    () => ({
      fromHotspot,
      toHotspot,
      progress,
      inProgress,
      setFromHotspot,
      setToHotspot,
      setProgress,
      setInProgress,
      transitionToHotspot,
    }),
    [fromHotspot, toHotspot, progress, inProgress, transitionToHotspot]
  );

  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

function CameraControls({ enabled = true }: { enabled?: boolean }) {
  const { camera, gl } = useThree();
  const rotateDelta = useRef(new Vector2(0, 0));
  const rotateStart = useRef(new Vector2(0, 0));
  const rotateEnd = useRef(new Vector2(0, 0));
  const spherical = useRef(new Spherical());
  const isPointerDown = useRef(false);

  const setInitialValues = useCallback(() => {
    const initialRotationX = camera.rotation.x;
    const initialRotationY = -camera.rotation.y + Math.PI;
    const phi = Math.PI / 2 - initialRotationX;
    const theta = initialRotationY;

    spherical.current.phi = phi;
    spherical.current.theta = theta;

    const targetPosition = new Vector3(0, 0, 0)
      .setFromSphericalCoords(1, spherical.current.phi, spherical.current.theta)
      .add(camera.position);

    camera.lookAt(targetPosition);
  }, [camera]);

  useEffect(() => {
    setInitialValues();
  }, [setInitialValues]);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (x: number, y: number, speedX: number, speedY: number) => {
      if (!isPointerDown.current) return;
      rotateEnd.current.set(x, y);
      rotateDelta.current
        .subVectors(rotateEnd.current, rotateStart.current)
        .multiply(new Vector2(speedX, speedY));
      rotateStart.current.copy(rotateEnd.current);
    };

    const handleMouseDown = (event: MouseEvent) => {
      isPointerDown.current = true;
      rotateStart.current = new Vector2(event.clientX, event.clientY);
    };

    const handleMouseMove = (event: MouseEvent) => {
      onMove(
        event.clientX,
        event.clientY,
        WEB_APP_3D_CONSTANTS.MOUSE_SENSITIVITY_X,
        WEB_APP_3D_CONSTANTS.MOUSE_SENSITIVITY_Y
      );
    };

    const handleMouseUp = () => {
      isPointerDown.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!event.touches[0]) return;
      onMove(
        event.touches[0].clientX,
        event.touches[0].clientY,
        WEB_APP_3D_CONSTANTS.TOUCH_SENSITIVITY_X,
        WEB_APP_3D_CONSTANTS.TOUCH_SENSITIVITY_Y
      );
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!event.touches[0]) return;
      isPointerDown.current = true;
      rotateStart.current = new Vector2(event.touches[0].clientX, event.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      isPointerDown.current = false;
    };

    gl.domElement.addEventListener('mousedown', handleMouseDown);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('mouseup', handleMouseUp);
    gl.domElement.addEventListener('mouseleave', handleMouseUp);
    gl.domElement.addEventListener('mouseout', handleMouseUp);
    gl.domElement.addEventListener('pointerdown', handleMouseDown);
    gl.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    gl.domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    gl.domElement.addEventListener('touchend', handleTouchEnd);

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('mouseup', handleMouseUp);
      gl.domElement.removeEventListener('mouseleave', handleMouseUp);
      gl.domElement.removeEventListener('mouseout', handleMouseUp);
      gl.domElement.removeEventListener('pointerdown', handleMouseDown);
      gl.domElement.removeEventListener('touchmove', handleTouchMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, gl.domElement]);

  useFrame(() => {
    if (!enabled) return;
    if (rotateDelta.current.length() < 0.001) return;
    if (!gl.domElement.width || !gl.domElement.clientHeight) return;

    const rotateHorizontalAngle = (2 * Math.PI * rotateDelta.current.x) / gl.domElement.width;
    const rotateVerticalAngle = (2 * Math.PI * rotateDelta.current.y) / gl.domElement.clientHeight;

    spherical.current.theta += rotateHorizontalAngle;
    spherical.current.phi = Math.max(
      WEB_APP_3D_CONSTANTS.MAX_VERTICAL_ANGLE,
      Math.min(WEB_APP_3D_CONSTANTS.MIN_VERTICAL_ANGLE, spherical.current.phi - rotateVerticalAngle)
    );

    const targetPosition = camera.position
      .clone()
      .setFromSphericalCoords(1, spherical.current.phi, spherical.current.theta)
      .add(camera.position);

    camera.lookAt(targetPosition);

    if (!isPointerDown.current) {
      rotateDelta.current.multiplyScalar(0.95);
      if (Math.abs(rotateDelta.current.x) < 0.1) rotateDelta.current.setX(0);
      if (Math.abs(rotateDelta.current.y) < 0.1) rotateDelta.current.setY(0);
    } else {
      rotateDelta.current.set(0, 0);
    }
  });

  return null;
}

function CameraPointer({
  currentRaycastPositionRef,
}: {
  currentRaycastPositionRef: MutableRefObject<Vector3 | undefined>;
}) {
  const { camera, scene, gl } = useThree();
  const pointerTexture = useLoader(TextureLoader, WEB_APP_3D_CONSTANTS.POINTER_TEXTURE_URL);
  const pointerMesh = useRef<Mesh | null>(null);
  const pointerScreenPosition = useRef(new Vector2(0, 0));
  const collisionGroupRef = useRef<Object3D | null>(null);
  const raycaster = useRef(new Raycaster());
  const transition = useTransitionContext();
  const [isTouchscreen, setIsTouchscreen] = useState(false);

  useEffect(() => {
    setIsTouchscreen(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const material = new MeshBasicMaterial({
      depthTest: false,
      map: pointerTexture,
      alphaTest: 0.1,
      opacity: isTouchscreen ? 0 : 1,
      transparent: true,
    });

    const mesh = new Mesh(new PlaneGeometry(1.5, 1.5), material);
    mesh.renderOrder = 1;
    mesh.visible = false;
    pointerMesh.current = mesh;
    scene.add(mesh);

    return () => {
      scene.remove(mesh);
      material.dispose();
    };
  }, [isTouchscreen, pointerTexture, scene]);

  useEffect(() => {
    const onMove = (x: number, y: number) => {
      pointerScreenPosition.current.set(
        (x / gl.domElement.width) * 2 - 1,
        -(y / gl.domElement.height) * 2 + 1
      );
    };

    const handlePointerMove = (event: MouseEvent) => {
      const scale = gl.domElement.width / gl.domElement.offsetWidth;
      onMove(event.clientX * scale, event.clientY * scale);
    };

    const handleTouchMove = () => {
      pointerScreenPosition.current.set(0, 0);
    };

    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gl.domElement]);

  useFrame(() => {
    const mesh = pointerMesh.current;
    if (!mesh || transition.inProgress) {
      if (mesh) mesh.visible = false;
      currentRaycastPositionRef.current = undefined;
      return;
    }

    if (!collisionGroupRef.current) {
      collisionGroupRef.current = scene.getObjectByName(WEB_APP_3D_CONSTANTS.RAYCAST_GROUP_NAME) ?? null;
      if (!collisionGroupRef.current) {
        mesh.visible = false;
        currentRaycastPositionRef.current = undefined;
        return;
      }
    }

    raycaster.current.setFromCamera(pointerScreenPosition.current, camera);
    const intersects = raycaster.current.intersectObjects(collisionGroupRef.current.children, true);
    const intersection = intersects[0];

    if (!intersection?.face?.normal || !intersection.point) {
      mesh.visible = false;
      currentRaycastPositionRef.current = undefined;
      return;
    }

    const normal = new Vector3().copy(intersection.face.normal).transformDirection(intersection.object.matrixWorld);
    mesh.position.copy(intersection.point);
    mesh.lookAt(intersection.point.clone().add(normal));
    mesh.visible = true;
    currentRaycastPositionRef.current = intersection.point.clone();
  });

  return null;
}

function HotspotLabel({ name, visible }: { name: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <Html center distanceFactor={12} style={{ pointerEvents: 'none' }}>
      <div className="rounded-md bg-black/70 px-3 py-1.5 whitespace-nowrap text-xs font-semibold text-white">
        {name.replace(/-/g, ' ')}
      </div>
    </Html>
  );
}

function ProjectedHotspotMarker({
  hotspot,
  rawPosition,
  visible,
  selected,
  interactive,
  onActivate,
  onPointerDown,
  onPointerUp,
}: {
  hotspot: NormalizedHotspot;
  rawPosition: Vector3Like;
  visible: boolean;
  selected?: boolean;
  interactive?: boolean;
  onActivate?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}) {
  const { scene } = useThree();
  const texture = useLoader(TextureLoader, WEB_APP_3D_CONSTANTS.HOTSPOT_TEXTURE_URL);
  const hotspotMeshRef = useRef<Mesh | null>(null);
  const [displayPosition, setDisplayPosition] = useState<Vector3>(
    () => new Vector3(rawPosition.x * 10, rawPosition.y * 10, rawPosition.z * 10)
  );
  const [labelPosition, setLabelPosition] = useState<Vector3>(
    () => new Vector3(rawPosition.x * 10, rawPosition.y * 10, rawPosition.z * 10).add(WEB_APP_3D_CONSTANTS.HOTSPOT_TEXT_OFFSET.clone())
  );

  const setHotspotMeshPositionAndLookAt = useCallback((position: Vector3) => {
    setDisplayPosition(position.clone());
    setLabelPosition(position.clone().add(WEB_APP_3D_CONSTANTS.HOTSPOT_TEXT_OFFSET.clone()));

    if (hotspotMeshRef.current) {
      hotspotMeshRef.current.position.copy(position);
      hotspotMeshRef.current.lookAt(position.clone().add(WEB_APP_3D_CONSTANTS.WORLD_UP_VECTOR));
    }
  }, []);

  useEffect(() => {
    const collisionGroup = scene.getObjectByName(WEB_APP_3D_CONSTANTS.COLLISION_GROUP_NAME);
    const worldPosition = new Vector3(rawPosition.x, rawPosition.y, rawPosition.z)
      .multiplyScalar(WEB_APP_3D_CONSTANTS.HOTSPOT_SCALE_FACTOR)
      .add(WEB_APP_3D_CONSTANTS.HOTSPOT_INITIAL_OFFSET.clone());

    if (!collisionGroup) {
      setHotspotMeshPositionAndLookAt(
        new Vector3(rawPosition.x * 10, rawPosition.y * 10, rawPosition.z * 10)
      );
      return;
    }

    const raycaster = new Raycaster(worldPosition, WEB_APP_3D_CONSTANTS.WORLD_DOWN_VECTOR);
    const intersects = raycaster.intersectObjects(collisionGroup.children, true);

    if (intersects[0]?.point) {
      setHotspotMeshPositionAndLookAt(intersects[0].point.clone());
      return;
    }

    setHotspotMeshPositionAndLookAt(
      new Vector3(rawPosition.x * 10, rawPosition.y * 10, rawPosition.z * 10)
    );
  }, [rawPosition.x, rawPosition.y, rawPosition.z, scene, setHotspotMeshPositionAndLookAt]);

  useEffect(() => {
    if (!hotspotMeshRef.current) return;
    hotspotMeshRef.current.position.copy(displayPosition);
    hotspotMeshRef.current.lookAt(displayPosition.clone().add(WEB_APP_3D_CONSTANTS.WORLD_UP_VECTOR));
  }, [displayPosition]);

  return (
    <group visible={visible}>
      <mesh
        ref={hotspotMeshRef}
        onClick={
          !interactive
            ? (event) => {
                event.stopPropagation();
                onActivate?.();
              }
            : undefined
        }
        onPointerDown={
          interactive
            ? (event) => {
                event.stopPropagation();
                onPointerDown?.();
              }
            : undefined
        }
        onPointerUp={
          interactive
            ? (event) => {
                event.stopPropagation();
                onPointerUp?.();
              }
            : undefined
        }
        renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthTest={false}
          alphaTest={0.1}
          toneMapped={false}
          color={selected ? '#60a5fa' : '#ffffff'}
        />
      </mesh>
      <Html
        position={[labelPosition.x, labelPosition.y, labelPosition.z]}
        center
        distanceFactor={12}
        style={{ pointerEvents: 'none' }}>
        <div className="rounded-md bg-black/70 px-4 py-2 whitespace-nowrap text-sm font-semibold text-white">
          {hotspot.name.replace(/-/g, ' ')}
        </div>
      </Html>
    </group>
  );
}

function HotspotsRenderer({
  layout,
  currentRaycastPositionRef,
  defaultHotspot,
  editMode,
  selectedHotspotId,
  positionOverrides,
  onHotspotSelect,
  onHotspotDrag,
  onDraggingChange,
}: {
  layout: NormalizedLayout3D;
  currentRaycastPositionRef: MutableRefObject<Vector3 | undefined>;
  defaultHotspot: NormalizedHotspot;
  editMode: boolean;
  selectedHotspotId?: string | null;
  positionOverrides: Record<string, Vector3Like>;
  onHotspotSelect?: (hotspot: NormalizedHotspot) => void;
  onHotspotDrag?: (hotspotId: string, position: Vector3Like) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}) {
  const { gl } = useThree();
  const transition = useTransitionContext();
  const [visibleHotspotId, setVisibleHotspotId] = useState<string>('');
  const closestHotspotId = useRef<string>('');
  const pointerPositionDelta = useRef(0);
  const draggingHotspotId = useRef<string | null>(null);
  const didDrag = useRef(false);

  const hotspots = useMemo(
    () => layout.hotspotGroups.flatMap((group) => group.hotspots),
    [layout.hotspotGroups]
  );

  const hotspotsMap = useMemo(
    () => new Map(hotspots.map((hotspot) => [hotspot.id, hotspot])),
    [hotspots]
  );

  const groupsByHotspotId = useMemo(() => {
    const map = new Map<string, NormalizedHotspotGroup>();
    layout.hotspotGroups.forEach((group) => {
      group.hotspots.forEach((hotspot) => map.set(hotspot.id, group));
    });
    return map;
  }, [layout.hotspotGroups]);

  const getHotspotPosition = useCallback(
    (hotspot: NormalizedHotspot) => positionOverrides[hotspot.id] ?? hotspot.position,
    [positionOverrides]
  );

  const findClosestHotspot = useCallback(
    (position?: Vector3) => {
      if (!position || editMode) {
        closestHotspotId.current = '';
        if (!editMode && visibleHotspotId !== '') {
          setVisibleHotspotId('');
        }
        return;
      }

      const scaledDownPosition = position.clone().multiplyScalar(WEB_APP_3D_CONSTANTS.SCALAR_MULTIPLIER);
      let distance = Infinity;
      let closestId = '';

      for (const hotspot of hotspots) {
        if (
          transition.toHotspot?.hotspot.id === hotspot.id ||
          (!transition.fromHotspot && hotspot.id === defaultHotspot.id)
        ) {
          continue;
        }

        const hotspotPosition = getHotspotPosition(hotspot);
        const hotspotVector = new Vector3(hotspotPosition.x, hotspotPosition.y, hotspotPosition.z);
        const nextDistance = scaledDownPosition.distanceTo(hotspotVector);

        if (nextDistance < distance) {
          distance = nextDistance;
          closestId = hotspot.id;
        }
      }

      closestHotspotId.current = closestId;
      if (closestId !== visibleHotspotId) {
        setVisibleHotspotId(closestId);
      }
    },
    [defaultHotspot.id, editMode, getHotspotPosition, hotspots, transition.fromHotspot, transition.toHotspot, visibleHotspotId]
  );

  useFrame(() => {
    findClosestHotspot(currentRaycastPositionRef.current);
  });

  useEffect(() => {
    const isLeftMouseButton = (event: MouseEvent) => event.button === 0;

    const handleMouseDown = (event: MouseEvent) => {
      if (isLeftMouseButton(event)) {
        pointerPositionDelta.current = 0;
      }
    };

    const updateDraggedHotspot = () => {
      if (!editMode || !draggingHotspotId.current || !currentRaycastPositionRef.current) {
        return;
      }

      didDrag.current = true;
      const currentPosition = currentRaycastPositionRef.current
        .clone()
        .multiplyScalar(WEB_APP_3D_CONSTANTS.SCALAR_MULTIPLIER);

      onHotspotDrag?.(draggingHotspotId.current, {
        x: Number(currentPosition.x.toFixed(4)),
        y: Number(currentPosition.y.toFixed(4)),
        z: Number(currentPosition.z.toFixed(4)),
      });
    };

    const handlePointerMove = () => {
      pointerPositionDelta.current += 1;
      updateDraggedHotspot();
    };

    const handleTouchMove = () => {
      pointerPositionDelta.current += 1;
      updateDraggedHotspot();
    };

    const handleTouchEnd = () => {
      pointerPositionDelta.current += 1;
      draggingHotspotId.current = null;
      didDrag.current = false;
      onDraggingChange?.(false);
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!isLeftMouseButton(event)) return;

      if (editMode) {
        const draggingId = draggingHotspotId.current;
        draggingHotspotId.current = null;
        const dragged = didDrag.current;
        didDrag.current = false;
        onDraggingChange?.(false);

        if (draggingId && !dragged) {
          const hotspot = hotspotsMap.get(draggingId);
          if (hotspot) {
            onHotspotSelect?.(hotspot);
          }
        }
        return;
      }

      if (
        !closestHotspotId.current ||
        pointerPositionDelta.current >= WEB_APP_3D_CONSTANTS.MINIMUM_CLICK_MOVE_THRESHOLD ||
        transition.inProgress
      ) {
        return;
      }

      const hotspot = hotspotsMap.get(closestHotspotId.current);
      const hotspotGroup = groupsByHotspotId.get(closestHotspotId.current);

      if (!hotspot || !hotspotGroup) return;

      transition.transitionToHotspot({
        hotspot,
        hotspotGroupId: hotspotGroup.id,
        hotspotGroupName: hotspotGroup.name,
      });
    };

    gl.domElement.addEventListener('mousedown', handleMouseDown);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    gl.domElement.addEventListener('touchend', handleTouchEnd);
    gl.domElement.addEventListener('mouseup', handleMouseUp);

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('touchmove', handleTouchMove);
      gl.domElement.removeEventListener('touchend', handleTouchEnd);
      gl.domElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    currentRaycastPositionRef,
    editMode,
    gl.domElement,
    groupsByHotspotId,
    hotspotsMap,
    onDraggingChange,
    onHotspotDrag,
    onHotspotSelect,
    transition,
  ]);

  return (
    <group name={WEB_APP_3D_CONSTANTS.HOTSPOT_GROUP_NAME}>
      {hotspots.map((hotspot) => {
        const position = getHotspotPosition(hotspot);
        const visible = editMode ? true : hotspot.id === visibleHotspotId;
        const hotspotGroup = groupsByHotspotId.get(hotspot.id);

        return (
          <ProjectedHotspotMarker
            key={hotspot.id}
            hotspot={hotspot}
            rawPosition={position}
            visible={visible}
            selected={editMode && hotspot.id === selectedHotspotId}
            interactive={editMode}
            onActivate={
              !editMode && hotspotGroup
                ? () => {
                    if (transition.inProgress) return;
                    if (transition.toHotspot?.hotspot.id === hotspot.id) return;

                    transition.transitionToHotspot({
                      hotspot,
                      hotspotGroupId: hotspotGroup.id,
                      hotspotGroupName: hotspotGroup.name,
                    });
                  }
                : undefined
            }
            onPointerDown={
              editMode
                ? () => {
                    draggingHotspotId.current = hotspot.id;
                    didDrag.current = false;
                    onDraggingChange?.(true);
                    onHotspotSelect?.(hotspot);
                  }
                : undefined
            }
            onPointerUp={editMode ? () => onDraggingChange?.(false) : undefined}
          />
        );
      })}
    </group>
  );
}

function ProjectionModel({
  layout,
  cdnBaseUrl,
  modelScale,
}: {
  layout: NormalizedLayout3D;
  cdnBaseUrl: string;
  modelScale: Vector3Like;
}) {
  const { gl } = useThree();
  const transition = useTransitionContext();
  const modelUrl = resolveModelUrl(layout.modelUrl, cdnBaseUrl);
  const gltf = useLoader(
    GLTFLoader,
    modelUrl,
    (loader) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(WEB_APP_3D_CONSTANTS.DRACO_DECODER_URL);
      loader.setDRACOLoader(dracoLoader);
    }
  );

  const blendMaterial = useRef(
    new ShaderMaterial({
      uniforms: {
        blendAmount: { value: 1 },
        imageOneUvRotation: { value: 0 },
        imageOneTexture: { value: new Texture() },
        imageOnePosition: { value: [0, 0, 0] },
        imageTwoUvRotation: { value: 0 },
        imageTwoTexture: { value: new Texture() },
        imageTwoPosition: { value: [0, 0, 0] },
        useFadeToBlack: { value: false },
      },
      vertexShader: projectionBlendVertex(),
      fragmentShader: projectionBlendFrag(),
      side: DoubleSide,
    })
  );

  const textureCache = useRef<Map<string, Texture>>(new Map());
  const textureOne = useRef<Texture>(new Texture());
  const textureTwo = useRef<Texture>(new Texture());

  const setTextureProperties = useCallback(
    (texture: Texture) => {
      texture.repeat.set(-1, 1);
      texture.wrapS = RepeatWrapping;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    },
    [gl]
  );

  const loadTextureWithCache = useCallback((url: string) => {
    if (textureCache.current.has(url)) {
      return textureCache.current.get(url) as Texture;
    }

    const texture = new TextureLoader().load(url);
    textureCache.current.set(url, texture);
    return texture;
  }, []);

  const loadTexture = useCallback(
    (url: string, id: 1 | 2) => {
      const resolvedUrl = resolveMediaUrl(url, cdnBaseUrl);
      const texture = loadTextureWithCache(resolvedUrl);
      setTextureProperties(texture);
      if (id === 1) textureOne.current = texture;
      if (id === 2) textureTwo.current = texture;
    },
    [cdnBaseUrl, loadTextureWithCache, setTextureProperties]
  );

  const setBlendMaterialTextureProperties = useCallback(
    (position: Vector3, rotation: number, id: 1 | 2 | 3) => {
      if (id === 1 || id === 3) {
        blendMaterial.current.uniforms.imageOneTexture.value = textureOne.current;
        blendMaterial.current.uniforms.imageOneUvRotation.value = rotation - 90;
        blendMaterial.current.uniforms.imageOnePosition.value = [
          position.x * 10,
          position.y * 10,
          position.z * 10,
        ];
      }

      if (id === 2 || id === 3) {
        blendMaterial.current.uniforms.imageTwoTexture.value = id === 3 ? textureOne.current : textureTwo.current;
        blendMaterial.current.uniforms.imageTwoUvRotation.value = rotation - 90;
        blendMaterial.current.uniforms.imageTwoPosition.value = [
          position.x * 10,
          position.y * 10,
          position.z * 10,
        ];
      }
    },
    []
  );

  const applyMaterial = useCallback(
    (material: Material) => {
      gltf.scene.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          mesh.material = material;
          mesh.receiveShadow = false;
          mesh.castShadow = false;
        }
      });
    },
    [gltf.scene]
  );

  useEffect(() => {
    const debugMaterial = new MeshStandardMaterial();
    applyMaterial(blendMaterial.current);

    return () => {
      debugMaterial.dispose();
    };
  }, [applyMaterial]);

  useEffect(() => {
    if (!transition.toHotspot) return;

    if (
      !transition.inProgress ||
      !transition.fromHotspot ||
      transition.fromHotspot.hotspot.id === transition.toHotspot.hotspot.id
    ) {
      loadTexture(transition.toHotspot.hotspot.mediaUrl, 1);
      loadTexture(transition.toHotspot.hotspot.mediaUrl, 2);
      setBlendMaterialTextureProperties(
        new Vector3(
          transition.toHotspot.hotspot.position.x,
          transition.toHotspot.hotspot.position.y,
          transition.toHotspot.hotspot.position.z
        ),
        transition.toHotspot.hotspot.offsetRotation.y,
        3
      );
      applyMaterial(blendMaterial.current);
      return;
    }

    loadTexture(transition.fromHotspot.hotspot.mediaUrl, 1);
    loadTexture(transition.toHotspot.hotspot.mediaUrl, 2);

    setBlendMaterialTextureProperties(
      new Vector3(
        transition.fromHotspot.hotspot.position.x,
        transition.fromHotspot.hotspot.position.y,
        transition.fromHotspot.hotspot.position.z
      ),
      transition.fromHotspot.hotspot.offsetRotation.y,
      1
    );

    setBlendMaterialTextureProperties(
      new Vector3(
        transition.toHotspot.hotspot.position.x,
        transition.toHotspot.hotspot.position.y,
        transition.toHotspot.hotspot.position.z
      ),
      transition.toHotspot.hotspot.offsetRotation.y,
      2
    );

    applyMaterial(blendMaterial.current);
  }, [applyMaterial, loadTexture, setBlendMaterialTextureProperties, transition.fromHotspot, transition.inProgress, transition.toHotspot]);

  useEffect(() => {
    blendMaterial.current.uniforms.blendAmount.value = transition.inProgress ? transition.progress : 1;
  }, [transition.inProgress, transition.progress]);

  return (
    <group
      position={WEB_APP_3D_CONSTANTS.MODEL_POSITION}
      scale={[modelScale.x, modelScale.y, modelScale.z]}
      name={WEB_APP_3D_CONSTANTS.COLLISION_GROUP_NAME}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function TransitionTweener({
  onTransitionComplete,
}: {
  onTransitionComplete?: (hotspot: TransitionHotspot) => void;
}) {
  const { camera } = useThree();
  const transition = useTransitionContext();
  const startPositionRef = useRef(new Vector3());
  const endPositionRef = useRef(new Vector3());
  const elapsedRef = useRef(0);
  const durationRef = useRef(0.5);

  useEffect(() => {
    if (!transition.inProgress || !transition.fromHotspot || !transition.toHotspot) return;

    startPositionRef.current = camera.position.clone();
    endPositionRef.current = new Vector3(
      transition.toHotspot.hotspot.position.x,
      transition.toHotspot.hotspot.position.y,
      transition.toHotspot.hotspot.position.z
    ).multiplyScalar(10);
    elapsedRef.current = 0;

    const distance = startPositionRef.current.distanceTo(endPositionRef.current);
    if (!distance) {
      durationRef.current = 0.5;
      return;
    }

    const computedMilliseconds = distance / (2.2 * Math.max(Math.log10(Math.max(distance, 10)), 1) * 0.01);
    const computedSeconds = computedMilliseconds / 1000;
    durationRef.current = !computedSeconds || computedSeconds < 0.6 ? 0.6 : computedSeconds;
  }, [camera.position, transition.fromHotspot, transition.inProgress, transition.toHotspot]);

  useFrame((_, delta) => {
    if (!transition.inProgress || !transition.toHotspot) return;

    elapsedRef.current += delta;
    const rawProgress = Math.min(elapsedRef.current / durationRef.current, 1);
    const easedProgress = -(Math.cos(Math.PI * rawProgress) - 1) / 2;

    camera.position.lerpVectors(startPositionRef.current, endPositionRef.current, easedProgress);
    transition.setProgress(easedProgress);

    if (rawProgress >= 1) {
      transition.setInProgress(false);
      transition.setFromHotspot(transition.toHotspot);
      transition.setProgress(0);
      onTransitionComplete?.(transition.toHotspot);
    }
  });

  return null;
}

function SceneContent({
  layout,
  cdnBaseUrl,
  editMode,
  selectedHotspotId,
  positionOverrides,
  modelScale,
  requestedGroupId,
  onHotspotSelect,
  onHotspotDrag,
  onActiveGroupChange,
}: {
  layout: NormalizedLayout3D;
  cdnBaseUrl: string;
  editMode: boolean;
  selectedHotspotId?: string | null;
  positionOverrides: Record<string, Vector3Like>;
  modelScale: Vector3Like;
  requestedGroupId?: string | null;
  onHotspotSelect?: (hotspot: NormalizedHotspot) => void;
  onHotspotDrag?: (hotspotId: string, position: Vector3Like) => void;
  onActiveGroupChange?: (groupId: string | null) => void;
}) {
  const transition = useTransitionContext();
  const camera = useThree((state) => state.camera);
  const currentRaycastPositionRef = useRef<Vector3 | undefined>(undefined);
  const lastHandledRequestedGroupIdRef = useRef<string | null>(null);
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);
  const defaultGroup = useMemo(() => getDefaultGroup(layout), [layout]);
  const defaultHotspot = useMemo(() => getDefaultHotspot(layout), [layout]);

  useEffect(() => {
    if (!defaultGroup || !defaultHotspot) return;
    if (!transition.fromHotspot && !transition.toHotspot) {
      const initial = {
        hotspot: defaultHotspot,
        hotspotGroupId: defaultGroup.id,
        hotspotGroupName: defaultGroup.name,
      };
      transition.setFromHotspot(initial);
      transition.setToHotspot(initial);
      camera.position.set(
        defaultHotspot.position.x * 10,
        defaultHotspot.position.y * 10,
        defaultHotspot.position.z * 10
      );
      lastHandledRequestedGroupIdRef.current = defaultGroup.id;
      onActiveGroupChange?.(defaultGroup.id);
    }
  }, [camera.position, defaultGroup, defaultHotspot, onActiveGroupChange, transition]);

  useEffect(() => {
    if (!requestedGroupId) return;
    if (lastHandledRequestedGroupIdRef.current === requestedGroupId) return;

    const group = layout.hotspotGroups.find((item) => item.id === requestedGroupId);
    if (!group?.defaultHotspotId) return;

    const hotspot = group.hotspots.find((item) => item.id === group.defaultHotspotId) ?? group.hotspots[0];
    if (!hotspot) return;

    lastHandledRequestedGroupIdRef.current = requestedGroupId;
    if (transition.toHotspot?.hotspot.id === hotspot.id) return;

    transition.transitionToHotspot({
      hotspot,
      hotspotGroupId: group.id,
      hotspotGroupName: group.name,
    });
  }, [layout.hotspotGroups, requestedGroupId, transition]);

  useEffect(() => {
    onActiveGroupChange?.(transition.toHotspot?.hotspotGroupId ?? defaultGroup?.id ?? null);
  }, [defaultGroup?.id, onActiveGroupChange, transition.toHotspot]);

  if (!defaultHotspot) return null;

  return (
    <>
      <ProjectionModel layout={layout} cdnBaseUrl={cdnBaseUrl} modelScale={modelScale} />
      <CameraControls enabled={!isDraggingHotspot} />
      <CameraPointer currentRaycastPositionRef={currentRaycastPositionRef} />
      <HotspotsRenderer
        layout={layout}
        currentRaycastPositionRef={currentRaycastPositionRef}
        defaultHotspot={defaultHotspot}
        editMode={editMode}
        selectedHotspotId={selectedHotspotId}
        positionOverrides={positionOverrides}
        onHotspotSelect={onHotspotSelect}
        onHotspotDrag={onHotspotDrag}
        onDraggingChange={setIsDraggingHotspot}
      />
      <TransitionTweener onTransitionComplete={(hotspot) => onActiveGroupChange?.(hotspot.hotspotGroupId)} />
    </>
  );
}

export default function WebApp3DViewer({
  layout3D,
  cdnBaseUrl,
  editMode = false,
  selectedHotspotId,
  positionOverrides = {},
  offsetRotationOverrides = {},
  defaultCameraRotationOverrides = {},
  modelScale,
  requestedGroupId,
  onHotspotSelect,
  onHotspotDrag,
  onActiveGroupChange,
}: WebApp3DViewerProps) {
  const layout = useMemo(
    () => resolveLayoutWithOverrides(
      normalizeLayout3D(layout3D),
      positionOverrides,
      offsetRotationOverrides,
      defaultCameraRotationOverrides
    ),
    [defaultCameraRotationOverrides, layout3D, offsetRotationOverrides, positionOverrides]
  );
  const defaultHotspot = useMemo(() => getDefaultHotspot(layout), [layout]);
  const viewerScale = modelScale ?? layout.modelScale;

  const onCanvasCreated = useCallback(({ gl, scene }: { gl: WebGLRenderer; scene: Scene }) => {
    scene.background = new Color('black');
    gl.setClearColor(new Color('black'));
  }, []);

  const defaultCameraRotation = useMemo(() => {
    if (!defaultHotspot) return [0, 0, 0] as [number, number, number];
    return [
      MathUtils.degToRad(defaultHotspot.defaultCameraRotation.x),
      MathUtils.degToRad(defaultHotspot.defaultCameraRotation.y),
      MathUtils.degToRad(defaultHotspot.defaultCameraRotation.z),
    ] as [number, number, number];
  }, [defaultHotspot]);

  if (!defaultHotspot) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 text-sm text-white">
        No hotspots available for this Layout3D.
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        style={{ cursor: WEB_APP_3D_CONSTANTS.CURSOR_STYLE, width: '100%', height: '100%' }}
        camera={{
          fov: WEB_APP_3D_CONSTANTS.CAMERA_FOV,
          near: WEB_APP_3D_CONSTANTS.CAMERA_NEAR,
          far: WEB_APP_3D_CONSTANTS.CAMERA_FAR,
          rotation: defaultCameraRotation,
          position: [0, 0, 0],
        }}
        onCreated={onCanvasCreated}
      >
        <Bvh firstHitOnly>
          <TransitionProvider cdnBaseUrl={cdnBaseUrl}>
            <SceneContent
              layout={layout}
              cdnBaseUrl={cdnBaseUrl}
              editMode={editMode}
              selectedHotspotId={selectedHotspotId}
              positionOverrides={positionOverrides}
              modelScale={viewerScale}
              requestedGroupId={requestedGroupId}
              onHotspotSelect={onHotspotSelect}
              onHotspotDrag={onHotspotDrag}
              onActiveGroupChange={onActiveGroupChange}
            />
          </TransitionProvider>
        </Bvh>
      </Canvas>
    </div>
  );
}
