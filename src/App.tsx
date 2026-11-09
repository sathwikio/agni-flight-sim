import React, { Suspense, lazy, useEffect } from 'react';
import { STAGE_DEFINITIONS } from './simulation/stages';
import { useSimulationStore } from './simulation/store';
import { HeaderBar } from './ui/HeaderBar';
import { OptionalMenuDrawer } from './ui/OptionalMenuDrawer';
import { TimelineDock } from './ui/TimelineDock';

const SceneCanvas = lazy(() =>
  import('./scene/SceneCanvas').then((m) => ({ default: m.SceneCanvas }))
);

export const App: React.FC = () => {
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const restart = useSimulationStore((s) => s.restart);
  const selectStage = useSimulationStore((s) => s.selectStage);
  const toggleMenu = useSimulationStore((s) => s.toggleMenu);

  // Keyboard shortcuts: Space (Play/Pause), R (Restart), M (Menu), 1-5 (Select Stage)
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
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMenu();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const st = STAGE_DEFINITIONS[idx];
        if (st) selectStage(st.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, restart, selectStage, toggleMenu]);

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

      {/* Subtle vignette around edges */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at center, transparent 64%, rgba(2, 5, 12, 0.58) 100%)',
        }}
      />

      {/* Minimal, Unobtrusive Mission HUD Overlay Layer */}
      <div className="pointer-events-none relative z-20 flex h-full w-full flex-col justify-between">
        {/* Top Bar: Title, Illustrative Disclaimer, Unobtrusive Phase/Alt/Speed Readout, and Single Menu Button */}
        <HeaderBar />

        {/* Middle Area: 100% Unobstructed 3D Flight View by default; Optional Menu Drawer on Right when toggled */}
        <main className="relative flex flex-1 items-start justify-end overflow-hidden px-3 py-2 sm:px-5 sm:py-3">
          <OptionalMenuDrawer />
        </main>

        {/* Bottom Dock: Only Play/Pause, Restart, and Slim Draggable Timeline */}
        <TimelineDock />
      </div>
    </div>
  );
};

export default App;
