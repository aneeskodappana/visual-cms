'use client';

import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { BackSide, Vector3, LinearFilter, Euler } from 'three';
import { useVideoTexture } from '@react-three/drei';

interface ThreeSixtyVideoMeshProps {
  mediaUrl: string;
}

const SPHERE_RADIUS = 100;
const HORIZONTAL_SEGMENTS = 1024;
const VERTICAL_SEGMENTS = 512;

export default function ThreeSixtyVideoMesh({ mediaUrl }: ThreeSixtyVideoMeshProps) {
  const { gl } = useThree();

  const texture = useVideoTexture(mediaUrl, { muted: true });

  useMemo(() => {
    if (texture) {
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    }
  }, [texture, gl]);

  const pos = useMemo(() => new Vector3(0, 0, 0), []);
  const rotationValue = useRef(new Euler(0, 0, 0));

  return (
    <mesh position={pos} rotation={rotationValue.current} scale={[-1, 1, 1]}>
      <sphereGeometry args={[SPHERE_RADIUS, HORIZONTAL_SEGMENTS, VERTICAL_SEGMENTS]} />
      <meshBasicMaterial
        map={texture}
        side={BackSide}
        transparent={true}
        opacity={1}
        toneMapped={false}
      />
    </mesh>
  );
}
