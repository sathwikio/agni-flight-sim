import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  EARTH_RADIUS_UNITS,
  FlightSample,
  LAUNCH_SITE,
  latLonToVector3,
  TARGET_ZONE,
} from '../simulation/flightModel';

interface LaunchComplexAndTargetProps {
  sampleRef: React.MutableRefObject<FlightSample>;
}

function buildSurfaceFrame(lat: number, lon: number, radius: number = EARTH_RADIUS_UNITS) {
  const pos = latLonToVector3(lat, lon, radius);
  const up = pos.clone().normalize();
  const northRef = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(northRef, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  const m = new THREE.Matrix4().makeBasis(east, up, north);
  const quat = new THREE.Quaternion().setFromRotationMatrix(m);
  return { pos, quat, up };
}

const SMOKE_COUNT = 28;

export const LaunchComplexAndTarget: React.FC<LaunchComplexAndTargetProps> = ({ sampleRef }) => {
  const launchFrame = useMemo(() => buildSurfaceFrame(LAUNCH_SITE.lat, LAUNCH_SITE.lon), []);
  const targetFrame = useMemo(() => buildSurfaceFrame(TARGET_ZONE.lat, TARGET_ZONE.lon), []);

  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const padLightRef = useRef<THREE.PointLight>(null);
  const pulseOuterRef = useRef<THREE.Mesh>(null);
  const pulseInnerRef = useRef<THREE.Mesh>(null);
  const pulseBeaconRef = useRef<THREE.Mesh>(null);
  const impactLightRef = useRef<THREE.PointLight>(null);

  // Pre-generate deterministic smoke puff seeds around the flame trench
  const smokeSeeds = useMemo(() => {
    const seeds = [];
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const angle = (i / SMOKE_COUNT) * Math.PI * 2 + (i % 3) * 0.4;
      const radialSpeed = 0.45 + ((i * 7) % 11) * 0.08;
      const riseSpeed = 0.22 + ((i * 5) % 9) * 0.05;
      const phaseOffset = (i / SMOKE_COUNT) * 0.85;
      seeds.push({ angle, radialSpeed, riseSpeed, phaseOffset });
    }
    return seeds;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Shared geometries & materials with explicit disposal
  const resources = useMemo(() => {
    const padBaseGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.005, 24);
    const trenchGeo = new THREE.BoxGeometry(0.022, 0.004, 0.048);
    const towerGeo = new THREE.BoxGeometry(0.0045, 0.052, 0.0045);
    const canisterCradleGeo = new THREE.CylinderGeometry(0.0048, 0.0052, 0.018, 16);
    const smokeGeo = new THREE.IcosahedronGeometry(0.006, 1);

    const padMat = new THREE.MeshStandardMaterial({
      color: '#2b3340',
      roughness: 0.78,
      metalness: 0.25,
    });
    const towerMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.5,
      metalness: 0.6,
    });
    const cradleMat = new THREE.MeshStandardMaterial({
      color: '#4d5b43',
      roughness: 0.65,
      metalness: 0.35,
    });
    const smokeMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      emissive: '#ff7b29',
      emissiveIntensity: 0.35,
      roughness: 0.95,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    const targetRingGeo1 = new THREE.RingGeometry(0.018, 0.022, 48);
    targetRingGeo1.rotateX(-Math.PI / 2);
    const targetRingGeo2 = new THREE.RingGeometry(0.042, 0.046, 64);
    targetRingGeo2.rotateX(-Math.PI / 2);
    const pulseSphereGeo = new THREE.SphereGeometry(0.012, 24, 24);

    const targetBaseMat = new THREE.MeshBasicMaterial({
      color: '#f97316',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pulseOuterMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pulseInnerMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pulseBeaconMat = new THREE.MeshBasicMaterial({
      color: '#fff7ed',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      padBaseGeo,
      trenchGeo,
      towerGeo,
      canisterCradleGeo,
      smokeGeo,
      padMat,
      towerMat,
      cradleMat,
      smokeMat,
      targetRingGeo1,
      targetRingGeo2,
      pulseSphereGeo,
      targetBaseMat,
      pulseOuterMat,
      pulseInnerMat,
      pulseBeaconMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(resources).forEach((item) => item.dispose());
    };
  }, [resources]);

  useFrame(({ clock }) => {
    const sample = sampleRef.current;
    const t = clock.getElapsedTime();

    // Update launch pad smoke plume
    const smokeIntensity = sample.padSmokeIntensity;
    resources.smokeMat.opacity = smokeIntensity * 0.62;
    resources.smokeMat.emissiveIntensity = sample.thrustIntensity * 0.75 * smokeIntensity;

    if (smokeMeshRef.current) {
      smokeMeshRef.current.visible = smokeIntensity > 0.01;
      if (smokeIntensity > 0.01) {
        for (let i = 0; i < SMOKE_COUNT; i++) {
          const seed = smokeSeeds[i];
          const cycle = (t * 0.9 + seed.phaseOffset) % 1;
          const dist = cycle * 0.048 * seed.radialSpeed * (0.4 + smokeIntensity * 0.9);
          const height = 0.003 + cycle * 0.024 * seed.riseSpeed;
          dummy.position.set(
            Math.cos(seed.angle) * dist,
            height,
            Math.sin(seed.angle) * dist
          );
          const s = (0.5 + cycle * 2.1) * (0.5 + smokeIntensity * 0.7);
          dummy.scale.setScalar(s);
          dummy.rotation.set(cycle * 2, seed.angle, cycle * 1.5);
          dummy.updateMatrix();
          smokeMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        smokeMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    if (padLightRef.current) {
      padLightRef.current.intensity =
        sample.u < 0.09 ? sample.thrustIntensity * 2.8 * (1 - sample.u * 9) : 0;
    }

    // Update non-destructive target zone light pulse on arrival
    const pulse = sample.impactPulse;
    const idleWave = (t * 0.65) % 1;

    if (pulseOuterRef.current) {
      const waveScale = pulse > 0 ? 1 + pulse * 5.5 : 1 + idleWave * 1.35;
      pulseOuterRef.current.scale.setScalar(waveScale);
      resources.pulseOuterMat.opacity =
        pulse > 0 ? (1 - pulse * 0.75) * 0.95 : (1 - idleWave) * 0.35;
    }

    if (pulseInnerRef.current) {
      const innerScale = pulse > 0 ? 0.6 + pulse * 3.2 : 0.8 + Math.sin(t * 3) * 0.12;
      pulseInnerRef.current.scale.setScalar(innerScale);
      resources.pulseInnerMat.opacity = pulse > 0 ? (1 - pulse * 0.5) * 0.95 : 0.45;
    }

    if (pulseBeaconRef.current) {
      pulseBeaconRef.current.visible = pulse > 0.01;
      const domeScale = 0.4 + Math.sin(pulse * Math.PI) * 3.2;
      pulseBeaconRef.current.scale.setScalar(domeScale);
      resources.pulseBeaconMat.opacity = Math.sin(pulse * Math.PI) * 0.85;
    }

    if (impactLightRef.current) {
      impactLightRef.current.intensity = pulse > 0 ? Math.sin(pulse * Math.PI) * 4.5 : 0;
    }
  });

  return (
    <group name="surface-installations">
      {/* Launch Complex IV */}
      <group position={launchFrame.pos} quaternion={launchFrame.quat}>
        <mesh
          geometry={resources.padBaseGeo}
          material={resources.padMat}
          position={[0, 0.002, 0]}
        />
        <mesh
          geometry={resources.trenchGeo}
          material={resources.padMat}
          position={[0, 0.003, 0]}
        />
        {/* Umbilical & lightning mast */}
        <mesh
          geometry={resources.towerGeo}
          material={resources.towerMat}
          position={[-0.014, 0.026, 0]}
        />
        {/* Mobile launch canister base */}
        <mesh
          geometry={resources.canisterCradleGeo}
          material={resources.cradleMat}
          position={[0, 0.009, 0]}
        />
        {/* Ignition & liftoff smoke */}
        <instancedMesh
          ref={smokeMeshRef}
          args={[resources.smokeGeo, resources.smokeMat, SMOKE_COUNT]}
        />
        <pointLight
          ref={padLightRef}
          color="#ff8a3d"
          intensity={0}
          distance={0.6}
          position={[0, 0.02, 0]}
        />
      </group>

      {/* Fictional Uninhabited Target Instrumentation Zone */}
      <group position={targetFrame.pos} quaternion={targetFrame.quat}>
        <mesh
          geometry={resources.targetRingGeo1}
          material={resources.targetBaseMat}
          position={[0, 0.003, 0]}
        />
        <mesh
          ref={pulseInnerRef}
          geometry={resources.targetRingGeo1}
          material={resources.pulseInnerMat}
          position={[0, 0.004, 0]}
        />
        <mesh
          ref={pulseOuterRef}
          geometry={resources.targetRingGeo2}
          material={resources.pulseOuterMat}
          position={[0, 0.004, 0]}
        />
        <mesh
          ref={pulseBeaconRef}
          geometry={resources.pulseSphereGeo}
          material={resources.pulseBeaconMat}
          position={[0, 0.005, 0]}
        />
        <pointLight
          ref={impactLightRef}
          color="#fb923c"
          intensity={0}
          distance={1.2}
          position={[0, 0.04, 0]}
        />
      </group>
    </group>
  );
};
