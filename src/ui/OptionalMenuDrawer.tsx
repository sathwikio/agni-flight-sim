import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  APOGEE_ALTITUDE_KM,
  computeAltitudeKm,
  computeRangeProgress,
  ENTRY_INTERFACE_ALTITUDE_KM,
  evaluateFlightAt,
  KARMAN_LINE_ALTITUDE_KM,
  TIME_COMPRESSION_AT_1X,
  TIMELINE_EVENTS,
  TOTAL_GROUND_RANGE_KM,
  TOTAL_PATH_DISTANCE_KM,
} from '../simulation/flightModel';
import { SCIENCE_CONCEPTS, STAGE_DEFINITIONS } from '../simulation/stages';
import {
  CameraMode,
  MenuSection,
  PLAYBACK_SPEEDS,
  useSimulationStore,
} from '../simulation/store';

const CAMERA_MODES: { id: CameraMode; label: string; desc: string }[] = [
  {
    id: 'follow',
    label: 'Follow Rocket',
    desc: 'Tracks the vehicle from launch pad through orbital coast and re-entry.',
  },
  {
    id: 'earth',
    label: 'Earth View',
    desc: 'Wide orbital perspective framing the entire curved trajectory arc.',
  },
  {
    id: 'free',
    label: 'Free Camera',
    desc: 'Unconstrained orbit and pan around the current vehicle position.',
  },
];

const ALL_CONCEPT_ORDER = [
  'solid-propulsion',
  'multi-stage',
  'curved-trajectory',
  'gravity-midcourse',
  'reentry-heating',
  'atmospheric-drag',
] as const;

const CHART_W = 320;
const CHART_H = 110;
const PAD_X = 10;
const PAD_Y = 12;

function formatMissionClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  const tenths = Math.floor((seconds - whole) * 10);
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const OptionalMenuDrawer: React.FC = () => {
  const menuOpen = useSimulationStore((s) => s.menuOpen);
  const setMenuOpen = useSimulationStore((s) => s.setMenuOpen);
  const menuSection = useSimulationStore((s) => s.menuSection);
  const setMenuSection = useSimulationStore((s) => s.setMenuSection);

  const u = useSimulationStore((s) => s.u);
  const setU = useSimulationStore((s) => s.setU);
  const selectStage = useSimulationStore((s) => s.selectStage);
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);
  const showTrajectory = useSimulationStore((s) => s.showTrajectory);
  const toggleTrajectory = useSimulationStore((s) => s.toggleTrajectory);
  const showFlightLabels = useSimulationStore((s) => s.showFlightLabels);
  const toggleFlightLabels = useSimulationStore((s) => s.toggleFlightLabels);
  const qualityMode = useSimulationStore((s) => s.qualityMode);
  const toggleQualityMode = useSimulationStore((s) => s.toggleQualityMode);
  const selectedConceptId = useSimulationStore((s) => s.selectedConceptId);
  const setSelectedConceptId = useSimulationStore((s) => s.setSelectedConceptId);

  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    if (!menuOpen) return;
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
  }, [menuOpen]);

  const sample = useMemo(() => evaluateFlightAt(u), [u]);
  const stageDef = STAGE_DEFINITIONS[sample.stageIndex] ?? STAGE_DEFINITIONS[0];

  const activeConceptKey = selectedConceptId ?? stageDef.primaryConceptId;
  const activeConcept =
    SCIENCE_CONCEPTS[activeConceptKey] ?? SCIENCE_CONCEPTS['solid-propulsion'];

  // Precompute 2D SVG profile points (downrange progress vs altitude)
  const profileData = useMemo(() => {
    const steps = 90;
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
      { label: 'S1 (68 km)', u: TIMELINE_EVENTS.stage1Separation },
      { label: 'S2 (150 km)', u: TIMELINE_EVENTS.stage2Separation },
      { label: 'MECO (255 km)', u: TIMELINE_EVENTS.stage3Burnout },
      { label: 'Apogee (780 km)', u: TIMELINE_EVENTS.apogee },
      { label: 'Entry (120 km)', u: TIMELINE_EVENTS.reentryInterface },
      { label: 'Kármán (100 km)', u: TIMELINE_EVENTS.karmanLine },
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

  const activeChartX = PAD_X + sample.rangeProgress * (CHART_W - PAD_X * 2);
  const activeChartY =
    CHART_H -
    PAD_Y -
    (sample.altitudeKm / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);

  const traversedPathD = useMemo(() => {
    const filtered = profileData.pts.filter((p) => p.u <= sample.u);
    filtered.push({ x: activeChartX, y: activeChartY, u: sample.u });
    return filtered
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [profileData.pts, sample.u, activeChartX, activeChartY]);

  // Separate Y coordinates for 120 km Entry Interface and 100 km Kármán Line
  const entryInterfaceY =
    CHART_H -
    PAD_Y -
    (ENTRY_INTERFACE_ALTITUDE_KM / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);
  const karmanLineY =
    CHART_H -
    PAD_Y -
    (KARMAN_LINE_ALTITUDE_KM / APOGEE_ALTITUDE_KM) * (CHART_H - PAD_Y * 2);

  return (
    <AnimatePresence>
      {menuOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.22 }}
          aria-label="Options, Telemetry, and Physics Menu"
          className="pointer-events-auto flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-slate-700/90 bg-[#050914]/95 text-slate-100 shadow-2xl backdrop-blur-xl"
        >
          {/* Top Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="font-mono text-xs font-semibold tracking-wider text-white uppercase">
                Mission Guide & Controls
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-xs text-slate-200 hover:border-orange-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>

          {/* 3-Tab Navigation Bar */}
          <div
            role="tablist"
            aria-label="Menu Sections"
            className="grid grid-cols-3 gap-1 border-b border-slate-800 bg-slate-950/90 p-1.5"
          >
            {(
              [
                { id: 'telemetry', label: 'Telemetry' },
                { id: 'physics', label: 'Physics Guide' },
                { id: 'controls', label: 'Camera & Speed' },
              ] as { id: MenuSection; label: string }[]
            ).map((tab) => {
              const active = menuSection === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setMenuSection(tab.id)}
                  className={`rounded py-1.5 font-mono text-xs transition-colors ${
                    active
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Illustrative Data Disclaimer Banner (Always Accessible) */}
          <div className="border-b border-slate-800/80 bg-orange-500/10 px-4 py-2">
            <p className="font-mono text-[11px] leading-snug text-orange-200">
              <strong>ILLUSTRATIVE DATA ONLY:</strong> All trajectory curves, altitudes, velocities, and stage timings are simplified educational models—not actual Agni-V performance or targeting data.
            </p>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
            {menuSection === 'telemetry' && (
              <>
                {/* Consistent Mission Progress vs Phase Progress Card */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-orange-400">
                      {stageDef.code} · {stageDef.name}
                    </span>
                    <span className="text-slate-300">
                      {formatMissionClock(sample.missionTimeS)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300">
                    {stageDef.subtitle}
                  </div>

                  {/* Dual Progress Bars: Mission Progress vs Phase Progress */}
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-2.5 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>Mission Progress</span>
                        <strong className="text-white">
                          {(sample.u * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${sample.u * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>Phase Progress</span>
                        <strong className="text-sky-300">
                          {(sample.phaseProgress * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-sky-400"
                          style={{ width: `${sample.phaseProgress * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2D Altitude Chart with Separate 120 km Entry Interface & 100 km Kármán Line */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] text-slate-300">
                    <span>Altitude Profile (Peak {APOGEE_ALTITUDE_KM} km)</span>
                    <span>Range: {Math.round(TOTAL_GROUND_RANGE_KM).toLocaleString()} km</span>
                  </div>
                  <svg
                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                    className="h-[104px] w-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="trajAreaGradMenu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* 120 km Illustrative Entry Interface Reference Line */}
                    <line
                      x1={PAD_X}
                      y1={entryInterfaceY}
                      x2={CHART_W - PAD_X}
                      y2={entryInterfaceY}
                      stroke="#fb923c"
                      strokeOpacity="0.5"
                      strokeDasharray="4 3"
                      strokeWidth="1"
                    />
                    <text
                      x={CHART_W * 0.48}
                      y={entryInterfaceY - 3}
                      textAnchor="middle"
                      fill="#fdba74"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      120 km Entry Interface
                    </text>

                    {/* 100 km Kármán Line Reference Line (Separate from 120 km Entry Interface) */}
                    <line
                      x1={PAD_X}
                      y1={karmanLineY}
                      x2={CHART_W - PAD_X}
                      y2={karmanLineY}
                      stroke="#38bdf8"
                      strokeOpacity="0.5"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                    />
                    <text
                      x={CHART_W * 0.48}
                      y={karmanLineY + 8.5}
                      textAnchor="middle"
                      fill="#7dd3fc"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      100 km Kármán Line (Space Boundary)
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

                    <path d={profileData.areaD} fill="url(#trajAreaGradMenu)" />
                    <path
                      d={profileData.pathD}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                    <path
                      d={traversedPathD}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />

                    {profileData.eventDots.map((ev) => (
                      <g
                        key={ev.label}
                        className="cursor-pointer"
                        onClick={() => setU(ev.u, true)}
                      >
                        <circle
                          cx={ev.x}
                          cy={ev.y}
                          r="3"
                          fill={sample.u >= ev.u ? '#fb923c' : '#64748b'}
                          stroke="#050914"
                          strokeWidth="1"
                        />
                      </g>
                    ))}

                    <line
                      x1={activeChartX}
                      y1={activeChartY}
                      x2={activeChartX}
                      y2={CHART_H - PAD_Y}
                      stroke="#38bdf8"
                      strokeOpacity="0.55"
                      strokeWidth="1"
                    />
                    <circle
                      cx={activeChartX}
                      cy={activeChartY}
                      r="4.2"
                      fill="#fff7ed"
                      stroke="#f97316"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                {/* Primary Telemetry Readouts */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded border border-slate-800 bg-slate-950/75 p-2.5">
                    <div className="font-mono text-[11px] text-slate-400 uppercase">
                      Altitude (Illustrative)
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold text-white">
                      {sample.altitudeKm.toFixed(1)} km
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-sky-300">
                      {sample.atmosphereLayer}
                    </div>
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-950/75 p-2.5">
                    <div className="font-mono text-[11px] text-slate-400 uppercase">
                      Speed (Illustrative)
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold text-white">
                      {Math.round(sample.velocityKmh).toLocaleString()} km/h
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-300">
                      {sample.velocityKms.toFixed(2)} km/s
                    </div>
                  </div>

                  {/* Mach Number (Mach 0.0 on launch pad; N/A above 100 km Kármán line) */}
                  <div className="rounded border border-slate-800 bg-slate-950/75 p-2.5">
                    <div className="font-mono text-[11px] text-slate-400 uppercase">
                      Mach Number
                    </div>
                    {sample.machNumber !== null ? (
                      <>
                        <div className="mt-1 font-mono text-base font-semibold text-orange-300">
                          Mach {sample.machNumber.toFixed(1)}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-300">
                          {sample.u <= TIMELINE_EVENTS.liftoff
                            ? 'Stationary on Launch Pad (0 km/h)'
                            : `Local sound speed a ≈ ${Math.round(
                                sample.localSoundSpeedMs ?? 340
                              )} m/s`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 font-mono text-sm font-semibold text-slate-200">
                          N/A (&gt;100 km Space)
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-300">
                          Unavailable above the 100 km Kármán line (no continuum sound speed).
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-950/75 p-2.5">
                    <div className="font-mono text-[11px] text-slate-400 uppercase">
                      Distance Traveled
                    </div>
                    <div className="mt-1 font-mono text-base font-semibold text-white">
                      {Math.round(sample.pathDistanceKm).toLocaleString()} km
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-300">
                      Ground: {Math.round(sample.downrangeKm).toLocaleString()} /{' '}
                      {Math.round(TOTAL_PATH_DISTANCE_KM).toLocaleString()} km
                    </div>
                  </div>
                </div>

                {/* Booster Stage Status Pills */}
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                  {[
                    {
                      label: 'STAGE 1',
                      attached: sample.stage1Attached,
                      firing: sample.activePropulsionStage === 1,
                    },
                    {
                      label: 'STAGE 2',
                      attached: sample.stage2Attached,
                      firing: sample.activePropulsionStage === 2,
                    },
                    {
                      label: 'STAGE 3',
                      attached: sample.stage3Attached,
                      firing: sample.activePropulsionStage === 3,
                    },
                    {
                      label: 'RV CONE',
                      attached: true,
                      firing: sample.plasmaIntensity > 0.05,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded border px-2 py-1 text-center ${
                        item.firing
                          ? 'border-orange-500 bg-orange-500/20 text-orange-200 font-semibold'
                          : item.attached
                          ? 'border-slate-700 bg-slate-900/70 text-slate-200'
                          : 'border-slate-800/60 bg-slate-950/40 text-slate-500 line-through'
                      }`}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* Clear Explanation of Mach Availability & Kármán Line vs Entry Interface */}
                <div className="rounded border border-slate-800 bg-slate-950/85 p-3 text-xs leading-relaxed text-slate-300">
                  <div className="font-mono text-[11px] font-semibold text-orange-400 uppercase">
                    Why Mach Is Unavailable Above 100 km
                  </div>
                  <p className="mt-1">
                    Mach number (<span className="font-mono text-white">M = v / a</span>) requires a denseenough gas medium to propagate pressure waves at the local speed of sound{' '}
                    <span className="font-mono text-white">a = √(γ·R·T)</span>.
                  </p>
                  <p className="mt-1.5">
                    • <strong>100 km Kármán Line:</strong> Internationally recognized boundary of space; above ~100 km the mean free path of air molecules is too large for continuum sound waves, so Mach is listed as <strong>N/A</strong>.
                    <br />• <strong>120 km Entry Interface:</strong> Altitude where a descending hypersonic vehicle first encounters noticeable free-molecular heating and bow-shock ionization.
                  </p>
                </div>
              </>
            )}

            {menuSection === 'physics' && (
              <>
                {/* Selectable 5 Flight Stages */}
                <div>
                  <div className="mb-1.5 font-mono text-[11px] font-semibold text-slate-300 uppercase">
                    Jump to Flight Phase
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {STAGE_DEFINITIONS.map((st) => {
                      const active = sample.stageId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => selectStage(st.id)}
                          className={`rounded border px-1.5 py-1.5 text-center font-mono text-[11px] transition-colors ${
                            active
                              ? 'border-orange-500 bg-orange-500/20 text-white font-semibold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {st.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Stage Briefing & Exact Milestone Jump Buttons */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3">
                  <div className="flex items-center justify-between font-mono text-xs text-orange-400">
                    <span>
                      {stageDef.code}: {stageDef.name.toUpperCase()}
                    </span>
                    <span className="text-slate-300">{stageDef.timeRangeLabel}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-sky-300">
                    {stageDef.altitudeBandLabel}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-200">
                    {stageDef.overview}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {stageDef.keyEvents.map((ev) => (
                      <button
                        key={ev.label}
                        type="button"
                        onClick={() => setU(ev.u, true)}
                        className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-orange-300 transition-colors hover:border-orange-400 hover:bg-orange-500/15 hover:text-white"
                      >
                        ↳ {ev.label} ({ev.altitudeLabel})
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6 Core Physics Principles */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-slate-300 uppercase">
                    <span>6 Aerospace Physics Explanations</span>
                    {selectedConceptId && (
                      <button
                        type="button"
                        onClick={() => setSelectedConceptId(null)}
                        className="text-orange-400 hover:underline"
                      >
                        Sync to Active Phase
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_CONCEPT_ORDER.map((id, idx) => {
                      const concept = SCIENCE_CONCEPTS[id];
                      const isSelected = activeConcept.id === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedConceptId(id)}
                          className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-left font-mono text-[11px] transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-500/20 text-white font-semibold'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-orange-400">0{idx + 1}</span>
                          <span className="truncate">{concept.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Science Explanation Card */}
                <div className="rounded border border-slate-800 bg-slate-950/90 p-3.5">
                  <h3 className="text-sm font-semibold text-white">
                    {activeConcept.title}
                  </h3>
                  {activeConcept.formula && (
                    <div className="mt-2 rounded border border-slate-800 bg-[#070d1c] px-3 py-1.5 font-mono text-xs text-orange-300">
                      {activeConcept.formula}
                    </div>
                  )}
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-200">
                    {activeConcept.summary}
                  </p>
                  <p className="mt-2 border-t border-slate-800/80 pt-2 text-xs leading-relaxed text-slate-300">
                    {activeConcept.detail}
                  </p>
                </div>
              </>
            )}

            {menuSection === 'controls' && (
              <>
                {/* Camera Mode Selection */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3">
                  <div className="font-mono text-xs font-semibold text-white uppercase">
                    Camera Perspective
                  </div>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Drag anywhere on the 3D scene to orbit and scroll/pinch to zoom.
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {CAMERA_MODES.map((m) => {
                      const active = cameraMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setCameraMode(m.id)}
                          className={`flex w-full flex-col rounded border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-orange-500 bg-orange-500/15 text-white'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-xs font-semibold">
                            <span>{m.label}</span>
                            {active && (
                              <span className="text-[10px] text-orange-400">ACTIVE</span>
                            )}
                          </div>
                          <span className="mt-0.5 text-[11px] text-slate-300">
                            {m.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Playback Speed & Time Compression Explanation */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3">
                  <div className="flex items-center justify-between font-mono text-xs font-semibold text-white uppercase">
                    <span>Playback Speed</span>
                    <span className="text-orange-400">
                      {speed}× ({speed * TIME_COMPRESSION_AT_1X}× real mission time)
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    The complete 15-minute (900 s) illustrative flight is compressed to{' '}
                    <strong>75 seconds at 1×</strong> ({TIME_COMPRESSION_AT_1X}× real mission time) so you can observe the entire sub-orbital arc comfortably. Choose <strong>0.25×</strong> (3× real time) for slow-motion stage separation inspection.
                  </p>
                  <div
                    role="group"
                    aria-label="Playback Speed Multiplier"
                    className="mt-2.5 grid grid-cols-5 gap-1.5"
                  >
                    {PLAYBACK_SPEEDS.map((s) => {
                      const active = speed === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          className={`rounded border py-1.5 font-mono text-xs transition-colors ${
                            active
                              ? 'border-orange-500 bg-orange-500 text-slate-950 font-semibold'
                              : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {s}×
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Scene Overlays & Graphics Quality */}
                <div className="rounded border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                  <div className="font-mono text-xs font-semibold text-white uppercase">
                    Scene Overlays & Performance
                  </div>

                  <button
                    type="button"
                    onClick={toggleTrajectory}
                    className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 hover:border-slate-700"
                  >
                    <span>3D Trajectory Arc & Nadir Stem</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        showTrajectory
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {showTrajectory ? 'Shown' : 'Hidden'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFlightLabels}
                    className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 hover:border-slate-700"
                  >
                    <span>3D Milestone Annotations</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        showFlightLabels
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {showFlightLabels ? 'Shown' : 'Hidden'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleQualityMode}
                    className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 hover:border-slate-700"
                  >
                    <span>Graphics Preset ({fps} FPS)</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      {qualityMode === 'high' ? 'High (4K)' : 'Reduced (2K)'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
