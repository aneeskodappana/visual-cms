'use client';

import { useMemo, useRef } from 'react';
import { useThree, useLoader } from '@react-three/fiber';
import { BackSide, RepeatWrapping, Vector3, LinearFilter, Euler, TextureLoader } from 'three';

interface ThreeSixtyImageMeshProps {
  mediaUrl: string;
}

const SPHERE_RADIUS = 100;
const HORIZONTAL_SEGMENTS = 1024;
const VERTICAL_SEGMENTS = 512;

export default function ThreeSixtyImageMesh({ mediaUrl }: ThreeSixtyImageMeshProps) {
  const { gl } = useThree();

  const texture = useLoader(TextureLoader, mediaUrl);

  useMemo(() => {
    texture.repeat.set(-1, 1);
    texture.wrapS = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  }, [texture, gl.capabilities]);

  const pos = useMemo(() => new Vector3(0, 0, 0), []);
  const rotationValue = useRef(new Euler(0, 0, 0));

  return (
    <mesh position={pos} rotation={rotationValue.current}>
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
