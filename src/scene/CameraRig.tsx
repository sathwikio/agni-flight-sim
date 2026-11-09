import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  clamp,
  EARTH_RADIUS_UNITS,
  FlightSample,
  LAUNCH_SITE,
  latLonToVector3,
  sampleGreatCircleUnitVector,
  smoothstep,
  TARGET_ZONE,
} from '../simulation/flightModel';
import { useSimulationStore } from '../simulation/store';

interface CameraRigProps {
  sampleRef: React.MutableRefObject<FlightSample>;
}

export const CameraRig: React.FC<CameraRigProps> = ({ sampleRef }) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const cameraSnapNonce = useSimulationStore((s) => s.cameraSnapNonce);

  const prevModeRef = useRef(cameraMode);
  const prevSnapNonceRef = useRef(cameraSnapNonce);
  const prevTargetRef = useRef(new THREE.Vector3());
  const isInitializedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const transitionRemainingRef = useRef(1.2);

  // Useful fixed vectors for framing the trajectory plane from the east/indian-ocean side
  const framingBasis = useMemo(() => {
    const launchVec = latLonToVector3(LAUNCH_SITE.lat, LAUNCH_SITE.lon, 1).normalize();
    const targetVec = latLonToVector3(TARGET_ZONE.lat, TARGET_ZONE.lon, 1).normalize();
    const midNormal = sampleGreatCircleUnitVector(0.48);
    // Outward normal to the great-circle plane so camera views the entire curved arch in profile
    const planeNormal = new THREE.Vector3().crossVectors(launchVec, targetVec).normalize();
    return { launchVec, targetVec, midNormal, planeNormal };
  }, []);

  const computeIdealCameraFrame = (
    sample: FlightSample,
    mode: typeof cameraMode,
    viewportW: number,
    viewportH: number
  ) => {
    const target = new THREE.Vector3();
    const idealPos = new THREE.Vector3();

    // Scale out camera distance on portrait mobile screens so the Earth & trajectory arc never clip horizontally
    const aspect = viewportW / Math.max(1, viewportH);
    const portraitScale = aspect < 1 ? clamp(1 / Math.pow(aspect, 0.52), 1.0, 1.55) : 1.0;

    if (mode === 'earth') {
      // Wide orbital overview framing the full Indian Ocean trajectory arc and Earth limb
      target.copy(framingBasis.midNormal).multiplyScalar(EARTH_RADIUS_UNITS * 0.42);
      idealPos
        .copy(framingBasis.midNormal)
        .multiplyScalar(21.5 * portraitScale)
        .addScaledVector(framingBasis.planeNormal, 7.2 * portraitScale)
        .add(new THREE.Vector3(0, 2.2, 0));
      return { target, idealPos };
    }

    if (mode === 'free') {
      target.copy(sample.position);
      idealPos
        .copy(sample.position)
        .addScaledVector(sample.upNormal, 1.8 * portraitScale)
        .addScaledVector(framingBasis.planeNormal, 2.8 * portraitScale);
      return { target, idealPos };
    }

    // 'follow' mode: smooth cinematic progression from launch pad -> ascent chase -> orbital midcourse -> re-entry -> target zone
    target.copy(sample.position);

    const u = sample.u;
    const padToAscent = smoothstep(0.0, 0.14, u);
    const ascentToMidcourse = smoothstep(0.18, 0.36, u);
    const midcourseToReentry = smoothstep(0.72, 0.85, u);
    const reentryToImpact = smoothstep(0.93, 1.0, u);

    let dist = THREE.MathUtils.lerp(0.28, 1.35, padToAscent);
    dist = THREE.MathUtils.lerp(dist, 4.85, ascentToMidcourse);
    dist = THREE.MathUtils.lerp(dist, 1.35, midcourseToReentry);
    dist = THREE.MathUtils.lerp(dist, 0.65, reentryToImpact);
    dist *= portraitScale;

    const radialLift =
      THREE.MathUtils.lerp(0.06, 1.4, ascentToMidcourse) *
      (1 - midcourseToReentry * 0.65);

    idealPos
      .copy(sample.position)
      .addScaledVector(framingBasis.planeNormal, dist * 0.88)
      .addScaledVector(sample.upNormal, radialLift + dist * 0.28)
      .addScaledVector(sample.velocityDir, -dist * 0.25);

    // Ensure camera never clips below Earth's surface
    const minCamRadius = EARTH_RADIUS_UNITS + 0.045;
    if (idealPos.length() < minCamRadius) {
      idealPos.normalize().multiplyScalar(minCamRadius);
    }

    return { target, idealPos };
  };

  // Initialize camera on first mount
  useEffect(() => {
    const sample = sampleRef.current;
    const { target, idealPos } = computeIdealCameraFrame(
      sample,
      cameraMode,
      size.width,
      size.height
    );
    camera.up.set(0, 1, 0);
    camera.position.copy(idealPos);
    prevTargetRef.current.copy(target);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    isInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !isInitializedRef.current) return;

    const sample = sampleRef.current;
    const dt = Math.min(delta, 0.05);

    // Detect mode switch or stage-select jump to trigger a smooth camera re-framing transition
    if (
      prevModeRef.current !== cameraMode ||
      prevSnapNonceRef.current !== cameraSnapNonce
    ) {
      prevModeRef.current = cameraMode;
      prevSnapNonceRef.current = cameraSnapNonce;
      transitionRemainingRef.current = 0.95;
    }

    const { target: desiredTarget, idealPos } = computeIdealCameraFrame(
      sample,
      cameraMode,
      size.width,
      size.height
    );

    if (cameraMode === 'follow') {
      const newTarget = controls.target
        .clone()
        .lerp(desiredTarget, 1 - Math.exp(-dt * 14));
      const targetDelta = newTarget.clone().sub(controls.target);
      camera.position.add(targetDelta);
      controls.target.copy(newTarget);

      if (!isUserInteractingRef.current) {
        const pullStrength = transitionRemainingRef.current > 0 ? 4.2 : 1.15;
        camera.position.lerp(idealPos, 1 - Math.exp(-dt * pullStrength));
      }
    } else if (cameraMode === 'earth') {
      controls.target.lerp(desiredTarget, 1 - Math.exp(-dt * 6));
      if (transitionRemainingRef.current > 0 && !isUserInteractingRef.current) {
        camera.position.lerp(idealPos, 1 - Math.exp(-dt * 4.5));
      }
    } else if (cameraMode === 'free') {
      if (transitionRemainingRef.current > 0 && !isUserInteractingRef.current) {
        controls.target.lerp(desiredTarget, 1 - Math.exp(-dt * 6));
        camera.position.lerp(idealPos, 1 - Math.exp(-dt * 4.5));
      }
    }

    if (transitionRemainingRef.current > 0) {
      transitionRemainingRef.current = Math.max(0, transitionRemainingRef.current - dt);
    }

    // Prevent camera from going inside the planet during manual orbit
    const minSurfaceRadius = EARTH_RADIUS_UNITS + 0.035;
    if (camera.position.length() < minSurfaceRadius) {
      camera.position.normalize().multiplyScalar(minSurfaceRadius);
    }

    controls.update();
    prevTargetRef.current.copy(controls.target);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan={cameraMode !== 'follow'}
      minDistance={0.08}
      maxDistance={58}
      rotateSpeed={0.75}
      zoomSpeed={0.95}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onStart={() => {
        isUserInteractingRef.current = true;
      }}
      onEnd={() => {
        isUserInteractingRef.current = false;
      }}
    />
  );
};
