import React, { useEffect, useState } from 'react';
import { CameraMode, useSimulationStore } from '../simulation/store';

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: 'follow', label: 'Follow Rocket' },
  { id: 'earth', label: 'Earth View' },
  { id: 'free', label: 'Free Camera' },
];

export const HeaderBar: React.FC = () => {
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);
  const showTrajectory = useSimulationStore((s) => s.showTrajectory);
  const toggleTrajectory = useSimulationStore((s) => s.toggleTrajectory);
  const showFlightLabels = useSimulationStore((s) => s.showFlightLabels);
  const toggleFlightLabels = useSimulationStore((s) => s.toggleFlightLabels);
  const qualityMode = useSimulationStore((s) => s.qualityMode);
  const toggleQualityMode = useSimulationStore((s) => s.toggleQualityMode);

  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    let frames = 0;
    let lastTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      frames++;
      if (now - lastTime >= 1000) {
        setFps(Math.min(120, Math.round((frames * 1000) / (now - lastTime))));
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#050914]/88 px-4 py-2.5 backdrop-blur-md">
      {/* Left: Museum Exhibit Brand & Illustrative Disclaimer Pill */}
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded border border-orange-500/50 bg-orange-500/10 font-mono text-xs font-semibold text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
          AV
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-wide text-white uppercase">
              Ballistic Flight Dynamics
            </h1>
            <span className="hidden rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-orange-300 uppercase sm:inline-block">
              Illustrative Educational Simulation
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Three-Stage Long-Range Flight Exhibit · Inspired by Agni-V General Flight Phases
          </p>
        </div>
      </div>

      {/* Right: Camera Mode & Scene Layer Toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Camera Selector */}
        <div
          className="flex items-center rounded border border-slate-800 bg-slate-950/90 p-0.5"
          role="group"
          aria-label="Camera Mode"
        >
          {CAMERA_MODES.map((m) => {
            const active = cameraMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCameraMode(m.id)}
                className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  active
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Trajectory Arc Toggle */}
        <button
          type="button"
          onClick={toggleTrajectory}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
            showTrajectory
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
              : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              showTrajectory ? 'bg-orange-400' : 'bg-slate-600'
            }`}
          />
          Trajectory
        </button>

        {/* 3D Flight Labels Toggle */}
        <button
          type="button"
          onClick={toggleFlightLabels}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
            showFlightLabels
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
              : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              showFlightLabels ? 'bg-orange-400' : 'bg-slate-600'
            }`}
          />
          Labels
        </button>

        {/* Reduced Quality Mode Toggle + Live FPS Badge */}
        <button
          type="button"
          onClick={toggleQualityMode}
          title="Toggle Reduced Quality Mode for slower devices"
          className={`flex items-center gap-2 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
            qualityMode === 'reduced'
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
              : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700 hover:text-white'
          }`}
        >
          <span>Quality: {qualityMode === 'high' ? 'High (4K)' : 'Reduced (2K)'}</span>
          <span className="rounded bg-slate-900 px-1.5 py-0.2 text-[10px] text-emerald-400">
            {fps} FPS
          </span>
        </button>
      </div>
    </header>
  );
};
