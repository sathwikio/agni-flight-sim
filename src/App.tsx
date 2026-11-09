import React, { useEffect } from 'react';
import { SceneCanvas } from './scene/SceneCanvas';
import { STAGE_DEFINITIONS } from './simulation/stages';
import { useSimulationStore } from './simulation/store';
import { EducationalPanel } from './ui/EducationalPanel';
import { HeaderBar } from './ui/HeaderBar';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { TimelineDock } from './ui/TimelineDock';

export const App: React.FC = () => {
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const restart = useSimulationStore((s) => s.restart);
  const selectStage = useSimulationStore((s) => s.selectStage);

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
    <div className="relative h-screen w-screen overflow-hidden bg-[#03060c] text-slate-100">
      {/* Full-viewport 3D WebGL Scene */}
      <div className="absolute inset-0 z-0">
        <SceneCanvas />
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
        {/* Top Bar */}
        <HeaderBar />

        {/* Middle Floating Panels: Telemetry (Left) & Science Exhibit (Right) */}
        <main className="flex flex-1 flex-col justify-between gap-3 overflow-y-auto px-4 py-3 lg:flex-row lg:items-start lg:overflow-visible">
          <TelemetryPanel />

          {/* Center bottom hint for orbit camera interaction */}
          <div className="pointer-events-none hidden self-end rounded border border-slate-800/70 bg-slate-950/65 px-3 py-1 font-mono text-[10px] tracking-wider text-slate-400 backdrop-blur-sm xl:block">
            DRAG TO ORBIT CAMERA · SCROLL TO ZOOM · KEYS [1–5] SELECT STAGE · [SPACE] PLAY/PAUSE
          </div>

          <EducationalPanel />
        </main>

        {/* Bottom 5-Stage Timeline & Scrubber Dock */}
        <TimelineDock />
      </div>
    </div>
  );
};

export default App;
