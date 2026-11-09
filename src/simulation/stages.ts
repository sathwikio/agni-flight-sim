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
  shortName: string;
  subtitle: string;
  startU: number;
  endU: number;
  defaultU: number;
  timeRangeLabel: string;
  altitudeBandLabel: string;
  primaryConceptId: string;
  secondaryConceptId?: string;
  overview: string;
  keyEvents: { label: string; u: number; altitudeLabel: string }[];
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
    shortLabel: 'Multi-Stage Staging',
    formula: 'Δv = I_sp · g_0 · ln(m_0 / m_f)',
    summary:
      'By the Tsiolkovsky rocket equation, a vehicle’s velocity change (Δv) depends logarithmically on the ratio of initial mass to final dry mass. Carrying empty propellant casings all the way to space wastes thrust accelerating dead structural weight.',
    detail:
      'Jettisoning spent first and second stage casings mid-ascent abruptly lowers the remaining mass (m_0 of the next stage), allowing each smaller upper stage and its vacuum-optimized nozzle to impart much greater velocity per kilogram of propellant.',
  },
  'curved-trajectory': {
    id: 'curved-trajectory',
    title: 'Why Ballistic Trajectories Curve',
    shortLabel: 'Curved Trajectories',
    formula: 'r(θ) = p / (1 + e · cos θ)',
    summary:
      'Long-range ballistic trajectories curve for two reasons: early in ascent the rocket executes a gravity turn (pitching over so thrust adds horizontal speed while minimizing aerodynamic side-loads), and after burnout the vehicle follows a Keplerian ellipse around Earth’s center of mass.',
    detail:
      'Unlike a flat-Earth parabola, gravity over thousands of kilometers always points radially toward Earth’s center. A sub-orbital ballistic path is actually a segment of an elliptical orbit whose two foci are Earth’s center and an upper focal point, intersecting Earth’s surface at launch and target.',
  },
  'gravity-midcourse': {
    id: 'gravity-midcourse',
    title: 'How Gravity Affects Midcourse Flight',
    shortLabel: 'Midcourse Gravity',
    formula: 'v² = μ · (2 / r - 1 / a)',
    summary:
      'During the unpowered midcourse phase above the atmosphere, the payload is in pure free-fall under gravity. Even at 780 km altitude, Earth’s gravitational acceleration is still ~78% as strong as at sea level (g ≈ 7.77 m/s²).',
    detail:
      'As the vehicle climbs toward apogee, gravity continuously trades kinetic energy for gravitational potential energy, slowing the vehicle from 24,200 km/h at burnout to 19,400 km/h at apogee. Past apogee, gravity accelerates the vehicle back toward Earth along the descending branch of the ellipse.',
  },
  'reentry-heating': {
    id: 'reentry-heating',
    title: 'Why Atmospheric Re-entry Generates Intense Heat',
    shortLabel: 'Re-entry Heating',
    formula: 'q_conv ∝ √ρ · v³ / √R_n',
    summary:
      'Re-entry heating begins near the ~120 km Entry Interface and intensifies below the 100 km Kármán line. It is caused primarily by adiabatic shock-wave compression, not surface skin friction.',
    detail:
      'A detached bow shock forms ahead of the blunt nose cone, compressing air molecules to extreme temperatures (6,000–8,000 K) and ionizing nitrogen and oxygen into a glowing plasma sheath. A blunt nose radius (R_n) pushes the shock wave slightly off the wall, while an ablative carbon-phenolic heat shield chars to carry heat away.',
  },
  'atmospheric-drag': {
    id: 'atmospheric-drag',
    title: 'How Atmospheric Drag Changes Speed',
    shortLabel: 'Atmospheric Drag',
    formula: 'a_drag = ½ · ρ(h) · v² / β ,   β = m / (C_d · A)',
    summary:
      'As the re-entry vehicle plunges below 60 km into exponentially denser air, aerodynamic drag rises rapidly with dynamic pressure (½ρv²), causing peak deceleration and bleeding off more than half of the vehicle’s kinetic energy.',
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
    shortName: '1. Launch',
    subtitle: 'Canister Ignition & Liftoff',
    startU: STAGE_RANGES[0].startU,
    endU: STAGE_RANGES[0].endU,
    defaultU: 0.0,
    timeRangeLabel: 'T+00:00 → T+01:07',
    altitudeBandLabel: '0 km → 24 km (Troposphere / Stratosphere)',
    primaryConceptId: 'solid-propulsion',
    secondaryConceptId: 'curved-trajectory',
    overview:
      'First-stage solid booster ignites inside the launch complex at sea level (0 km, Mach 0.0), building chamber pressure before clearing the tower at T+00:31 and initiating a gentle pitch-over maneuver downrange.',
    keyEvents: [
      { label: 'Pad Pre-Ignition', u: 0.0, altitudeLabel: '0.0 km' },
      { label: 'Liftoff', u: TIMELINE_EVENTS.liftoff, altitudeLabel: '0.0 km' },
    ],
  },
  {
    id: 'ascent',
    index: 1,
    code: 'PHASE 02',
    name: 'Powered Ascent',
    shortName: '2. Ascent',
    subtitle: 'Three-Stage Solid Boost & Gravity Turn',
    startU: STAGE_RANGES[1].startU,
    endU: STAGE_RANGES[1].endU,
    defaultU: STAGE_RANGES[1].startU,
    timeRangeLabel: 'T+01:07 → T+04:12',
    altitudeBandLabel: '24 km → 255 km (Stratosphere → Thermosphere)',
    primaryConceptId: 'multi-stage',
    secondaryConceptId: 'solid-propulsion',
    overview:
      'Sequential burnout and separation of Stages 1, 2, and 3, crossing the 100 km Kármán line during Stage 2 burn and reaching Stage 3 burnout (MECO) at 255 km altitude.',
    keyEvents: [
      { label: 'Stage 1 Separation', u: TIMELINE_EVENTS.stage1Separation, altitudeLabel: '68 km' },
      { label: 'Stage 2 Sep & Fairing', u: TIMELINE_EVENTS.stage2Separation, altitudeLabel: '150 km' },
      { label: 'Stage 3 Burnout (MECO)', u: TIMELINE_EVENTS.stage3Burnout, altitudeLabel: '255 km' },
    ],
  },
  {
    id: 'midcourse',
    index: 2,
    code: 'PHASE 03',
    name: 'Midcourse Flight',
    shortName: '3. Midcourse',
    subtitle: 'Sub-Orbital Elliptical Coast in Space',
    startU: STAGE_RANGES[2].startU,
    endU: STAGE_RANGES[2].endU,
    defaultU: TIMELINE_EVENTS.apogee,
    timeRangeLabel: 'T+04:12 → T+12:18',
    altitudeBandLabel: '255 km → 780 km Apogee → 120 km Entry Interface',
    primaryConceptId: 'gravity-midcourse',
    secondaryConceptId: 'curved-trajectory',
    overview:
      'With all propulsion stages expended and separated, the re-entry vehicle coasts in vacuum along an elliptical Keplerian arc, reaching a 780 km illustrative apogee before descending to the 120 km Entry Interface.',
    keyEvents: [
      { label: 'Midcourse Coast Start', u: TIMELINE_EVENTS.stage3Burnout, altitudeLabel: '255 km' },
      { label: 'Apogee (Peak Altitude)', u: TIMELINE_EVENTS.apogee, altitudeLabel: '780 km' },
    ],
  },
  {
    id: 'reentry',
    index: 3,
    code: 'PHASE 04',
    name: 'Atmospheric Re-entry',
    shortName: '4. Re-entry',
    subtitle: '120 km Entry Interface, 100 km Kármán Line & Plasma',
    startU: STAGE_RANGES[3].startU,
    endU: STAGE_RANGES[3].endU,
    defaultU: STAGE_RANGES[3].startU,
    timeRangeLabel: 'T+12:18 → T+14:19',
    altitudeBandLabel: '120 km Entry Interface → 100 km Kármán → 18 km',
    primaryConceptId: 'reentry-heating',
    secondaryConceptId: 'atmospheric-drag',
    overview:
      'The vehicle crosses the illustrative Entry Interface at 120 km where initial bow-shock ionization begins, passes the 100 km Kármán line where continuum acoustics (Mach number) resumes, and reaches peak plasma heating near 52 km.',
    keyEvents: [
      { label: 'Entry Interface', u: TIMELINE_EVENTS.reentryInterface, altitudeLabel: '120 km' },
      { label: 'Kármán Line', u: TIMELINE_EVENTS.karmanLine, altitudeLabel: '100 km' },
      { label: 'Peak Heating', u: TIMELINE_EVENTS.peakHeating, altitudeLabel: '52 km' },
    ],
  },
  {
    id: 'impact',
    index: 4,
    code: 'PHASE 05',
    name: 'Impact Visualization',
    shortName: '5. Target',
    subtitle: 'Dense-Air Braking & Target Zone Arrival',
    startU: STAGE_RANGES[4].startU,
    endU: STAGE_RANGES[4].endU,
    defaultU: STAGE_RANGES[4].startU,
    timeRangeLabel: 'T+14:19 → T+15:00',
    altitudeBandLabel: '18 km → 0 km (Troposphere → Sea Level)',
    primaryConceptId: 'atmospheric-drag',
    secondaryConceptId: 'reentry-heating',
    overview:
      'Lower-atmosphere aerodynamic drag rapidly decelerates the vehicle as it reaches the fictional, uninhabited ocean instrumentation zone at 0 km, indicated by a non-destructive telemetry marker and optical pulse.',
    keyEvents: [
      { label: 'Terminal Descent', u: TIMELINE_EVENTS.terminalPhaseStart, altitudeLabel: '18 km' },
      { label: 'Target Zone Arrival', u: TIMELINE_EVENTS.impact, altitudeLabel: '0.0 km' },
    ],
  },
];
