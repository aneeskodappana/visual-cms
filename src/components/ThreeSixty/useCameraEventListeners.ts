import { useThree } from '@react-three/fiber';
import { useCallback, useEffect } from 'react';
import { Spherical, Vector2, Vector3 } from 'three';
import { CAMERA_CONTROLS_CONSTANTS } from './CameraControls.types';

interface UseCameraEventListenersProps {
  spherical: React.MutableRefObject<Spherical>;
  isPointerDown: React.MutableRefObject<boolean>;
  rotateStart: React.MutableRefObject<Vector2>;
  rotateEnd: React.MutableRefObject<Vector2>;
  rotateDelta: React.MutableRefObject<Vector2>;
}

const useCameraEventListeners = ({
  spherical,
  isPointerDown,
  rotateStart,
  rotateEnd,
  rotateDelta,
}: UseCameraEventListenersProps) => {
  const { camera, gl } = useThree();

  const setInitialValues = useCallback(() => {
    const initialRotationX = camera.rotation.x;
    const initialRotationY = -camera.rotation.y + Math.PI;
    const phi = Math.PI / 2 - initialRotationX;
    const theta = initialRotationY;

    spherical.current.phi = phi;
    spherical.current.theta = theta;

    const targetPosition = new Vector3(0, 0, 0);
    targetPosition
      .setFromSphericalCoords(1, spherical.current.phi, spherical.current.theta)
      .add(camera.position);

    camera.lookAt(targetPosition);
  }, [camera, spherical]);

  const onMove = useCallback(
    (x: number, y: number, speedX: number, speedY: number) => {
      if (!isPointerDown.current) return;
      rotateEnd.current.set(x, y);
      rotateDelta.current
        .subVectors(rotateEnd.current, rotateStart.current)
        .multiply(new Vector2(speedX, speedY));
      rotateStart.current.copy(rotateEnd.current);
    },
    [isPointerDown, rotateEnd, rotateStart, rotateDelta]
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      isPointerDown.current = true;
      rotateStart.current = new Vector2(event.clientX, event.clientY);
    },
    [isPointerDown, rotateStart]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      onMove(
        event.clientX,
        event.clientY,
        CAMERA_CONTROLS_CONSTANTS.MOUSE_SENSITIVITY_X,
        CAMERA_CONTROLS_CONSTANTS.MOUSE_SENSITIVITY_Y
      );
    },
    [onMove]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!event.touches[0]) return;
      onMove(
        event.touches[0].clientX,
        event.touches[0].clientY,
        CAMERA_CONTROLS_CONSTANTS.TOUCH_SENSITIVITY_X,
        CAMERA_CONTROLS_CONSTANTS.TOUCH_SENSITIVITY_Y
      );
    },
    [onMove]
  );

  const handleMouseOver = useCallback(() => {
    if (typeof window !== 'undefined' && window.getSelection()) {
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPointerDown.current = false;
  }, [isPointerDown]);

  const handleTouchStart = useCallback(() => {
    isPointerDown.current = true;
  }, [isPointerDown]);

  const handleTouchEnd = useCallback(() => {
    isPointerDown.current = false;
  }, [isPointerDown]);

  useEffect(() => {
    setInitialValues();
    gl.domElement.addEventListener('mousedown', handleMouseDown);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    gl.domElement.addEventListener('mouseup', handleMouseUp);
    gl.domElement.addEventListener('mouseleave', handleMouseUp);
    gl.domElement.addEventListener('mouseout', handleMouseUp);
    gl.domElement.addEventListener('mouseover', handleMouseOver);
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
      gl.domElement.removeEventListener('mouseover', handleMouseOver);
      gl.domElement.removeEventListener('pointerdown', handleMouseDown);
      gl.domElement.removeEventListener('touchmove', handleTouchMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    camera,
    gl.domElement,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseOver,
    handleTouchMove,
    handleTouchStart,
    handleTouchEnd,
    setInitialValues,
  ]);
};

export default useCameraEventListeners;
