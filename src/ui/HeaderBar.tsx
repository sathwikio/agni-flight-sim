import React, { useEffect, useState } from 'react';
import { CameraMode, useSimulationStore } from '../simulation/store';

const CAMERA_MODES: { id: CameraMode; label: string; shortLabel: string }[] = [
  { id: 'follow', label: 'Follow Rocket', shortLabel: 'Follow' },
  { id: 'earth', label: 'Earth View', shortLabel: 'Earth' },
  { id: 'free', label: 'Free Camera', shortLabel: 'Free' },
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
  const mobilePanel = useSimulationStore((s) => s.mobilePanel);
  const setMobilePanel = useSimulationStore((s) => s.setMobilePanel);

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
    <header className="pointer-events-auto border-b border-slate-800/80 bg-[#050914]/90 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* Top Row on Mobile / Left Side on Desktop: Brand & Mobile Drawer Toggles */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-orange-500/50 bg-orange-500/10 font-mono text-xs font-semibold text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
              AV
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xs font-semibold tracking-wide text-white uppercase sm:text-sm">
                  Ballistic Flight Dynamics
                </h1>
                <span className="hidden rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-orange-300 uppercase xl:inline-block">
                  Illustrative Educational Simulation
                </span>
              </div>
              <p className="truncate text-[10px] text-slate-400 sm:text-[11px]">
                Three-Stage Flight Exhibit · Inspired by Agni-V Phases
              </p>
            </div>
          </div>

          {/* Mobile/Tablet Drawer Switcher Buttons (hidden on lg+ where both panels float side-by-side) */}
          <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel('telemetry')}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                mobilePanel === 'telemetry'
                  ? 'border-orange-500 bg-orange-500 text-slate-950 font-semibold'
                  : 'border-slate-700 bg-slate-900/90 text-slate-200'
              }`}
            >
              Telemetry
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel('science')}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                mobilePanel === 'science'
                  ? 'border-sky-400 bg-sky-400 text-slate-950 font-semibold'
                  : 'border-slate-700 bg-slate-900/90 text-slate-200'
              }`}
            >
              Physics
            </button>
          </div>
        </div>

        {/* Bottom Row on Mobile (horizontally scrollable) / Right Side on Desktop: Camera & Scene Controls */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0">
          {/* Camera Selector */}
          <div
            className="flex shrink-0 items-center rounded border border-slate-800 bg-slate-950/90 p-0.5"
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
                  className={`rounded px-2 py-1 font-mono text-[11px] transition-colors sm:px-2.5 ${
                    active
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{m.shortLabel}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Trajectory Arc Toggle */}
          <button
            type="button"
            onClick={toggleTrajectory}
            className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors sm:px-2.5 ${
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
            <span>Arc</span>
            <span className="hidden sm:inline">Trajectory</span>
          </button>

          {/* 3D Flight Labels Toggle */}
          <button
            type="button"
            onClick={toggleFlightLabels}
            className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors sm:px-2.5 ${
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
            <span>Labels</span>
          </button>

          {/* Reduced Quality Mode Toggle + Live FPS Badge */}
          <button
            type="button"
            onClick={toggleQualityMode}
            title="Toggle Reduced Quality Mode for slower devices"
            className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors sm:px-2.5 ${
              qualityMode === 'reduced'
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <span>{qualityMode === 'high' ? '4K' : '2K'}</span>
            <span className="rounded bg-slate-900 px-1.5 py-0.2 text-[10px] text-emerald-400">
              {fps} FPS
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
