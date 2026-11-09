import React from 'react';
import { MISSION_DURATION_S, TIMELINE_EVENTS } from '../simulation/flightModel';
import { STAGE_DEFINITIONS } from '../simulation/stages';
import {
  PLAYBACK_SPEEDS,
  useSimulationStore,
} from '../simulation/store';

function formatShortTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const EVENT_MARKERS = [
  { label: 'Liftoff', u: TIMELINE_EVENTS.liftoff },
  { label: 'S1 Sep', u: TIMELINE_EVENTS.stage1Separation },
  { label: 'S2 Sep', u: TIMELINE_EVENTS.stage2Separation },
  { label: 'MECO', u: TIMELINE_EVENTS.stage3Burnout },
  { label: 'Apogee', u: TIMELINE_EVENTS.apogee },
  { label: 'Entry', u: TIMELINE_EVENTS.reentryInterface },
  { label: 'Max Q/Heat', u: TIMELINE_EVENTS.peakHeating },
];

export const TimelineDock: React.FC = () => {
  const u = useSimulationStore((s) => s.u);
  const playing = useSimulationStore((s) => s.playing);
  const speed = useSimulationStore((s) => s.speed);
  const stageId = useSimulationStore((s) => s.stageId);
  const setU = useSimulationStore((s) => s.setU);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const restart = useSimulationStore((s) => s.restart);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const selectStage = useSimulationStore((s) => s.selectStage);

  return (
    <footer
      aria-label="Mission Timeline and Playback Controls"
      className="pointer-events-auto border-t border-slate-800/90 bg-[#050914]/92 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-slate-100 backdrop-blur-md sm:px-4 sm:py-3"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2">
        {/* Five Selectable Flight Stages: Single-row horizontal scroll on mobile, 5-col grid on sm+ */}
        <div
          className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0"
          role="tablist"
          aria-label="Selectable Flight Stages"
        >
          {STAGE_DEFINITIONS.map((st) => {
            const isActive = stageId === st.id;
            const isCompleted = u > st.endU;
            const stageProgress = Math.max(
              0,
              Math.min(1, (u - st.startU) / (st.endU - st.startU))
            );

            return (
              <button
                key={st.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => selectStage(st.id)}
                className={`group relative min-w-[118px] shrink-0 overflow-hidden rounded border px-2.5 py-1.5 text-left transition-all sm:min-w-0 sm:px-3 ${
                  isActive
                    ? 'border-orange-500 bg-orange-500/15 text-white shadow-[0_0_16px_rgba(249,115,22,0.18)]'
                    : isCompleted
                    ? 'border-slate-700/80 bg-slate-900/75 text-slate-200 hover:border-orange-400/60'
                    : 'border-slate-800/80 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[9px] sm:text-[10px]">
                  <span
                    className={
                      isActive
                        ? 'font-semibold text-orange-400'
                        : isCompleted
                        ? 'text-orange-300/80'
                        : 'text-slate-500'
                    }
                  >
                    {st.code}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {Math.round(stageProgress * 100)}%
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] font-semibold sm:text-xs">
                  {st.name}
                </div>
                <div className="hidden truncate text-[10px] text-slate-400 sm:block">
                  {st.subtitle}
                </div>

                {/* Bottom progress bar inside stage button */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-800">
                  <div
                    className="h-full bg-orange-500 transition-all duration-75"
                    style={{ width: `${stageProgress * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Deterministic Scrubber Bar + Transport & Speed Controls */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-2 md:flex-row md:items-center md:gap-3">
          {/* Left: Transport Controls (Play/Pause, Restart, Speed) */}
          <div className="flex items-center justify-between gap-2 md:justify-start">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause simulation' : 'Play simulation'}
                className="flex items-center gap-1.5 rounded border border-orange-500 bg-orange-500 px-3 py-1.5 font-mono text-[11px] font-semibold text-slate-950 transition-colors hover:bg-orange-400 sm:px-3.5 sm:text-xs"
              >
                {playing ? (
                  <>
                    <span>❚❚</span>
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <span>▶</span>
                    <span>{u >= 0.999 ? 'REPLAY' : 'PLAY'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={restart}
                aria-label="Restart simulation"
                className="rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 transition-colors hover:border-orange-400 hover:text-white sm:text-xs"
              >
                ↺ <span className="hidden xs:inline">RESTART</span>
              </button>
            </div>

            {/* Playback Speed Multiplier */}
            <div
              className="flex items-center rounded border border-slate-800 bg-slate-950 p-0.5"
              role="group"
              aria-label="Playback Speed"
            >
              {PLAYBACK_SPEEDS.map((s) => {
                const active = speed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`rounded px-1.5 py-1 font-mono text-[10px] transition-colors sm:px-2 sm:text-[11px] ${
                      active
                        ? 'bg-orange-500/25 text-orange-300 border border-orange-500/60 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}×
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right/Center: Scrubber Track with Milestone Ticks */}
          <div className="relative flex flex-1 flex-col justify-center">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>{formatShortTime(u * MISSION_DURATION_S)}</span>
              <div className="hidden items-center gap-3 sm:flex">
                {EVENT_MARKERS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setU(m.u, true)}
                    className={`transition-colors hover:text-orange-300 ${
                      Math.abs(u - m.u) < 0.02 ? 'text-orange-400 font-semibold' : ''
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-slate-400 sm:hidden">
                Drag slider to scrub flight
              </span>
              <span>{formatShortTime(MISSION_DURATION_S)}</span>
            </div>

            <div className="relative flex items-center">
              {/* Custom visual track underneath range input */}
              <div className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-slate-900 ring-1 ring-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-300"
                  style={{ width: `${u * 100}%` }}
                />
              </div>

              {/* Event tick marks on track */}
              {EVENT_MARKERS.map((m) => (
                <div
                  key={m.label}
                  className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-slate-500/70"
                  style={{ left: `${m.u * 100}%` }}
                />
              ))}

              <input
                type="range"
                min={0}
                max={1}
                step={0.0005}
                value={u}
                aria-label="Mission timeline scrubber"
                onChange={(e) => setU(parseFloat(e.target.value), false)}
                className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent accent-orange-500 sm:h-4"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
