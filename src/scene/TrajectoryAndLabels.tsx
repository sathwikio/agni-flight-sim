import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import {
  APOGEE_ALTITUDE_KM,
  buildTrajectoryPoints,
  EARTH_RADIUS_UNITS,
  FlightSample,
  sampleGreatCircleUnitVector,
  samplePositionAtU,
  StageId,
  TIMELINE_EVENTS,
  computeRangeProgress,
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

  // Precompute milestone positions along the 3D arc
  const milestones: MilestoneMarker[] = useMemo(() => {
    const specs: {
      id: string;
      title: string;
      subtitle: string;
      u: number;
      stageId: StageId;
    }[] = [
      {
        id: 'launch-pad',
        title: 'LAUNCH COMPLEX IV',
        subtitle: 'Canister Ignition · 0 km',
        u: 0.0,
        stageId: 'launch',
      },
      {
        id: 'stage-sep',
        title: 'BOOST BURNOUT (MECO)',
        subtitle: 'Stage 3 Cutoff · ~255 km',
        u: TIMELINE_EVENTS.stage3Burnout,
        stageId: 'ascent',
      },
      {
        id: 'apogee',
        title: `APOGEE · ${APOGEE_ALTITUDE_KM} KM`,
        subtitle: 'Midcourse Peak Altitude',
        u: TIMELINE_EVENTS.apogee,
        stageId: 'midcourse',
      },
      {
        id: 'reentry',
        title: 'ENTRY INTERFACE',
        subtitle: 'Bow-Shock Plasma Onset · ~120 km',
        u: TIMELINE_EVENTS.reentryInterface,
        stageId: 'reentry',
      },
      {
        id: 'target',
        title: 'TARGET INSTRUMENTATION ZONE',
        subtitle: 'Uninhabited Ocean Range',
        u: 1.0,
        stageId: 'impact',
      },
    ];

    return specs.map((m) => {
      const position = samplePositionAtU(m.u);
      const s = computeRangeProgress(m.u);
      const surfacePos = sampleGreatCircleUnitVector(s).multiplyScalar(EARTH_RADIUS_UNITS);
      return { ...m, position, surfacePos };
    });
  }, []);

  // Dynamic geometry for the traversed portion of the trajectory and nadir drop-line
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

    const markerDotGeo = new THREE.SphereGeometry(0.026, 16, 16);
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

    // Update traversed trajectory polyline up to current sample.u
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
      // Exact tip at current rocket position
      posAttr.setXYZ(count, sample.position.x, sample.position.y, sample.position.z);
      count++;
      activeResources.activeGeo.setDrawRange(0, count);
      posAttr.needsUpdate = true;
    }

    // Update live nadir altitude drop line from rocket to surface
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

  // Convert Vector3 arrays into flat tuple arrays for Drei <Line>
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
          {/* Full projected orbital path */}
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

          {/* Ground-track great-circle arc across the Indian Ocean */}
          <Line
            points={groundTrackTuples}
            color="#38bdf8"
            lineWidth={1.1}
            transparent
            opacity={0.28}
          />

          {/* Active traversed trajectory segment */}
          <primitive
            ref={activeLineRef}
            object={new THREE.Line(activeResources.activeGeo, activeResources.activeMat)}
          />

          {/* Live vertical altitude drop-line from vehicle to nadir point on Earth */}
          <primitive
            ref={nadirLineRef}
            object={new THREE.Line(activeResources.nadirGeo, activeResources.nadirMat)}
          />

          {/* Milestone dots & altitude pillars */}
          {milestones.map((m) => (
            <group key={m.id}>
              <mesh
                position={m.position}
                geometry={activeResources.markerDotGeo}
                material={activeResources.markerDotMat}
              />
              {m.u > 0.05 && m.u < 0.95 && (
                <Line
                  points={[
                    [m.surfacePos.x, m.surfacePos.y, m.surfacePos.z],
                    [m.position.x, m.position.y, m.position.z],
                  ]}
                  color="#fb923c"
                  lineWidth={1}
                  transparent
                  opacity={0.24}
                />
              )}
            </group>
          ))}
        </group>
      )}

      {showFlightLabels && (
        <group>
          {milestones.map((m) => {
            const isPassed = currentU >= m.u - 0.01;
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
                  className={`group flex flex-col items-start rounded border px-2 py-1 text-left backdrop-blur-md transition-all duration-200 select-none ${
                    isPassed
                      ? 'border-orange-500/60 bg-slate-950/80 text-white shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                      : 'border-slate-700/60 bg-slate-950/65 text-slate-300 hover:border-orange-400/60 hover:text-white'
                  }`}
                  style={{ transform: 'translateY(-22px)', minWidth: '132px' }}
                >
                  <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isPassed ? 'bg-orange-400' : 'bg-slate-500'
                      }`}
                    />
                    <span className={isPassed ? 'text-orange-300' : 'text-slate-400'}>
                      {m.title}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-300/90">
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
