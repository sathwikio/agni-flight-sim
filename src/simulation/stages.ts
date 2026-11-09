import { StageId, STAGE_RANGES, TIMELINE_EVENTS } from './flightModel';

export interface ScienceConcept {
  id: string;
  title: string;
  shortLabel: string;
  formula?: string;
  summary: string;
  detail: string;
}

export interface StageDefinition {
  id: StageId;
  index: number;
  code: string;
  name: string;
  subtitle: string;
  startU: number;
  endU: number;
  defaultU: number;
  timeRangeLabel: string;
  altitudeBandLabel: string;
  primaryConceptId: string;
  secondaryConceptId?: string;
  overview: string;
  keyEvents: { label: string; u: number }[];
}

/**
 * Six core physics and aerospace engineering explanations presented across the
 * interactive exhibit.
 */
export const SCIENCE_CONCEPTS: Record<string, ScienceConcept> = {
  'solid-propulsion': {
    id: 'solid-propulsion',
    title: 'How Solid-Fuel Propulsion Works',
    shortLabel: 'Solid-Fuel Propulsion',
    formula: 'F_thrust = m_dot · v_e + (p_e - p_a) · A_e',
    summary:
      'A solid rocket motor stores fuel and oxidizer together in a cured rubbery grain with a central perforated channel. Once ignited, the exposed inner surface burns outward at a predictable rate, generating high-pressure gas that accelerates supersonically through a convergent-divergent De Laval nozzle.',
    detail:
      'Because there are no turbopumps or cryogenic propellants to load immediately before launch, solid motors offer high reliability, long storage life inside sealed canisters, and high liftoff thrust-to-weight ratios—at the trade-off that thrust cannot easily be throttled or shut down mid-burn.',
  },
  'multi-stage': {
    id: 'multi-stage',
    title: 'Why Rockets Use Multiple Stages',
    shortLabel: 'Multi-Stage Staging & Tsiolkovsky',
    formula: 'Δv = I_sp · g_0 · ln(m_0 / m_f)',
    summary:
      'By the Tsiolkovsky rocket equation, a vehicle’s velocity change (Δv) depends logarithmically on the ratio of initial mass to final dry mass. Carrying empty propellant casings all the way to space wastes thrust accelerating dead structural weight.',
    detail:
      'Jettisoning spent first and second stage casings mid-ascent abruptly lowers the remaining mass (m_0 of the next stage), allowing each smaller upper stage and its vacuum-optimized nozzle to impart much greater velocity per kilogram of propellant.',
  },
  'curved-trajectory': {
    id: 'curved-trajectory',
    title: 'Why Ballistic Trajectories Curve',
    shortLabel: 'Curved Ballistic Trajectories',
    formula: 'r(θ) = p / (1 + e · cos θ)',
    summary:
      'Long-range ballistic trajectories curve for two reasons: early in ascent the rocket executes a gravity turn (pitching over so thrust adds horizontal speed while minimizing aerodynamic side-loads), and after burnout the vehicle follows a Keplerian ellipse around Earth’s center of mass.',
    detail:
      'Unlike a flat-Earth parabola, gravity over thousands of kilometers always points radially toward Earth’s center. A sub-orbital ballistic path is actually a segment of an elliptical orbit whose two foci are Earth’s center and an upper focal point, intersecting Earth’s surface at launch and target.',
  },
  'gravity-midcourse': {
    id: 'gravity-midcourse',
    title: 'How Gravity Affects Midcourse Flight',
    shortLabel: 'Gravity in Midcourse Coast',
    formula: 'v² = μ · (2 / r - 1 / a)',
    summary:
      'During the unpowered midcourse phase above the atmosphere, the payload is in pure free-fall under gravity. Even at 780 km altitude, Earth’s gravitational acceleration is still ~78% as strong as at sea level (g ≈ 7.77 m/s²).',
    detail:
      'As the vehicle climbs toward apogee, gravity continuously trades kinetic energy for gravitational potential energy, slowing the vehicle down. Once past apogee, gravity accelerates the vehicle back toward Earth along the descending branch of the ellipse.',
  },
  'reentry-heating': {
    id: 'reentry-heating',
    title: 'Why Atmospheric Re-entry Generates Intense Heat',
    shortLabel: 'Shock-Layer Compression Heating',
    formula: 'q_conv ∝ √ρ · v³ / √R_n',
    summary:
      'Contrary to popular belief, re-entry heating is caused primarily by adiabatic shock-wave compression, not surface skin friction. Traveling at Mach 20+, the air ahead of the vehicle cannot move out of the way faster than the local speed of sound.',
    detail:
      'A detached bow shock forms ahead of the blunt nose cone, compressing air molecules to extreme pressures and temperatures (6,000–8,000 K) and ionizing nitrogen and oxygen into a glowing plasma sheath. A blunt nose radius (R_n) pushes the shock wave slightly off the wall, while an ablative carbon-phenolic heat shield chars and vaporizes to carry heat away.',
  },
  'atmospheric-drag': {
    id: 'atmospheric-drag',
    title: 'How Atmospheric Drag Changes Speed',
    shortLabel: 'Aerodynamic Drag & Ballistic Coefficient',
    formula: 'a_drag = ½ · ρ(h) · v² / β ,   β = m / (C_d · A)',
    summary:
      'As the re-entry vehicle plunges below 60 km into exponentially denser air, aerodynamic drag rises rapidly with dynamic pressure (½ρv²), causing peak deceleration of tens of g’s and bleeding off more than half of the vehicle’s kinetic energy.',
    detail:
      'How rapidly the vehicle slows depends on its ballistic coefficient (β): the ratio of mass to drag area. High-β slender cones retain speed deeper into the stratosphere, whereas lower-β shapes decelerate higher in the atmosphere.',
  },
};

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'launch',
    index: 0,
    code: 'PHASE 01',
    name: 'Launch',
    subtitle: 'Canister Ejection, Ignition & Liftoff',
    startU: STAGE_RANGES[0].startU,
    endU: STAGE_RANGES[0].endU,
    defaultU: 0.025,
    timeRangeLabel: 'T+00:00 → T+01:07',
    altitudeBandLabel: '0 km → 24 km (Troposphere / Lower Stratosphere)',
    primaryConceptId: 'solid-propulsion',
    secondaryConceptId: 'curved-trajectory',
    overview:
      'First-stage solid booster ignites inside the launch complex, building chamber pressure before clearing the tower and initiating a gentle pitch-over maneuver downrange.',
    keyEvents: [
      { label: 'Booster Ignition', u: TIMELINE_EVENTS.ignitionStart + 0.008 },
      { label: 'Liftoff', u: TIMELINE_EVENTS.liftoff },
    ],
  },
  {
    id: 'ascent',
    index: 1,
    code: 'PHASE 02',
    name: 'Powered Ascent',
    subtitle: 'Three-Stage Boost & Gravity Turn',
    startU: STAGE_RANGES[1].startU,
    endU: STAGE_RANGES[1].endU,
    defaultU: 0.16,
    timeRangeLabel: 'T+01:07 → T+04:12',
    altitudeBandLabel: '24 km → 255 km (Stratosphere → Thermosphere)',
    primaryConceptId: 'multi-stage',
    secondaryConceptId: 'solid-propulsion',
    overview:
      'Sequential burnout and separation of Stages 1, 2, and 3. As ambient atmospheric pressure drops near vacuum, the exhaust plume expands into a wide under-expanded fan.',
    keyEvents: [
      { label: 'Stage 1 Separation', u: TIMELINE_EVENTS.stage1Separation },
      { label: 'Stage 2 Separation & Shroud Jettison', u: TIMELINE_EVENTS.stage2Separation },
      { label: 'Stage 3 Burnout (MECO)', u: TIMELINE_EVENTS.stage3Burnout },
    ],
  },
  {
    id: 'midcourse',
    index: 2,
    code: 'PHASE 03',
    name: 'Midcourse Flight',
    subtitle: 'Sub-Orbital Elliptical Coast Through Space',
    startU: STAGE_RANGES[2].startU,
    endU: STAGE_RANGES[2].endU,
    defaultU: 0.54,
    timeRangeLabel: 'T+04:12 → T+11:42',
    altitudeBandLabel: '255 km → 780 km Apogee → 120 km',
    primaryConceptId: 'gravity-midcourse',
    secondaryConceptId: 'curved-trajectory',
    overview:
      'With all propulsion stages expended and separated, the re-entry vehicle coasts silently in vacuum along an elliptical Keplerian arc, reaching a 780 km illustrative apogee.',
    keyEvents: [
      { label: 'Apogee (780 km Peak Altitude)', u: TIMELINE_EVENTS.apogee },
      { label: 'Atmospheric Entry Interface (~120 km)', u: TIMELINE_EVENTS.reentryInterface },
    ],
  },
  {
    id: 'reentry',
    index: 3,
    code: 'PHASE 04',
    name: 'Atmospheric Re-entry',
    subtitle: 'Hypersonic Bow Shock & Plasma Sheath',
    startU: STAGE_RANGES[3].startU,
    endU: STAGE_RANGES[3].endU,
    defaultU: 0.875,
    timeRangeLabel: 'T+11:42 → T+14:19',
    altitudeBandLabel: '120 km → 18 km (Thermosphere → Stratosphere)',
    primaryConceptId: 'reentry-heating',
    secondaryConceptId: 'atmospheric-drag',
    overview:
      'Entering the denser mesosphere and stratosphere at hypersonic speed compresses air ahead of the blunt nose tip into an incandescent ionized plasma sheath.',
    keyEvents: [
      { label: 'Peak Plasma Heating & Deceleration', u: TIMELINE_EVENTS.peakHeating },
    ],
  },
  {
    id: 'impact',
    index: 4,
    code: 'PHASE 05',
    name: 'Impact Visualization',
    subtitle: 'Dense-Air Braking & Target Zone Arrival',
    startU: STAGE_RANGES[4].startU,
    endU: STAGE_RANGES[4].endU,
    defaultU: 0.992,
    timeRangeLabel: 'T+14:19 → T+15:00',
    altitudeBandLabel: '18 km → 0 km (Troposphere → Sea Level)',
    primaryConceptId: 'atmospheric-drag',
    secondaryConceptId: 'reentry-heating',
    overview:
      'Lower-atmosphere drag rapidly decelerates the vehicle as it reaches the fictional, uninhabited ocean instrumentation zone, indicated by a telemetry marker and optical pulse.',
    keyEvents: [
      { label: 'Target Zone Optical Marker', u: TIMELINE_EVENTS.impact },
    ],
  },
];
