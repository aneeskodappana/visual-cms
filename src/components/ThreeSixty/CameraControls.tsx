'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Camera, Spherical, Vector2, Vector3 } from 'three';
import { CAMERA_CONTROLS_CONSTANTS } from './CameraControls.types';
import useCameraEventListeners from './useCameraEventListeners';

const CameraControls = forwardRef(function CameraControls(_props, ref) {
  const { camera, gl } = useThree();
  const rotateDelta = useRef(new Vector2(0, 0));
  const rotateStart = useRef(new Vector2(0, 0));
  const rotateEnd = useRef(new Vector2(0, 0));
  const spherical = useRef(new Spherical());
  const isPointerDown = useRef(false);

  const rotateVertically = useCallback((angle: number) => {
    spherical.current.phi = Math.max(
      CAMERA_CONTROLS_CONSTANTS.MAX_VERTICAL_ANGLE,
      Math.min(
        CAMERA_CONTROLS_CONSTANTS.MIN_VERTICAL_ANGLE,
        spherical.current.phi - angle
      )
    );
  }, []);

  const rotateHorizontally = useCallback((angle: number) => {
    spherical.current.theta += angle;
  }, []);

  const getCameraPosition = useCallback(() => camera.position, [camera]);

  useCameraEventListeners({
    spherical,
    isPointerDown,
    rotateStart,
    rotateEnd,
    rotateDelta,
  });

  const calculateRotationAngles = useCallback(
    (delta: Vector2, width: number, height: number) => {
      const rotateHorizontalAngle = (2 * Math.PI * delta.x) / width;
      const rotateVerticalAngle = (2 * Math.PI * delta.y) / height;
      return { rotateHorizontalAngle, rotateVerticalAngle };
    },
    []
  );

  const updateTargetPosition = useCallback(
    (cam: Camera, sph: Spherical) => {
      const targetPosition = cam.position
        .clone()
        .setFromSphericalCoords(1, sph.phi, sph.theta)
        .add(cam.position);
      cam.lookAt(targetPosition);
    },
    []
  );

  const applyDamping = useCallback((delta: Vector2) => {
    delta.multiplyScalar(0.95);
    if (Math.abs(delta.x) < 0.1) delta.setX(0);
    if (Math.abs(delta.y) < 0.1) delta.setY(0);
  }, []);

  useFrame(() => {
    if (rotateDelta.current.length() < 0.001) return;
    if (!camera || !gl || !gl.domElement || gl.domElement.width <= 0 || gl.domElement.clientHeight <= 0) return;

    const { width, clientHeight } = gl.domElement;
    const { rotateHorizontalAngle, rotateVerticalAngle } =
      calculateRotationAngles(rotateDelta.current, width, clientHeight);

    rotateHorizontally(rotateHorizontalAngle);
    rotateVertically(rotateVerticalAngle);
    updateTargetPosition(camera, spherical.current);

    if (!isPointerDown.current) {
      applyDamping(rotateDelta.current);
    } else {
      rotateDelta.current.set(0, 0);
    }
  });

  const setLookAt = useCallback(
    (lookAtPosition: Vector3) => {
      camera.lookAt(lookAtPosition);
      const target = lookAtPosition.clone().sub(camera.position);
      spherical.current.setFromVector3(target);
    },
    [camera]
  );

  const setCameraPosition = useCallback(
    (cameraPosition: Vector3) => {
      camera.position.copy(cameraPosition);
    },
    [camera]
  );

  useImperativeHandle(ref, () => ({
    setLookAt,
    setCameraPosition,
    getCameraPosition,
  }));

  return null;
});

export default CameraControls;
