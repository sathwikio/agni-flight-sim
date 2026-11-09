import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { clamp, FlightSample, TIMELINE_EVENTS } from '../simulation/flightModel';

interface RocketVehicleProps {
  sampleRef: React.MutableRefObject<FlightSample>;
}

const PLUME_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uTime;
  uniform float uExpansion;

  varying vec2 vUv;
  varying float vRadial;

  void main() {
    vUv = uv;
    // Cone geometry built with apex at y=0 and base extending down to y=-1
    float axial = clamp(-position.y, 0.0, 1.0);
    float radialFactor = 1.0 + pow(axial, 1.25) * (uExpansion - 1.0);
    float flutter = 1.0 + 0.045 * sin(uTime * 42.0 - axial * 18.0);
    vec3 displaced = vec3(
      position.x * radialFactor * flutter,
      position.y,
      position.z * radialFactor * flutter
    );
    vRadial = length(position.xz);
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const PLUME_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform float uTime;
  uniform float uIntensity;
  uniform float uExpansion;

  varying vec2 vUv;
  varying float vRadial;

  void main() {
    #include <logdepthbuf_fragment>
    if (uIntensity <= 0.01) discard;

    // vUv.y goes 1 at nozzle exit (top) -> 0 at plume tail (bottom)
    float axial = 1.0 - vUv.y;
    float coreFade = pow(clamp(1.0 - axial, 0.0, 1.0), 1.35);

    // Standing shock cells (Mach diamonds) strongest at lower altitude
    float shockCells = 0.5 + 0.5 * cos(axial * 28.0 - uTime * 35.0);
    float diamondWeight = mix(0.55, 0.15, clamp((uExpansion - 1.0) / 2.3, 0.0, 1.0));
    float modulation = mix(1.0, 0.65 + 0.55 * shockCells, diamondWeight);

    vec3 whiteCore = vec3(1.0, 0.98, 0.9);
    vec3 amberMid = vec3(1.0, 0.56, 0.14);
    vec3 crimsonTail = vec3(0.85, 0.18, 0.05);

    vec3 col = mix(whiteCore, amberMid, smoothstep(0.05, 0.48, axial));
    col = mix(col, crimsonTail, smoothstep(0.45, 0.95, axial));
    col *= modulation * (1.25 + uIntensity * 0.85);

    float alpha = coreFade * uIntensity * smoothstep(0.0, 0.08, axial) * 0.94;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PLASMA_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vLocalPos;
  varying vec3 vNormalDir;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vNormalDir = normalize(normalMatrix * normal);

    // Subtle hypersonic wake ripple along the aft skirt of the shock cone
    float wakeFactor = smoothstep(0.05, -0.18, position.y);
    float ripple = 1.0 + wakeFactor * 0.06 * sin(uTime * 38.0 + position.y * 60.0);
    vec3 pos = vec3(position.x * ripple, position.y, position.z * ripple);

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const PLASMA_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform float uTime;
  uniform float uIntensity;

  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    #include <logdepthbuf_fragment>
    if (uIntensity <= 0.01) discard;

    // Nose stagnation point is at top (+y), wake trails toward -y
    float noseFactor = smoothstep(-0.18, 0.12, vLocalPos.y);
    float flicker = 0.88 + 0.12 * sin(uTime * 48.0 + vLocalPos.y * 45.0);

    vec3 stagnationWhite = vec3(1.0, 0.97, 0.88);
    vec3 shockOrange = vec3(1.0, 0.45, 0.1);
    vec3 ionizedMagenta = vec3(0.85, 0.16, 0.42);

    vec3 color = mix(ionizedMagenta, shockOrange, smoothstep(0.1, 0.65, noseFactor));
    color = mix(color, stagnationWhite, smoothstep(0.65, 0.98, noseFactor));
    color *= flicker * (1.28 + uIntensity * 0.88);

    float alpha = uIntensity * smoothstep(-0.2, 0.08, vLocalPos.y) * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const RocketVehicle: React.FC<RocketVehicleProps> = ({ sampleRef }) => {
  const { camera } = useThree();

  const mainGroupRef = useRef<THREE.Group>(null);
  const stage1GroupRef = useRef<THREE.Group>(null);
  const stage2GroupRef = useRef<THREE.Group>(null);
  const stage3GroupRef = useRef<THREE.Group>(null);
  const shroudGroupRef = useRef<THREE.Group>(null);
  const leftShroudRef = useRef<THREE.Mesh>(null);
  const rightShroudRef = useRef<THREE.Mesh>(null);
  const plumeGroupRef = useRef<THREE.Group>(null);
  const plumeLightRef = useRef<THREE.PointLight>(null);
  const plasmaMeshRef = useRef<THREE.Mesh>(null);
  const plasmaLightRef = useRef<THREE.PointLight>(null);
  const heatShieldTipRef = useRef<THREE.Mesh>(null);
  const sepRingMeshRef = useRef<THREE.Mesh>(null);

  const sep1GroupRef = useRef<THREE.Group>(null);
  const sep2GroupRef = useRef<THREE.Group>(null);
  const sep3GroupRef = useRef<THREE.Group>(null);

  const resources = useMemo(() => {
    // Stage 1: Solid motor casing + 4 base stabilization fins + nozzle
    const s1BodyGeo = new THREE.CylinderGeometry(0.014, 0.0145, 0.09, 28);
    const s1BandGeo = new THREE.CylinderGeometry(0.0143, 0.0143, 0.008, 28);
    const finGeo = new THREE.BoxGeometry(0.018, 0.024, 0.0018);
    const nozzle1Geo = new THREE.CylinderGeometry(0.006, 0.011, 0.016, 20);

    // Stage 2: Composite motor casing + lattice interstage skirt + nozzle
    const interstage12Geo = new THREE.CylinderGeometry(0.0132, 0.014, 0.014, 24);
    const s2BodyGeo = new THREE.CylinderGeometry(0.0128, 0.0132, 0.062, 28);
    const nozzle2Geo = new THREE.CylinderGeometry(0.005, 0.0095, 0.014, 20);

    // Stage 3: Conical/composite upper stage + gimbaled nozzle
    const interstage23Geo = new THREE.CylinderGeometry(0.0108, 0.0128, 0.012, 24);
    const s3BodyGeo = new THREE.CylinderGeometry(0.0105, 0.0108, 0.042, 24);
    const nozzle3Geo = new THREE.CylinderGeometry(0.0042, 0.008, 0.012, 20);

    // Re-entry Vehicle (RV) payload with carbon-phenolic blunt nose tip
    const rvConeGeo = new THREE.ConeGeometry(0.0102, 0.064, 28);
    const rvTipGeo = new THREE.SphereGeometry(0.0032, 20, 20);
    const rvBaseRingGeo = new THREE.CylinderGeometry(0.0103, 0.0105, 0.006, 24);

    // Split clamshell payload fairing halves (jettisoned during Stage 2/3 transition)
    const shroudHalfLeftGeo = new THREE.ConeGeometry(
      0.0113,
      0.072,
      16,
      1,
      true,
      0,
      Math.PI
    );
    const shroudHalfRightGeo = new THREE.ConeGeometry(
      0.0113,
      0.072,
      16,
      1,
      true,
      Math.PI,
      Math.PI
    );

    // Stage separation flash ring
    const sepRingGeo = new THREE.TorusGeometry(0.016, 0.0022, 12, 32);
    sepRingGeo.rotateX(Math.PI / 2);

    // Exhaust plume cone (apex at 0, extending to -0.19 along local -Y)
    const plumeGeo = new THREE.ConeGeometry(0.024, 0.19, 32, 16, true);
    plumeGeo.translate(0, -0.095, 0);
    plumeGeo.rotateX(Math.PI);
    plumeGeo.translate(0, -0.19, 0);

    // Atmospheric re-entry bow-shock plasma envelope around RV
    const plasmaGeo = new THREE.ConeGeometry(0.024, 0.12, 32, 16, true);

    // Materials
    const oliveDrabMat = new THREE.MeshStandardMaterial({
      color: '#4b5842',
      roughness: 0.52,
      metalness: 0.3,
    });
    const whiteMarkingMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.38,
      metalness: 0.22,
    });
    const orangeAccentMat = new THREE.MeshStandardMaterial({
      color: '#ea580c',
      roughness: 0.4,
      metalness: 0.32,
    });
    const interstageMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.46,
      metalness: 0.68,
    });
    const compositeStage3Mat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      roughness: 0.36,
      metalness: 0.52,
    });
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.32,
      metalness: 0.85,
    });
    const rvCarbonMat = new THREE.MeshStandardMaterial({
      color: '#18181b',
      roughness: 0.3,
      metalness: 0.58,
    });
    const rvTipMat = new THREE.MeshStandardMaterial({
      color: '#27272a',
      emissive: '#ff5500',
      emissiveIntensity: 0.0,
      roughness: 0.26,
      metalness: 0.42,
    });
    const shroudMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.4,
      metalness: 0.4,
      side: THREE.DoubleSide,
    });
    const sepRingMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const plumeMat = new THREE.ShaderMaterial({
      vertexShader: PLUME_VERTEX_SHADER,
      fragmentShader: PLUME_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uExpansion: { value: 1 },
      },
    });

    const plasmaMat = new THREE.ShaderMaterial({
      vertexShader: PLASMA_VERTEX_SHADER,
      fragmentShader: PLASMA_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
      },
    });

    return {
      s1BodyGeo,
      s1BandGeo,
      finGeo,
      nozzle1Geo,
      interstage12Geo,
      s2BodyGeo,
      nozzle2Geo,
      interstage23Geo,
      s3BodyGeo,
      nozzle3Geo,
      rvConeGeo,
      rvTipGeo,
      rvBaseRingGeo,
      shroudHalfLeftGeo,
      shroudHalfRightGeo,
      sepRingGeo,
      plumeGeo,
      plasmaGeo,
      oliveDrabMat,
      whiteMarkingMat,
      orangeAccentMat,
      interstageMat,
      compositeStage3Mat,
      nozzleMat,
      rvCarbonMat,
      rvTipMat,
      shroudMat,
      sepRingMat,
      plumeMat,
      plasmaMat,
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

    if (!mainGroupRef.current) return;

    // Position and orient active vehicle
    mainGroupRef.current.position.copy(sample.position);
    mainGroupRef.current.quaternion.copy(sample.quaternion);

    // Dynamic scale: small & accurate close to the launch pad, smoothly scaled up when viewed from space
    const camDist = camera.position.distanceTo(sample.position);
    const dynamicScale = clamp(0.18 + camDist * 0.22, 0.22, 2.25);

    // Shift origin of vehicle group so whichever stage is currently at the bottom sits cleanly at the reference point
    let axialOffset = 0;
    if (!sample.stage1Attached && sample.stage2Attached) {
      axialOffset = -0.104;
    } else if (!sample.stage2Attached && sample.stage3Attached) {
      axialOffset = -0.178;
    } else if (!sample.stage3Attached) {
      axialOffset = -0.232;
    }

    mainGroupRef.current.scale.setScalar(dynamicScale);

    if (stage1GroupRef.current) stage1GroupRef.current.visible = sample.stage1Attached;
    if (stage2GroupRef.current) stage2GroupRef.current.visible = sample.stage2Attached;
    if (stage3GroupRef.current) stage3GroupRef.current.visible = sample.stage3Attached;

    // Animated clamshell fairing separation around stage2Separation
    const shroudSepStart = TIMELINE_EVENTS.stage2Separation;
    const shroudAge = (sample.u - shroudSepStart) / 0.032;
    if (shroudGroupRef.current && leftShroudRef.current && rightShroudRef.current) {
      if (shroudAge <= 0) {
        shroudGroupRef.current.visible = true;
        leftShroudRef.current.position.set(0, 0.272, 0);
        leftShroudRef.current.rotation.set(0, 0, 0);
        rightShroudRef.current.position.set(0, 0.272, 0);
        rightShroudRef.current.rotation.set(0, 0, 0);
      } else if (shroudAge < 1.0) {
        shroudGroupRef.current.visible = true;
        const spread = shroudAge * 0.045;
        const drop = shroudAge * shroudAge * 0.08;
        leftShroudRef.current.position.set(0, 0.272 - drop, spread);
        leftShroudRef.current.rotation.set(shroudAge * 1.6, 0, 0);
        rightShroudRef.current.position.set(0, 0.272 - drop, -spread);
        rightShroudRef.current.rotation.set(-shroudAge * 1.6, 0, 0);
      } else {
        shroudGroupRef.current.visible = false;
      }
    }

    // Position exhaust plume & dynamic flame light at the nozzle exit of whichever stage is actively firing
    if (plumeGroupRef.current) {
      plumeGroupRef.current.visible = sample.thrustIntensity > 0.01;
      let nozzleY = 0;
      if (sample.activePropulsionStage === 1) nozzleY = 0.0 + axialOffset;
      else if (sample.activePropulsionStage === 2) nozzleY = 0.098 + axialOffset;
      else if (sample.activePropulsionStage === 3) nozzleY = 0.172 + axialOffset;
      plumeGroupRef.current.position.set(0, nozzleY, 0);
    }

    if (plumeLightRef.current) {
      plumeLightRef.current.intensity = sample.thrustIntensity * 2.2;
    }

    resources.plumeMat.uniforms.uTime.value = t;
    resources.plumeMat.uniforms.uIntensity.value = sample.thrustIntensity;
    resources.plumeMat.uniforms.uExpansion.value = sample.plumeExpansion;

    // Interstage separation pyrotechnic flash ring
    if (sepRingMeshRef.current) {
      const sepEvents = [
        TIMELINE_EVENTS.stage1Separation,
        TIMELINE_EVENTS.stage2Separation,
        TIMELINE_EVENTS.stage3Burnout,
      ];
      let ringAlpha = 0;
      let ringScale = 1;
      for (const evU of sepEvents) {
        const dtU = sample.u - evU;
        if (dtU >= -0.002 && dtU <= 0.016) {
          const norm = clamp((dtU + 0.002) / 0.018, 0, 1);
          ringAlpha = Math.sin(norm * Math.PI) * 0.9;
          ringScale = 0.8 + norm * 2.4;
          break;
        }
      }
      sepRingMeshRef.current.visible = ringAlpha > 0.01;
      sepRingMeshRef.current.scale.setScalar(ringScale);
      resources.sepRingMat.opacity = ringAlpha;
    }

    // Re-entry plasma sheath & glowing carbon-phenolic nose tip
    if (plasmaMeshRef.current) {
      plasmaMeshRef.current.visible = sample.plasmaIntensity > 0.01;
      plasmaMeshRef.current.position.set(0, 0.264 + axialOffset, 0);
    }
    if (plasmaLightRef.current) {
      plasmaLightRef.current.intensity = sample.plasmaIntensity * 2.6;
      plasmaLightRef.current.position.set(0, 0.28 + axialOffset, 0);
    }
    resources.plasmaMat.uniforms.uTime.value = t;
    resources.plasmaMat.uniforms.uIntensity.value = sample.plasmaIntensity;
    resources.rvTipMat.emissiveIntensity = sample.plasmaIntensity * 3.0;

    // Apply axial offset to attached stages so active vehicle stays centered on sample.position
    if (stage1GroupRef.current) stage1GroupRef.current.position.y = axialOffset;
    if (stage2GroupRef.current) stage2GroupRef.current.position.y = axialOffset;
    if (stage3GroupRef.current) stage3GroupRef.current.position.y = axialOffset;

    // Update separated booster stages tumbling away in the wake
    if (sep1GroupRef.current) {
      sep1GroupRef.current.visible = sample.separatedStage1.visible;
      if (sample.separatedStage1.visible) {
        sep1GroupRef.current.position.copy(sample.separatedStage1.position);
        sep1GroupRef.current.quaternion.copy(sample.separatedStage1.quaternion);
        sep1GroupRef.current.scale.setScalar(dynamicScale);
      }
    }

    if (sep2GroupRef.current) {
      sep2GroupRef.current.visible = sample.separatedStage2.visible;
      if (sample.separatedStage2.visible) {
        sep2GroupRef.current.position.copy(sample.separatedStage2.position);
        sep2GroupRef.current.quaternion.copy(sample.separatedStage2.quaternion);
        sep2GroupRef.current.scale.setScalar(dynamicScale);
      }
    }

    if (sep3GroupRef.current) {
      sep3GroupRef.current.visible = sample.separatedStage3.visible;
      if (sample.separatedStage3.visible) {
        sep3GroupRef.current.position.copy(sample.separatedStage3.position);
        sep3GroupRef.current.quaternion.copy(sample.separatedStage3.quaternion);
        sep3GroupRef.current.scale.setScalar(dynamicScale);
      }
    }
  });

  return (
    <group name="rocket-system">
      {/* Main Active Vehicle */}
      <group ref={mainGroupRef}>
        {/* STAGE 1 (First-Stage Solid Booster: y = 0.016 .. 0.106) */}
        <group ref={stage1GroupRef}>
          <mesh
            geometry={resources.nozzle1Geo}
            material={resources.nozzleMat}
            position={[0, 0.008, 0]}
          />
          <mesh
            geometry={resources.s1BodyGeo}
            material={resources.oliveDrabMat}
            position={[0, 0.061, 0]}
          />
          <mesh
            geometry={resources.s1BandGeo}
            material={resources.orangeAccentMat}
            position={[0, 0.024, 0]}
          />
          <mesh
            geometry={resources.s1BandGeo}
            material={resources.whiteMarkingMat}
            position={[0, 0.095, 0]}
          />
          {/* 4 cruciform aerodynamic fins */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh
                geometry={resources.finGeo}
                material={resources.interstageMat}
                position={[0.017, 0.025, 0]}
              />
            </group>
          ))}
        </group>

        {/* STAGE 2 (Second-Stage Booster: y = 0.106 .. 0.182) */}
        <group ref={stage2GroupRef}>
          <mesh
            geometry={resources.nozzle2Geo}
            material={resources.nozzleMat}
            position={[0, 0.105, 0]}
          />
          <mesh
            geometry={resources.interstage12Geo}
            material={resources.interstageMat}
            position={[0, 0.113, 0]}
          />
          <mesh
            geometry={resources.s2BodyGeo}
            material={resources.oliveDrabMat}
            position={[0, 0.151, 0]}
          />
          <mesh
            geometry={resources.s1BandGeo}
            material={resources.orangeAccentMat}
            position={[0, 0.176, 0]}
            scale={[0.92, 0.85, 0.92]}
          />
        </group>

        {/* STAGE 3 (Third-Stage Composite Motor) */}
        <group ref={stage3GroupRef}>
          <mesh
            geometry={resources.nozzle3Geo}
            material={resources.nozzleMat}
            position={[0, 0.178, 0]}
          />
          <mesh
            geometry={resources.interstage23Geo}
            material={resources.interstageMat}
            position={[0, 0.188, 0]}
          />
          <mesh
            geometry={resources.s3BodyGeo}
            material={resources.compositeStage3Mat}
            position={[0, 0.215, 0]}
          />
        </group>

        {/* RE-ENTRY VEHICLE (RV) PAYLOAD & CLAMSHELL FAIRING */}
        <RvPayloadGroup
          sampleRef={sampleRef}
          resources={resources}
          shroudGroupRef={shroudGroupRef}
          leftShroudRef={leftShroudRef}
          rightShroudRef={rightShroudRef}
          heatShieldTipRef={heatShieldTipRef}
        />

        {/* Stage Separation Pyro Ring */}
        <mesh
          ref={sepRingMeshRef}
          geometry={resources.sepRingGeo}
          material={resources.sepRingMat}
          position={[0, 0.0, 0]}
          visible={false}
        />

        {/* Animated Exhaust Plume & Flame Illumination */}
        <group ref={plumeGroupRef}>
          <mesh geometry={resources.plumeGeo} material={resources.plumeMat} />
          <pointLight
            ref={plumeLightRef}
            color="#ff7b29"
            intensity={0}
            distance={0.65}
            position={[0, -0.04, 0]}
          />
        </group>

        {/* Atmospheric Re-Entry Plasma Sheath & Ionization Glow */}
        <mesh
          ref={plasmaMeshRef}
          geometry={resources.plasmaGeo}
          material={resources.plasmaMat}
          visible={false}
        />
        <pointLight
          ref={plasmaLightRef}
          color="#ff6b2b"
          intensity={0}
          distance={0.75}
        />
      </group>

      {/* Jettisoned Stage 1 Booster */}
      <group ref={sep1GroupRef} visible={false}>
        <mesh
          geometry={resources.nozzle1Geo}
          material={resources.nozzleMat}
          position={[0, -0.045, 0]}
        />
        <mesh
          geometry={resources.s1BodyGeo}
          material={resources.oliveDrabMat}
          position={[0, 0.0, 0]}
        />
        <mesh
          geometry={resources.s1BandGeo}
          material={resources.orangeAccentMat}
          position={[0, -0.035, 0]}
        />
      </group>

      {/* Jettisoned Stage 2 Booster */}
      <group ref={sep2GroupRef} visible={false}>
        <mesh
          geometry={resources.nozzle2Geo}
          material={resources.nozzleMat}
          position={[0, -0.035, 0]}
        />
        <mesh
          geometry={resources.s2BodyGeo}
          material={resources.oliveDrabMat}
          position={[0, 0.0, 0]}
        />
      </group>

      {/* Jettisoned Stage 3 Booster */}
      <group ref={sep3GroupRef} visible={false}>
        <mesh
          geometry={resources.nozzle3Geo}
          material={resources.nozzleMat}
          position={[0, -0.024, 0]}
        />
        <mesh
          geometry={resources.s3BodyGeo}
          material={resources.compositeStage3Mat}
          position={[0, 0.0, 0]}
        />
      </group>
    </group>
  );
};

interface RvPayloadGroupProps {
  sampleRef: React.MutableRefObject<FlightSample>;
  resources: Record<string, THREE.BufferGeometry | THREE.Material>;
  shroudGroupRef: React.RefObject<THREE.Group | null>;
  leftShroudRef: React.RefObject<THREE.Mesh | null>;
  rightShroudRef: React.RefObject<THREE.Mesh | null>;
  heatShieldTipRef: React.RefObject<THREE.Mesh | null>;
}

const RvPayloadGroup: React.FC<RvPayloadGroupProps> = ({
  sampleRef,
  resources,
  shroudGroupRef,
  leftShroudRef,
  rightShroudRef,
  heatShieldTipRef,
}) => {
  const rvGroupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const sample = sampleRef.current;
    if (!rvGroupRef.current) return;
    let axialOffset = 0;
    if (!sample.stage1Attached && sample.stage2Attached) {
      axialOffset = -0.104;
    } else if (!sample.stage2Attached && sample.stage3Attached) {
      axialOffset = -0.178;
    } else if (!sample.stage3Attached) {
      axialOffset = -0.232;
    }
    rvGroupRef.current.position.y = axialOffset;
  });

  return (
    <group ref={rvGroupRef}>
      <mesh
        geometry={resources.rvBaseRingGeo as THREE.BufferGeometry}
        material={resources.orangeAccentMat as THREE.Material}
        position={[0, 0.239, 0]}
      />
      <mesh
        geometry={resources.rvConeGeo as THREE.BufferGeometry}
        material={resources.rvCarbonMat as THREE.Material}
        position={[0, 0.272, 0]}
      />
      <mesh
        ref={heatShieldTipRef}
        geometry={resources.rvTipGeo as THREE.BufferGeometry}
        material={resources.rvTipMat as THREE.Material}
        position={[0, 0.303, 0]}
      />
      {/* Jettisonable Split Clamshell Fairing / Shroud */}
      <group ref={shroudGroupRef}>
        <mesh
          ref={leftShroudRef}
          geometry={resources.shroudHalfLeftGeo as THREE.BufferGeometry}
          material={resources.shroudMat as THREE.Material}
          position={[0, 0.272, 0]}
        />
        <mesh
          ref={rightShroudRef}
          geometry={resources.shroudHalfRightGeo as THREE.BufferGeometry}
          material={resources.shroudMat as THREE.Material}
          position={[0, 0.272, 0]}
        />
      </group>
    </group>
  );
};
