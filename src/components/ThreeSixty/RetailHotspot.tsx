'use client';

import { useState, useRef } from 'react';
import { Billboard, Circle, Ring, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RetailHotspotProps {
  title: string;
  position: [number, number, number];
  onClick: () => void;
}

function AnimatedText({ hovered, title }: { hovered: boolean; title: string }) {
  const animatedY = useRef(0.2);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!hovered && Math.abs(animatedY.current - 0.2) < 0.001) return;

    const speed = 8;
    const targetY = hovered ? 0.32 : 0.2;
    animatedY.current = THREE.MathUtils.lerp(animatedY.current, targetY, delta * speed);

    if (groupRef.current) {
      groupRef.current.position.y = animatedY.current;
    }
  });

  if (!hovered) return null;

  return (
    <group ref={groupRef} position={[0, animatedY.current, 0]}>
      <Html
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
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

export default function RetailHotspot({ title, position, onClick }: RetailHotspotProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.3 + 0.7;
      ringRef.current.opacity = pulse;
    }
  });

  return (
    <Billboard position={position}>
      <Ring
        args={[0.16, 0.18, 64]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
      >
        <meshBasicMaterial
          ref={ringRef}
          color={hovered ? '#b0b0b0' : '#909090'}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </Ring>
      <Ring
        args={[0.08, 0.16, 64]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
      >
        <meshBasicMaterial
          color="#505050"
          transparent
          opacity={0.65}
          toneMapped={false}
        />
      </Ring>
      <Circle
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
        args={[0.08, 64]}
      >
        <meshBasicMaterial
          color={hovered ? '#ffffff' : '#e8e8e8'}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </Circle>
      <AnimatedText hovered={hovered} title={title} />
    </Billboard>
  );
}
