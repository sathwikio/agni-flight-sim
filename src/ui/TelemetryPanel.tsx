import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  APOGEE_ALTITUDE_KM,
  computeAltitudeKm,
  computeRangeProgress,
  evaluateFlightAt,
  TIMELINE_EVENTS,
  TOTAL_GROUND_RANGE_KM,
  TOTAL_PATH_DISTANCE_KM,
} from '../simulation/flightModel';
import { STAGE_DEFINITIONS } from '../simulation/stages';
import { useSimulationStore } from '../simulation/store';

function formatMissionClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  const tenths = Math.floor((seconds - whole) * 10);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `T+${mm}:${ss}.${tenths}`;
}

const CHART_W = 280;
const CHART_H = 74;
const PAD_X = 8;
const PAD_Y = 8;

export const TelemetryPanel: React.FC = () => {
  const u = useSimulationStore((s) => s.u);
  const setU = useSimulationStore((s) => s.setU);
  const [collapsed, setCollapsed] = useState(false);

  const sample = useMemo(() => evaluateFlightAt(u), [u]);
  const stageDef = STAGE_DEFINITIONS[sample.stageIndex] ?? STAGE_DEFINITIONS[0];

  const altPercent = Math.min(100, (sample.altitudeKm / APOGEE_ALTITUDE_KM) * 100);
  const velPercent = Math.min(100, (sample.velocityKmh / 25000) * 100);
  const pathPercent = Math.min(
    100,
    (sample.pathDistanceKm / TOTAL_PATH_DISTANCE_KM) * 100
  );

  // Precompute 2D SVG profile points (downrange progress vs altitude)
  const profileData = useMemo(() => {
    const steps = 80;
    const pts: { x: number; y: number; u: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const stepU = i / steps;
      const s = computeRangeProgress(stepU);
      const alt = computeAltitudeKm(stepU);
      const x = PAD_X + s * (CHART_W - PAD_X * 2);
      const y =
        CHART_H -
        PAD_Y -
        (alt / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);
      pts.push({ x, y, u: stepU });
    }
    const pathD = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const areaD = `${pathD} L${(CHART_W - PAD_X).toFixed(1)},${(
      CHART_H - PAD_Y
    ).toFixed(1)} L${PAD_X},${(CHART_H - PAD_Y).toFixed(1)} Z`;

    const eventDots = [
      { label: 'S1', u: TIMELINE_EVENTS.stage1Separation },
      { label: 'S2', u: TIMELINE_EVENTS.stage2Separation },
      { label: 'MECO', u: TIMELINE_EVENTS.stage3Burnout },
      { label: 'APOGEE', u: TIMELINE_EVENTS.apogee },
      { label: 'EI', u: TIMELINE_EVENTS.reentryInterface },
    ].map((ev) => {
      const s = computeRangeProgress(ev.u);
      const alt = computeAltitudeKm(ev.u);
      return {
        ...ev,
        x: PAD_X + s * (CHART_W - PAD_X * 2),
        y:
          CHART_H -
          PAD_Y -
          (alt / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2),
      };
    });

    return { pts, pathD, areaD, eventDots };
  }, []);

  // Current vehicle position on the 2D profile chart
  const activeChartX =
    PAD_X + sample.rangeProgress * (CHART_W - PAD_X * 2);
  const activeChartY =
    CHART_H -
    PAD_Y -
    (sample.altitudeKm / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);

  // Build active partial SVG path up to current u
  const traversedPathD = useMemo(() => {
    const filtered = profileData.pts.filter((p) => p.u <= sample.u);
    filtered.push({ x: activeChartX, y: activeChartY, u: sample.u });
    return filtered
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [profileData.pts, sample.u, activeChartX, activeChartY]);

  const entryLineY =
    CHART_H - PAD_Y - (120 / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      aria-label="Educational Telemetry Panel"
      className="pointer-events-auto w-full max-w-[335px] rounded border border-slate-800/90 bg-[#050914]/88 text-slate-100 shadow-2xl backdrop-blur-md"
    >
      {/* Top Header Strip */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
          <span className="font-mono text-[11px] font-semibold tracking-widest text-slate-200 uppercase">
            Flight Telemetry
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-orange-400">
            {formatMissionClock(sample.missionTimeS)}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white lg:hidden"
          >
            {collapsed ? 'Expand' : 'Minimize'}
          </button>
        </div>
      </div>

      {/* Mandatory Illustrative Telemetry Notice */}
      <div className="border-b border-slate-800/70 bg-orange-500/10 px-3.5 py-1.5">
        <p className="font-mono text-[10px] leading-snug text-orange-200/95">
          ILLUSTRATIVE DATA ONLY — Not actual Agni-V performance, targeting, or guidance parameters.
        </p>
      </div>

      {!collapsed && (
        <div className="space-y-2.5 p-3.5">
          {/* Active Stage Banner */}
          <div className="rounded border border-slate-800/90 bg-slate-950/70 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-orange-400 uppercase">
                {stageDef.code} · CURRENT STAGE
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {(sample.u * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-white">
              {stageDef.name}
            </div>
            <div className="text-[11px] text-slate-400">{stageDef.subtitle}</div>
          </div>

          {/* 2D Altitude vs Downrange Profile Mini-Chart */}
          <div className="rounded border border-slate-800/80 bg-slate-950/70 p-2.5">
            <div className="mb-1 flex items-center justify-between font-mono text-[9px] tracking-wider text-slate-400 uppercase">
              <span>Altitude Profile (0–{APOGEE_ALTITUDE_KM} km)</span>
              <span>Range: {Math.round(TOTAL_GROUND_RANGE_KM).toLocaleString()} km</span>
            </div>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="h-[68px] w-full overflow-visible"
            >
              <defs>
                <linearGradient id="trajAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* 120 km Atmospheric Entry Interface reference line */}
              <line
                x1={PAD_X}
                y1={entryLineY}
                x2={CHART_W - PAD_X}
                y2={entryLineY}
                stroke="#38bdf8"
                strokeOpacity="0.28"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={CHART_W - PAD_X - 2}
                y={entryLineY - 3}
                textAnchor="end"
                fill="#7dd3fc"
                fontSize="7"
                fontFamily="JetBrains Mono, monospace"
                opacity="0.75"
              >
                120 km Karman/Entry
              </text>

              {/* Ground baseline */}
              <line
                x1={PAD_X}
                y1={CHART_H - PAD_Y}
                x2={CHART_W - PAD_X}
                y2={CHART_H - PAD_Y}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Shaded area under full curve */}
              <path d={profileData.areaD} fill="url(#trajAreaGrad)" />

              {/* Full projected curve */}
              <path
                d={profileData.pathD}
                fill="none"
                stroke="#475569"
                strokeWidth="1.4"
                strokeDasharray="3 2"
              />

              {/* Traversed active curve */}
              <path
                d={traversedPathD}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Clickable milestone dots on profile */}
              {profileData.eventDots.map((ev) => (
                <g
                  key={ev.label}
                  className="cursor-pointer"
                  onClick={() => setU(ev.u, true)}
                >
                  <circle
                    cx={ev.x}
                    cy={ev.y}
                    r="2.6"
                    fill={sample.u >= ev.u ? '#fb923c' : '#475569'}
                    stroke="#050914"
                    strokeWidth="1"
                  />
                </g>
              ))}

              {/* Active vehicle reticle */}
              <line
                x1={activeChartX}
                y1={activeChartY}
                x2={activeChartX}
                y2={CHART_H - PAD_Y}
                stroke="#38bdf8"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <circle
                cx={activeChartX}
                cy={activeChartY}
                r="4"
                fill="#fff7ed"
                stroke="#f97316"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Primary Numeric Readouts Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Altitude */}
            <div className="rounded border border-slate-800/80 bg-slate-950/60 p-2">
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Altitude (Illustrative)
              </div>
              <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                <span className="text-base font-semibold text-white">
                  {sample.altitudeKm.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">km</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-orange-500 transition-all duration-75"
                  style={{ width: `${altPercent}%` }}
                />
              </div>
            </div>

            {/* Velocity */}
            <div className="rounded border border-slate-800/80 bg-slate-950/60 p-2">
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Velocity (Illustrative)
              </div>
              <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                <span className="text-base font-semibold text-white">
                  {Math.round(sample.velocityKmh).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">km/h</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                <span>{sample.velocityKms.toFixed(2)} km/s</span>
                <div className="h-1 w-14 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-sky-400 transition-all duration-75"
                    style={{ width: `${velPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Mach Number */}
            <div className="rounded border border-slate-800/80 bg-slate-950/60 p-2">
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Mach Number
              </div>
              {sample.machNumber !== null ? (
                <>
                  <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                    <span className="text-base font-semibold text-orange-300">
                      M {sample.machNumber.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    a ≈ {Math.round(sample.localSoundSpeedMs ?? 300)} m/s local
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 font-mono text-[11px] font-semibold text-slate-300">
                    N/A (Exosphere / Vacuum)
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {sample.u <= 0.035 ? 'On Launch Pad' : 'No acoustic medium >105 km'}
                  </div>
                </>
              )}
            </div>

            {/* Path Distance */}
            <div className="rounded border border-slate-800/80 bg-slate-950/60 p-2">
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Path Distance
              </div>
              <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                <span className="text-base font-semibold text-white">
                  {Math.round(sample.pathDistanceKm).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">km</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                <span>Ground: {Math.round(sample.downrangeKm).toLocaleString()} km</span>
                <div className="h-1 w-10 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-orange-400"
                    style={{ width: `${pathPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Atmospheric Layer & Propulsion Status */}
          <div className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-950/60 px-3 py-1.5">
            <div>
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Atmospheric Layer
              </div>
              <div className="font-mono text-xs font-semibold text-sky-300">
                {sample.atmosphereLayer}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Vehicle Configuration
              </div>
              <div className="font-mono text-xs font-medium text-slate-200">
                {sample.activePropulsionStage > 0
                  ? `Stage ${sample.activePropulsionStage} Solid Burn`
                  : sample.plasmaIntensity > 0.05
                  ? 'RV Hypersonic Plasma'
                  : sample.u >= 0.995
                  ? 'Target Arrival Complete'
                  : sample.u <= 0.035
                  ? 'Pad Pre-Ignition'
                  : 'RV Ballistic Coast'}
              </div>
            </div>
          </div>

          {/* Booster Stage Status Pills */}
          <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
            {[
              { label: 'STG 1', attached: sample.stage1Attached, firing: sample.activePropulsionStage === 1 },
              { label: 'STG 2', attached: sample.stage2Attached, firing: sample.activePropulsionStage === 2 },
              { label: 'STG 3', attached: sample.stage3Attached, firing: sample.activePropulsionStage === 3 },
              { label: 'RV CONE', attached: true, firing: sample.plasmaIntensity > 0.05 },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded border px-2 py-1 text-center ${
                  item.firing
                    ? 'border-orange-500 bg-orange-500/20 text-orange-200 font-semibold'
                    : item.attached
                    ? 'border-slate-700 bg-slate-900/70 text-slate-300'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-600 line-through'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Scientific Note on Mach Number in Space */}
          <div className="rounded border border-slate-800/80 bg-slate-950/80 p-2 text-[11px] leading-relaxed text-slate-300">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-orange-400 uppercase">
              Acoustics Note:{' '}
            </span>
            Mach number (M = v / a) measures speed relative to the local speed of sound{' '}
            <span className="font-mono text-slate-200">a = √(γ·R·T)</span>. Above ~105 km in the thermosphere and exosphere, gas molecules are too sparse to propagate sound waves, so Mach numbers are not physically meaningful in space.
          </div>
        </div>
      )}
    </motion.aside>
  );
};
