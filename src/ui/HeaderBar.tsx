import React, { useMemo } from 'react';
import {
  evaluateFlightAt,
  TIME_COMPRESSION_AT_1X,
} from '../simulation/flightModel';
import { STAGE_DEFINITIONS } from '../simulation/stages';
import { useSimulationStore } from '../simulation/store';

function formatClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const HeaderBar: React.FC = () => {
  const u = useSimulationStore((s) => s.u);
  const speed = useSimulationStore((s) => s.speed);
  const menuOpen = useSimulationStore((s) => s.menuOpen);
  const toggleMenu = useSimulationStore((s) => s.toggleMenu);

  const sample = useMemo(() => evaluateFlightAt(u), [u]);
  const stageDef = STAGE_DEFINITIONS[sample.stageIndex] ?? STAGE_DEFINITIONS[0];

  const machSummary =
    sample.machNumber !== null
      ? `Mach ${sample.machNumber.toFixed(1)}`
      : 'Mach N/A (>100 km Space)';

  return (
    <header className="pointer-events-auto border-b border-slate-800/75 bg-[#050914]/82 px-3 py-2 backdrop-blur-md sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
        {/* Top Row on Mobile / Left+Right on Desktop */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-orange-500/50 bg-orange-500/10 font-mono text-[11px] font-semibold text-orange-400">
              AV
            </div>
            <h1 className="truncate text-xs font-semibold tracking-wide text-white uppercase sm:text-sm">
              Ballistic Flight
            </h1>
            <span
              title="All trajectories, speeds, and altitudes are illustrative educational curves, not actual Agni-V performance data."
              className="shrink-0 rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-orange-200"
            >
              Illustrative Data
            </span>
          </div>

          {/* Mobile Menu Button (Right side of top row on <lg) */}
          <button
            type="button"
            onClick={() => toggleMenu()}
            aria-expanded={menuOpen}
            aria-label="Open camera options, telemetry details, and physics explanations menu"
            className={`shrink-0 rounded border px-2.5 py-1 font-mono text-xs font-medium transition-colors lg:hidden ${
              menuOpen
                ? 'border-orange-500 bg-orange-500 text-slate-950 font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-slate-100 hover:border-orange-400/70 hover:text-white'
            }`}
          >
            <span className="sm:hidden">{menuOpen ? '✕ Close' : '☰ Menu'}</span>
            <span className="hidden sm:inline">
              {menuOpen ? '✕ Close Menu' : '☰ Options & Physics'}
            </span>
          </button>
        </div>

        {/* Center: Unobtrusive Live Phase, Altitude, Speed & Mach Readout */}
        <div
          aria-label="Live Flight Status Summary"
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border border-slate-800/80 bg-slate-950/75 px-3 py-1 font-mono text-[11px] sm:text-xs lg:justify-center"
        >
          {/* Current Phase & Phase Progress */}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
            <span className="font-semibold text-orange-400">{stageDef.code}:</span>
            <span className="font-semibold text-white">{stageDef.name}</span>
            <span className="text-[11px] text-slate-300">
              (Phase {Math.round(sample.phaseProgress * 100)}%)
            </span>
          </div>

          <span className="hidden text-slate-700 sm:inline">|</span>

          {/* Altitude */}
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-slate-400">ALT</span>
            <span className="font-semibold text-white">
              {sample.altitudeKm.toFixed(1)} km
            </span>
          </div>

          <span className="hidden text-slate-700 sm:inline">|</span>

          {/* Speed & Mach */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-slate-400">SPEED</span>
            <span className="font-semibold text-white">
              {Math.round(sample.velocityKmh).toLocaleString()} km/h
            </span>
            <span className="text-[11px] text-orange-300">({machSummary})</span>
          </div>

          <span className="hidden text-slate-700 xl:inline">|</span>

          {/* Mission Clock & Time Compression Note */}
          <div className="hidden items-baseline gap-1.5 xl:flex">
            <span className="font-semibold text-orange-400">
              {formatClock(sample.missionTimeS)}
            </span>
            <span className="text-[11px] text-slate-300">
              ({speed}× = {speed * TIME_COMPRESSION_AT_1X}× real time)
            </span>
          </div>
        </div>

        {/* Desktop Menu Button (Right side on lg+) */}
        <div className="hidden shrink-0 lg:block">
          <button
            type="button"
            onClick={() => toggleMenu()}
            aria-expanded={menuOpen}
            aria-label="Open camera options, telemetry details, and physics explanations menu"
            className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
              menuOpen
                ? 'border-orange-500 bg-orange-500 text-slate-950 font-semibold'
                : 'border-slate-700 bg-slate-900/90 text-slate-100 hover:border-orange-400/70 hover:text-white'
            }`}
          >
            <span>{menuOpen ? '✕ Close Menu' : '☰ Options & Physics'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
