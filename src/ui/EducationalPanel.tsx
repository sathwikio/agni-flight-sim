import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SCIENCE_CONCEPTS,
  STAGE_DEFINITIONS,
} from '../simulation/stages';
import { useSimulationStore } from '../simulation/store';

const ALL_CONCEPT_ORDER = [
  'solid-propulsion',
  'multi-stage',
  'curved-trajectory',
  'gravity-midcourse',
  'reentry-heating',
  'atmospheric-drag',
] as const;

export const EducationalPanel: React.FC = () => {
  const stageId = useSimulationStore((s) => s.stageId);
  const selectedConceptId = useSimulationStore((s) => s.selectedConceptId);
  const setSelectedConceptId = useSimulationStore((s) => s.setSelectedConceptId);
  const setU = useSimulationStore((s) => s.setU);
  const [collapsed, setCollapsed] = useState(false);

  const stageDef =
    STAGE_DEFINITIONS.find((s) => s.id === stageId) ?? STAGE_DEFINITIONS[0];

  const activeConceptKey = selectedConceptId ?? stageDef.primaryConceptId;
  const activeConcept =
    SCIENCE_CONCEPTS[activeConceptKey] ?? SCIENCE_CONCEPTS['solid-propulsion'];

  return (
    <motion.section
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      aria-label="Aerospace Physics & Educational Explanations"
      className="pointer-events-auto w-full max-w-[360px] rounded border border-slate-800/90 bg-[#050914]/85 text-slate-100 shadow-2xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="font-mono text-[11px] font-semibold tracking-widest text-slate-200 uppercase">
            Science & Flight Physics
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white lg:hidden"
        >
          {collapsed ? 'Expand' : 'Minimize'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3 p-3.5">
          {/* Current Flight Stage Summary */}
          <div className="rounded border border-slate-800/80 bg-slate-950/60 p-2.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-orange-400">
              <span>{stageDef.code} BRIEFING</span>
              <span className="text-slate-400">{stageDef.timeRangeLabel}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">
              {stageDef.overview}
            </p>
            {/* Milestone Jump Buttons */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stageDef.keyEvents.map((ev) => (
                <button
                  key={ev.label}
                  type="button"
                  onClick={() => setU(ev.u, true)}
                  className="rounded border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] text-orange-300 transition-colors hover:border-orange-400 hover:bg-orange-500/15 hover:text-white"
                >
                  ↳ {ev.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6 Physics Topic Selector Pills */}
          <div>
            <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] tracking-wider text-slate-400 uppercase">
              <span>6 Core Physics Principles</span>
              {selectedConceptId && (
                <button
                  type="button"
                  onClick={() => setSelectedConceptId(null)}
                  className="text-orange-400 hover:underline"
                >
                  Sync to Stage
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_CONCEPT_ORDER.map((id, idx) => {
                const concept = SCIENCE_CONCEPTS[id];
                const isSelected = activeConcept.id === id;
                const isStageDefault =
                  stageDef.primaryConceptId === id ||
                  stageDef.secondaryConceptId === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedConceptId(id)}
                    className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-left font-mono text-[10px] transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/20 text-white font-semibold shadow-[0_0_12px_rgba(249,115,22,0.18)]'
                        : isStageDefault
                        ? 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-600'
                        : 'border-slate-800/80 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-orange-400">0{idx + 1}</span>
                    <span className="truncate">{concept.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animated Science Explanation Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeConcept.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded border border-slate-800 bg-slate-950/85 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xs font-semibold tracking-wide text-white uppercase">
                  {activeConcept.title}
                </h2>
              </div>

              {activeConcept.formula && (
                <div className="mt-2 rounded border border-slate-800/90 bg-[#070d1c] px-2.5 py-1.5 font-mono text-xs text-orange-300">
                  {activeConcept.formula}
                </div>
              )}

              <p className="mt-2 text-xs leading-relaxed text-slate-200">
                {activeConcept.summary}
              </p>

              <p className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed text-slate-400">
                {activeConcept.detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
};
