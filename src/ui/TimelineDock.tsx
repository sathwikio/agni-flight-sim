import React, { useMemo } from 'react';
import {
  APOGEE_ALTITUDE_KM,
  ENTRY_INTERFACE_ALTITUDE_KM,
  evaluateFlightAt,
  KARMAN_LINE_ALTITUDE_KM,
  MISSION_DURATION_S,
  TIME_COMPRESSION_AT_1X,
  TIMELINE_EVENTS,
} from '../simulation/flightModel';
import { STAGE_DEFINITIONS } from '../simulation/stages';
import { useSimulationStore } from '../simulation/store';

function formatShortTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Clean, well-spaced timeline landmarks that correspond directly to phase changes
 * and calibrated telemetry altitudes.
 */
const TIMELINE_MARKERS = [
  {
    id: 'launch',
    label: '1. Launch',
    sublabel: '0 km',
    u: 0.0,
  },
  {
    id: 'ascent',
    label: '2. Ascent',
    sublabel: '24 km',
    u: TIMELINE_EVENTS.ascentStart,
  },
  {
    id: 'midcourse',
    label: '3. Midcourse',
    sublabel: '255 km',
    u: TIMELINE_EVENTS.stage3Burnout,
  },
  {
    id: 'apogee',
    label: 'Apogee',
    sublabel: `${APOGEE_ALTITUDE_KM} km`,
    u: TIMELINE_EVENTS.apogee,
  },
  {
    id: 'reentry',
    label: '4. Entry',
    sublabel: `${ENTRY_INTERFACE_ALTITUDE_KM} km`,
    u: TIMELINE_EVENTS.reentryInterface,
  },
  {
    id: 'karman',
    label: 'Kármán Line',
    sublabel: `${KARMAN_LINE_ALTITUDE_KM} km`,
    u: TIMELINE_EVENTS.karmanLine,
  },
  {
    id: 'impact',
    label: '5. Impact',
    sublabel: '0 km',
    u: 1.0,
  },
] as const;

export const TimelineDock: React.FC = () => {
  const u = useSimulationStore((s) => s.u);
  const playing = useSimulationStore((s) => s.playing);
  const speed = useSimulationStore((s) => s.speed);
  const setU = useSimulationStore((s) => s.setU);
  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const restart = useSimulationStore((s) => s.restart);

  const sample = useMemo(() => evaluateFlightAt(u), [u]);
  const stageDef = STAGE_DEFINITIONS[sample.stageIndex] ?? STAGE_DEFINITIONS[0];

  return (
    <footer
      aria-label="Mission Timeline and Playback Controls"
      className="pointer-events-auto border-t border-slate-800/80 bg-[#050914]/90 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-slate-100 backdrop-blur-md sm:px-5 sm:py-2.5"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2">
        {/* Main Row: Play/Pause + Restart on Left, Slim Draggable Timeline on Right */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {/* Only Play/Pause and Restart as visible buttons */}
          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-start">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause simulation' : 'Play simulation'}
                className="flex min-w-[88px] items-center justify-center gap-1.5 rounded border border-orange-500 bg-orange-500 px-3 py-1.5 font-mono text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-400"
              >
                {playing ? (
                  <>
                    <span>❚❚</span>
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <span>▶</span>
                    <span>{u >= 0.999 ? 'Replay' : 'Play'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={restart}
                aria-label="Restart simulation"
                className="rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 font-mono text-xs font-medium text-slate-200 transition-colors hover:border-orange-400 hover:text-white"
              >
                ↺ Restart
              </button>
            </div>

            {/* Compact clock on mobile right */}
            <div className="font-mono text-[11px] text-slate-300 sm:hidden">
              <span className="font-semibold text-orange-400">
                {formatShortTime(sample.missionTimeS)}
              </span>{' '}
              <span className="text-slate-400">
                ({speed}× = {speed * TIME_COMPRESSION_AT_1X}× real)
              </span>
            </div>
          </div>

          {/* Slim Draggable Timeline & Consistent Progress Labels */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {/* Top Status Row above Slider */}
            <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-300">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="hidden font-semibold text-orange-400 sm:inline">
                  {formatShortTime(sample.missionTimeS)} / {formatShortTime(MISSION_DURATION_S)}
                </span>
                <span>
                  Mission Progress:{' '}
                  <strong className="text-white">{Math.round(sample.u * 100)}%</strong>
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  {stageDef.name} Phase Progress:{' '}
                  <strong className="text-orange-300">
                    {Math.round(sample.phaseProgress * 100)}%
                  </strong>
                </span>
              </div>

              <span className="hidden text-[11px] text-slate-300 lg:inline">
                Playback {speed}× ({speed * TIME_COMPRESSION_AT_1X}× real mission time)
              </span>
            </div>

            {/* Draggable Range Slider Track */}
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-slate-900 ring-1 ring-slate-700/80">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-300"
                  style={{ width: `${sample.u * 100}%` }}
                />
              </div>

              {/* Calibrated Milestone Tick Marks on Track */}
              {TIMELINE_MARKERS.map((m) => (
                <div
                  key={m.id}
                  className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-slate-400/80"
                  style={{ left: `${m.u * 100}%` }}
                />
              ))}

              <input
                type="range"
                min={0}
                max={1}
                step={0.0005}
                value={sample.u}
                aria-label="Mission timeline scrubber"
                onChange={(e) => setU(parseFloat(e.target.value), false)}
                className="relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent accent-orange-500"
              />
            </div>

            {/* Wrapped Milestone Jump Links (never clipped off-screen on mobile or desktop) */}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
              {TIMELINE_MARKERS.map((m) => {
                const isExact = Math.abs(sample.u - m.u) < 0.008;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setU(m.u, true)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors sm:px-2 sm:text-[11px] ${
                      isExact
                        ? 'border border-orange-500/60 bg-orange-500/25 font-semibold text-orange-300'
                        : 'border border-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <span>{m.label}</span>{' '}
                    <span className="text-[10px] text-slate-400">({m.sublabel})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
