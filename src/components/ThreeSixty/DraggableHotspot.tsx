'use client';

import { useState, useRef, useCallback } from 'react';
import { Billboard, Circle, Ring, Html } from '@react-three/drei';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface DraggableHotspotProps {
  title: string;
  position: [number, number, number];
  isSelected?: boolean;
  isDraggable?: boolean;
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrag?: (position: { x: number; y: number; z: number }) => void;
}

const SPHERE_RADIUS = 4;

function AnimatedText({ hovered, title, isSelected }: { hovered: boolean; title: string; isSelected?: boolean }) {
  const animatedY = useRef(0.2);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const show = hovered || isSelected;
    if (!show && Math.abs(animatedY.current - 0.2) < 0.001) return;

    const speed = 8;
    const targetY = show ? 0.32 : 0.2;
    animatedY.current = THREE.MathUtils.lerp(animatedY.current, targetY, delta * speed);

    if (groupRef.current) {
      groupRef.current.position.y = animatedY.current;
    }
  });

  if (!hovered && !isSelected) return null;

  return (
    <group ref={groupRef} position={[0, animatedY.current, 0]}>
      <Html
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(0, 0, 0, 0.6)',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            fontFamily: 'sans-serif',
          }}
        >
          {title.replace(/-/g, ' ')}
        </div>
      </Html>
    </group>
  );
}

export default function DraggableHotspot({
  title,
  position,
  isSelected,
  isDraggable,
  onClick,
  onDragStart,
  onDragEnd,
  onDrag,
}: DraggableHotspotProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const { camera, gl } = useThree();

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
      ringRef.current.opacity = pulse;
    }
  });

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDraggable) return;
    e.stopPropagation();
    isDragging.current = true;
    didDrag.current = false;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onDragStart?.();
  }, [isDraggable, onDragStart]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !isDraggable) return;
    e.stopPropagation();
    didDrag.current = true;

    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const direction = raycaster.ray.direction.normalize();
    const newPos = direction.multiplyScalar(SPHERE_RADIUS);

    onDrag?.({ x: newPos.x, y: newPos.y, z: newPos.z });
  }, [isDraggable, camera, gl, onDrag]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDraggable) {
      onClick?.();
      return;
    }
    const wasDragging = isDragging.current;
    const wasDragged = didDrag.current;
    isDragging.current = false;
    didDrag.current = false;

    if (wasDragging) {
      onDragEnd?.();
    }
    if (!wasDragged) {
      onClick?.();
    }
  }, [isDraggable, onClick, onDragEnd]);

  const baseColor = isSelected ? '#3b82f6' : '#909090';
  const hoverColor = isSelected ? '#60a5fa' : '#b0b0b0';
  const innerColor = isSelected ? '#1d4ed8' : '#505050';
  const dotColor = isSelected ? '#ffffff' : (hovered ? '#ffffff' : '#e8e8e8');

  return (
    <Billboard position={position}>
      <Ring
        args={[0.16, 0.18, 64]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => { setHovered(false); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <meshBasicMaterial
          ref={ringRef}
          color={hovered || isSelected ? hoverColor : baseColor}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </Ring>
      <Ring
        args={[0.08, 0.16, 64]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => { setHovered(false); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <meshBasicMaterial
          color={innerColor}
          transparent
          opacity={0.65}
          toneMapped={false}
        />
      </Ring>
      <Circle
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => { setHovered(false); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        args={[0.08, 64]}
      >
        <meshBasicMaterial
          color={dotColor}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </Circle>
      <AnimatedText hovered={hovered} title={title} isSelected={isSelected} />
    </Billboard>
  );
}
