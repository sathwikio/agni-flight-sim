import React, { Suspense, lazy, useEffect } from 'react';
import { STAGE_DEFINITIONS } from './simulation/stages';
import { useSimulationStore } from './simulation/store';
import { EducationalPanel } from './ui/EducationalPanel';
import { HeaderBar } from './ui/HeaderBar';
import { MobileHudBar } from './ui/MobileHudBar';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { TimelineDock } from './ui/TimelineDock';

const SceneCanvas = lazy(() =>
  import('./scene/SceneCanvas').then((m) => ({ default: m.SceneCanvas }))
);

export const App: React.FC = () => {
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const restart = useSimulationStore((s) => s.restart);
  const selectStage = useSimulationStore((s) => s.selectStage);
  const mobilePanel = useSimulationStore((s) => s.mobilePanel);

  // Keyboard shortcuts: Space (Play/Pause), R (Restart), 1-5 (Select Stage)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        restart();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const st = STAGE_DEFINITIONS[idx];
        if (st) selectStage(st.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, restart, selectStage]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#03060c] text-slate-100">
      {/* Full-viewport 3D WebGL Scene */}
      <div className="absolute inset-0 z-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-[#03060c] px-4 text-center font-mono text-xs tracking-widest text-orange-400 uppercase">
              Initializing 3D Orbital Telemetry Engine…
            </div>
          }
        >
          <SceneCanvas />
        </Suspense>
      </div>

      {/* Subtle vignette & telemetry corner grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at center, transparent 58%, rgba(2, 5, 12, 0.68) 100%)',
        }}
      />

      {/* Mission Control UI Overlay Layer */}
      <div className="pointer-events-none relative z-20 flex h-full w-full flex-col justify-between">
        {/* Top Bar + Mobile Compact Live Telemetry Strip */}
        <div>
          <HeaderBar />
          <MobileHudBar />
        </div>

        {/* Middle Floating Panels:
            - On Desktop (lg+): Telemetry (Left) & Science Exhibit (Right) always visible side-by-side
            - On Mobile/Tablet (<lg): Unobstructed 3D canvas by default; opens Telemetry or Science drawer on demand */}
        <main className="relative flex flex-1 flex-col justify-end px-3 py-2 sm:px-4 lg:flex-row lg:items-start lg:justify-between lg:py-3">
          {/* Desktop Left Telemetry Panel */}
          <div className="hidden lg:block">
            <TelemetryPanel />
          </div>

          {/* Mobile On-Demand Drawer (<1024px) */}
          <div className="flex w-full justify-center lg:hidden">
            {mobilePanel === 'telemetry' && <TelemetryPanel />}
            {mobilePanel === 'science' && <EducationalPanel />}
          </div>

          {/* Center bottom hint for orbit camera interaction */}
          {mobilePanel === 'none' && (
            <div className="pointer-events-none mx-auto mb-1 rounded border border-slate-800/70 bg-slate-950/65 px-2.5 py-1 font-mono text-[9px] tracking-wider text-slate-400 backdrop-blur-sm lg:hidden">
              1-FINGER DRAG: ORBIT · 2-FINGER PINCH: ZOOM · TAP TELEMETRY OR PHYSICS ABOVE
            </div>
          )}

          <div className="pointer-events-none hidden self-end rounded border border-slate-800/70 bg-slate-950/65 px-3 py-1 font-mono text-[10px] tracking-wider text-slate-400 backdrop-blur-sm xl:block">
            DRAG TO ORBIT CAMERA · SCROLL TO ZOOM · KEYS [1–5] SELECT STAGE · [SPACE] PLAY/PAUSE
          </div>

          {/* Desktop Right Science Panel */}
          <div className="hidden lg:block">
            <EducationalPanel />
          </div>
        </main>

        {/* Bottom 5-Stage Timeline & Scrubber Dock */}
        <TimelineDock />
      </div>
    </div>
  );
};

export default App;
