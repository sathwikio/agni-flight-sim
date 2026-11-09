import React, { useMemo } from 'react';
import { evaluateFlightAt } from '../simulation/flightModel';
import { STAGE_DEFINITIONS } from '../simulation/stages';
import { useSimulationStore } from '../simulation/store';

function formatCompactClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MobileHudBar: React.FC = () => {
  const u = useSimulationStore((s) => s.u);
  const mobilePanel = useSimulationStore((s) => s.mobilePanel);
  const setMobilePanel = useSimulationStore((s) => s.setMobilePanel);

  const sample = useMemo(() => evaluateFlightAt(u), [u]);
  const stageDef = STAGE_DEFINITIONS[sample.stageIndex] ?? STAGE_DEFINITIONS[0];

  return (
    <div className="pointer-events-auto border-b border-slate-800/80 bg-[#050914]/82 px-3 py-1.5 backdrop-blur-md lg:hidden">
      {/* Row 1: Stage title, Mission Clock & Illustrative Tag */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setMobilePanel('telemetry')}
          className="flex items-center gap-1.5 truncate text-left"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
          <span className="font-mono text-[10px] font-semibold text-orange-400">
            {stageDef.code}
          </span>
          <span className="truncate font-semibold text-white">
            {stageDef.name}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] text-orange-300">
            Illustrative Data
          </span>
          <span className="text-orange-400 font-semibold">
            {formatCompactClock(sample.missionTimeS)}
          </span>
        </div>
      </div>

      {/* Row 2: Live 4-Metric Strip */}
      <div
        onClick={() => {
          if (mobilePanel === 'none') setMobilePanel('telemetry');
        }}
        className="mt-1 grid cursor-pointer grid-cols-4 gap-1.5 rounded border border-slate-800/80 bg-slate-950/75 px-2 py-1 font-mono"
      >
        <div>
          <div className="text-[8px] text-slate-400 uppercase">Alt</div>
          <div className="text-[11px] font-semibold text-white">
            {sample.altitudeKm.toFixed(0)}{' '}
            <span className="text-[9px] font-normal text-slate-400">km</span>
          </div>
        </div>

        <div>
          <div className="text-[8px] text-slate-400 uppercase">Speed</div>
          <div className="text-[11px] font-semibold text-white">
            {Math.round(sample.velocityKmh).toLocaleString()}{' '}
            <span className="text-[9px] font-normal text-slate-400">km/h</span>
          </div>
        </div>

        <div>
          <div className="text-[8px] text-slate-400 uppercase">Mach</div>
          <div className="text-[11px] font-semibold text-orange-300">
            {sample.machNumber !== null
              ? `M ${sample.machNumber.toFixed(1)}`
              : 'Vacuum'}
          </div>
        </div>

        <div>
          <div className="text-[8px] text-slate-400 uppercase">Layer</div>
          <div className="truncate text-[10px] font-semibold text-sky-300">
            {sample.atmosphereLayer.replace(' (Space)', '')}
          </div>
        </div>
      </div>
    </div>
  );
};
