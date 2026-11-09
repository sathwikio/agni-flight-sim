import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import {
  evaluateFlightAt,
  FlightSample,
  latLonToVector3,
} from '../simulation/flightModel';
import { useSimulationStore } from '../simulation/store';
import { Earth } from './Earth';
import { LaunchComplexAndTarget } from './LaunchComplexAndTarget';
import { RocketVehicle } from './RocketVehicle';
import { TrajectoryAndLabels } from './TrajectoryAndLabels';
import { CameraRig } from './CameraRig';

const SimulationLoop: React.FC<{
  sampleRef: React.MutableRefObject<FlightSample>;
}> = ({ sampleRef }) => {
  const advanceByDelta = useSimulationStore((s) => s.advanceByDelta);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    advanceByDelta(dt);
    const currentU = useSimulationStore.getState().u;
    sampleRef.current = evaluateFlightAt(currentU);
  });

  return null;
};

export const SceneCanvas: React.FC = () => {
  const qualityMode = useSimulationStore((s) => s.qualityMode);
  const sampleRef = useRef<FlightSample>(
    evaluateFlightAt(useSimulationStore.getState().u)
  );

  // Position sun so the launch and Indian Ocean corridor are brightly lit while
  // Europe/Africa/Western Asia sit across the twilight terminator showing city lights
  const sunDirection = useMemo(
    () => latLonToVector3(14, 128, 1).normalize(),
    []
  );

  const dpr: [number, number] = qualityMode === 'high' ? [1, 2] : [1, 1];
  const starCount = qualityMode === 'high' ? 4500 : 1600;

  return (
    <div className="relative h-full w-full bg-[#03060c]">
      <Canvas
        dpr={dpr}
        gl={{
          antialias: qualityMode === 'high',
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true,
        }}
        camera={{
          fov: 42,
          near: 0.005,
          far: 250,
          position: [0, 0, 26],
        }}
      >
        <color attach="background" args={['#03060c']} />

        {/* Ambient & directional solar illumination */}
        <ambientLight intensity={0.28} color="#93c5fd" />
        <directionalLight
          position={[
            sunDirection.x * 50,
            sunDirection.y * 50,
            sunDirection.z * 50,
          ]}
          intensity={2.4}
          color="#fff7ed"
        />
        <hemisphereLight
          args={['#60a5fa', '#090d16', 0.35]}
        />

        {/* Deep-space starfield */}
        <Stars
          radius={95}
          depth={45}
          count={starCount}
          factor={3.4}
          saturation={0.15}
          fade
          speed={0.25}
        />

        {/* Deterministic frame advancement */}
        <SimulationLoop sampleRef={sampleRef} />

        {/* 3D Earth with day/night city lights, clouds, and Rayleigh scattering */}
        <Earth sunDirection={sunDirection} qualityMode={qualityMode} />

        {/* Launch Complex IV & Southern Ocean Target Instrumentation Zone */}
        <LaunchComplexAndTarget sampleRef={sampleRef} />

        {/* Three-Stage Ballistic Rocket, Separations, Plume & Re-entry Plasma */}
        <RocketVehicle sampleRef={sampleRef} />

        {/* Curved 3D Trajectory Arc, Ground Track & Interactive Milestone Labels */}
        <TrajectoryAndLabels sampleRef={sampleRef} />

        {/* Smooth Multi-Mode Camera & OrbitControls */}
        <CameraRig sampleRef={sampleRef} />
      </Canvas>
    </div>
  );
};
