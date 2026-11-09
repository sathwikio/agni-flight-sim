import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import {
  APOGEE_ALTITUDE_KM,
  buildTrajectoryPoints,
  computeRangeProgress,
  EARTH_RADIUS_UNITS,
  ENTRY_INTERFACE_ALTITUDE_KM,
  FlightSample,
  KARMAN_LINE_ALTITUDE_KM,
  sampleGreatCircleUnitVector,
  samplePositionAtU,
  StageId,
  TIMELINE_EVENTS,
} from '../simulation/flightModel';
import { useSimulationStore } from '../simulation/store';

interface TrajectoryAndLabelsProps {
  sampleRef: React.MutableRefObject<FlightSample>;
}

const SEGMENTS = 200;

interface MilestoneMarker {
  id: string;
  title: string;
  subtitle: string;
  u: number;
  stageId: StageId;
  offsetY: number;
  position: THREE.Vector3;
  surfacePos: THREE.Vector3;
}

export const TrajectoryAndLabels: React.FC<TrajectoryAndLabelsProps> = ({ sampleRef }) => {
  const showTrajectory = useSimulationStore((s) => s.showTrajectory);
  const showFlightLabels = useSimulationStore((s) => s.showFlightLabels);
  const currentU = useSimulationStore((s) => s.u);
  const setU = useSimulationStore((s) => s.setU);

  const { trajectoryPts, groundTrackPts } = useMemo(
    () => buildTrajectoryPoints(SEGMENTS),
    []
  );

  // Precompute milestone positions along the 3D arc matching TIMELINE_EVENTS and telemetry.
  // Entry Interface (120 km) and Kármán Line (100 km) are labeled separately with distinct vertical offsets so they never overlap.
  const milestones: MilestoneMarker[] = useMemo(() => {
    const specs: {
      id: string;
      title: string;
      subtitle: string;
      u: number;
      stageId: StageId;
      offsetY: number;
    }[] = [
      {
        id: 'launch-pad',
        title: 'LAUNCH PAD · 0 KM',
        subtitle: 'Stationary · Mach 0.0',
        u: 0.0,
        stageId: 'launch',
        offsetY: -26,
      },
      {
        id: 'stage-sep',
        title: 'MECO · 255 KM',
        subtitle: 'Stage 3 Burnout',
        u: TIMELINE_EVENTS.stage3Burnout,
        stageId: 'midcourse',
        offsetY: -26,
      },
      {
        id: 'apogee',
        title: `APOGEE · ${APOGEE_ALTITUDE_KM} KM`,
        subtitle: 'Midcourse Peak Altitude',
        u: TIMELINE_EVENTS.apogee,
        stageId: 'midcourse',
        offsetY: -26,
      },
      {
        id: 'reentry',
        title: `ENTRY INTERFACE · ${ENTRY_INTERFACE_ALTITUDE_KM} KM`,
        subtitle: 'Aerodynamic Heating Onset',
        u: TIMELINE_EVENTS.reentryInterface,
        stageId: 'reentry',
        offsetY: -36,
      },
      {
        id: 'karman',
        title: `KÁRMÁN LINE · ${KARMAN_LINE_ALTITUDE_KM} KM`,
        subtitle: 'Space / Acoustics Boundary',
        u: TIMELINE_EVENTS.karmanLine,
        stageId: 'reentry',
        offsetY: 22,
      },
      {
        id: 'target',
        title: 'TARGET ZONE · 0 KM',
        subtitle: 'Ocean Instrumentation Range',
        u: 1.0,
        stageId: 'impact',
        offsetY: -26,
      },
    ];

    return specs.map((m) => {
      const position = samplePositionAtU(m.u);
      const s = computeRangeProgress(m.u);
      const surfacePos = sampleGreatCircleUnitVector(s).multiplyScalar(EARTH_RADIUS_UNITS);
      return { ...m, position, surfacePos };
    });
  }, []);

  const activeResources = useMemo(() => {
    const activeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array((SEGMENTS + 2) * 3);
    activeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const activeMat = new THREE.LineBasicMaterial({
      color: '#ff7a1a',
      transparent: true,
      opacity: 0.95,
    });

    const nadirGeo = new THREE.BufferGeometry();
    nadirGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    const nadirMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.55,
    });

    const markerDotGeo = new THREE.SphereGeometry(0.016, 16, 16);
    const markerDotMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
    });

    return {
      activeGeo,
      activeMat,
      nadirGeo,
      nadirMat,
      markerDotGeo,
      markerDotMat,
    };
  }, []);

  useEffect(() => {
    return () => {
      activeResources.activeGeo.dispose();
      activeResources.activeMat.dispose();
      activeResources.nadirGeo.dispose();
      activeResources.nadirMat.dispose();
      activeResources.markerDotGeo.dispose();
      activeResources.markerDotMat.dispose();
    };
  }, [activeResources]);

  const activeLineRef = useRef<THREE.Line>(null);
  const nadirLineRef = useRef<THREE.Line>(null);

  useFrame(() => {
    const sample = sampleRef.current;

    if (activeLineRef.current) {
      const posAttr = activeResources.activeGeo.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const maxIndex = Math.floor(sample.u * SEGMENTS);
      let count = 0;
      for (let i = 0; i <= maxIndex; i++) {
        const pt = trajectoryPts[i];
        posAttr.setXYZ(count, pt.x, pt.y, pt.z);
        count++;
      }
      posAttr.setXYZ(count, sample.position.x, sample.position.y, sample.position.z);
      count++;
      activeResources.activeGeo.setDrawRange(0, count);
      posAttr.needsUpdate = true;
    }

    if (nadirLineRef.current) {
      const nadirAttr = activeResources.nadirGeo.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      nadirAttr.setXYZ(
        0,
        sample.surfacePosition.x,
        sample.surfacePosition.y,
        sample.surfacePosition.z
      );
      nadirAttr.setXYZ(1, sample.position.x, sample.position.y, sample.position.z);
      nadirAttr.needsUpdate = true;
    }
  });

  const fullArcTuples = useMemo(
    () => trajectoryPts.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [trajectoryPts]
  );
  const groundTrackTuples = useMemo(
    () => groundTrackPts.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [groundTrackPts]
  );

  return (
    <group name="trajectory-and-labels">
      {showTrajectory && (
        <group>
          <Line
            points={fullArcTuples}
            color="#64748b"
            lineWidth={1.35}
            transparent
            opacity={0.42}
            dashed
            dashSize={0.14}
            gapSize={0.08}
          />

          <Line
            points={groundTrackTuples}
            color="#38bdf8"
            lineWidth={1.1}
            transparent
            opacity={0.28}
          />

          <primitive
            ref={activeLineRef}
            object={new THREE.Line(activeResources.activeGeo, activeResources.activeMat)}
          />

          <primitive
            ref={nadirLineRef}
            object={new THREE.Line(activeResources.nadirGeo, activeResources.nadirMat)}
          />

          {milestones.map((m) => (
            <group key={m.id}>
              {m.u > 0.05 && m.u < 0.99 && (
                <mesh
                  position={m.position}
                  geometry={activeResources.markerDotGeo}
                  material={activeResources.markerDotMat}
                />
              )}
              {m.u > 0.05 && m.u < 0.95 && (
                <Line
                  points={[
                    [m.surfacePos.x, m.surfacePos.y, m.surfacePos.z],
                    [m.position.x, m.position.y, m.position.z],
                  ]}
                  color={m.id === 'karman' ? '#38bdf8' : '#fb923c'}
                  lineWidth={1}
                  transparent
                  opacity={0.25}
                />
              )}
            </group>
          ))}
        </group>
      )}

      {showFlightLabels && (
        <group>
          {milestones.map((m) => {
            const isPassed = currentU >= m.u - 0.004;
            return (
              <Html
                key={m.id}
                position={m.position}
                center
                zIndexRange={[10, 0]}
                style={{ pointerEvents: 'auto' }}
              >
                <button
                  type="button"
                  onClick={() => setU(m.u, true)}
                  className={`group flex flex-col items-start rounded-md border px-2 py-1 text-left backdrop-blur-md transition-all duration-200 select-none ${
                    isPassed
                      ? 'border-orange-500/70 bg-slate-950/88 text-white shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                      : 'border-slate-700/70 bg-slate-950/78 text-slate-200 hover:border-orange-400/70 hover:text-white'
                  }`}
                  style={{
                    transform: `translateY(${m.offsetY}px)`,
                    minWidth: '136px',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isPassed ? 'bg-orange-400' : 'bg-slate-400'
                      }`}
                    />
                    <span className={isPassed ? 'text-orange-300' : 'text-slate-200'}>
                      {m.title}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-300 whitespace-nowrap">
                    {m.subtitle}
                  </div>
                </button>
              </Html>
            );
          })}
        </group>
      )}
    </group>
  );
};
