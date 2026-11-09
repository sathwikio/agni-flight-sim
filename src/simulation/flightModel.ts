import * as THREE from 'three';

/**
 * Pure, deterministic flight simulation engine.
 *
 * All geometry, kinematics, stage separations, and atmospheric properties are
 * computed as a pure function of normalized flight progress `u ∈ [0, 1]`
 * (or elapsed mission time `t ∈ [0, MISSION_DURATION_S]`).
 *
 * NOTE: All trajectories, altitudes, speeds, and stage timings are illustrative
 * educational curves designed for visual clarity — NOT actual Agni-V flight
 * parameters, targeting solutions, launch angles, or guidance equations.
 */

export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_UNITS = 10; // 1 scene unit = 637.1 km
export const KM_TO_UNITS = EARTH_RADIUS_UNITS / EARTH_RADIUS_KM;

/**
 * Visual altitude exaggeration for orbital/global readability while keeping
 * telemetry values in realistic illustrative kilometers.
 */
export const ALTITUDE_VISUAL_EXAGGERATION = 1.85;

export const MISSION_DURATION_S = 900; // 15 minutes (900 s) illustrative mission time
export const PLAYBACK_REALTIME_DURATION_S = 75; // 1x playback completes 900s mission in 75s (12x time compression)
export const TIME_COMPRESSION_AT_1X = MISSION_DURATION_S / PLAYBACK_REALTIME_DURATION_S; // 12

export type StageId = 'launch' | 'ascent' | 'midcourse' | 'reentry' | 'impact';

export type AtmosphereLayer =
  | 'Troposphere'
  | 'Stratosphere'
  | 'Mesosphere'
  | 'Thermosphere'
  | 'Exosphere (Space)';

export interface LatLon {
  lat: number; // degrees
  lon: number; // degrees
  label: string;
}

// Fictional launch complex on the eastern coast and uninhabited southern-ocean test zone
export const LAUNCH_SITE: LatLon = {
  lat: 20.75,
  lon: 87.08,
  label: 'Integrated Test Pad · Launch Complex IV (Illustrative)',
};

export const TARGET_ZONE: LatLon = {
  lat: -24.5,
  lon: 74.2,
  label: 'Uninhabited Southern Ocean Instrumentation Zone (Fictional)',
};

export const APOGEE_ALTITUDE_KM = 780; // Illustrative lofted apogee
export const ENTRY_INTERFACE_ALTITUDE_KM = 120; // Illustrative atmospheric entry interface
export const KARMAN_LINE_ALTITUDE_KM = 100; // Conventional boundary of space

/**
 * Normalized timeline landmarks (u in [0, 1]).
 * Every value here is synchronized with STAGE_RANGES and the monotone cubic
 * altitude spline so timeline markers, phase boundaries, 3D scene annotations,
 * and telemetry readouts always agree.
 */
export const TIMELINE_EVENTS = {
  ignitionStart: 0.0,
  liftoff: 0.035,
  ascentStart: 0.075,
  stage1Separation: 0.125,
  stage2Separation: 0.2,
  stage3Burnout: 0.28, // End of powered ascent (255 km) / start of midcourse free-flight
  apogee: 0.53, // Exact peak altitude: 780.0 km
  reentryInterface: 0.82, // Exact atmospheric entry interface: 120.0 km (Start of Phase 4)
  karmanLine: 0.845, // Exact Kármán line: 100.0 km (Conventional boundary of space)
  peakHeating: 0.895, // Peak bow-shock plasma heating & deceleration (~52 km)
  terminalPhaseStart: 0.955, // Start of Phase 5 Impact Visualization (18.0 km)
  impact: 1.0, // Target Zone arrival (0.0 km)
} as const;

export interface StageRange {
  id: StageId;
  index: number;
  startU: number;
  endU: number;
}

export const STAGE_RANGES: StageRange[] = [
  { id: 'launch', index: 0, startU: 0.0, endU: TIMELINE_EVENTS.ascentStart },
  {
    id: 'ascent',
    index: 1,
    startU: TIMELINE_EVENTS.ascentStart,
    endU: TIMELINE_EVENTS.stage3Burnout,
  },
  {
    id: 'midcourse',
    index: 2,
    startU: TIMELINE_EVENTS.stage3Burnout,
    endU: TIMELINE_EVENTS.reentryInterface,
  },
  {
    id: 'reentry',
    index: 3,
    startU: TIMELINE_EVENTS.reentryInterface,
    endU: TIMELINE_EVENTS.terminalPhaseStart,
  },
  {
    id: 'impact',
    index: 4,
    startU: TIMELINE_EVENTS.terminalPhaseStart,
    endU: 1.0,
  },
];

export interface SeparatedStageState {
  visible: boolean;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  separationAge: number; // 0 -> 1 fade / drift window
}

export interface FlightSample {
  /** Normalized mission progress in [0, 1] */
  u: number;
  /** Normalized progress within the current phase in [0, 1] */
  phaseProgress: number;
  /** Illustrative mission elapsed time in seconds (0s to 900s) */
  missionTimeS: number;
  /** Active stage identifier */
  stageId: StageId;
  /** Active stage index (0..4) */
  stageIndex: number;
  /** Progress along the great-circle ground track in [0, 1] */
  rangeProgress: number;
  /** Illustrative altitude above mean sea level in km */
  altitudeKm: number;
  /** Visual scene radius from Earth center in scene units */
  sceneRadius: number;
  /** Illustrative speed in km/h */
  velocityKmh: number;
  /** Illustrative speed in km/s */
  velocityKms: number;
  /** Local Mach number when at or below the 100 km Kármán line, or null in space (>100 km) */
  machNumber: number | null;
  /** Reason Mach is unavailable when machNumber is null */
  machUnavailableReason: string | null;
  /** Local speed of sound in m/s (null above 100 km Kármán line) */
  localSoundSpeedMs: number | null;
  /** Downrange ground distance traveled in km */
  downrangeKm: number;
  /** Total path length traveled along trajectory in km */
  pathDistanceKm: number;
  /** Atmospheric layer name */
  atmosphereLayer: AtmosphereLayer;
  /** Atmospheric density ratio (0..1, exponential illustrative curve) */
  atmosphereDensity: number;
  /** World-space position of the active vehicle */
  position: THREE.Vector3;
  /** World-space surface point directly below the vehicle (nadir) */
  surfacePosition: THREE.Vector3;
  /** Unit surface normal (local up vector) at the vehicle's ground track point */
  upNormal: THREE.Vector3;
  /** Unit tangent along the 3D flight path */
  velocityDir: THREE.Vector3;
  /** World-space orientation quaternion (local +Y aligned with rocket nose) */
  quaternion: THREE.Quaternion;
  /** Which booster stages are still attached to the vehicle */
  stage1Attached: boolean;
  stage2Attached: boolean;
  stage3Attached: boolean;
  shroudAttached: boolean;
  /** Currently firing propulsion stage (0 = none/coasting, 1, 2, or 3) */
  activePropulsionStage: 0 | 1 | 2 | 3;
  /** Normalized thrust intensity [0, 1] for exhaust plume shader */
  thrustIntensity: number;
  /** Normalized exhaust plume expansion factor (1 at sea level -> 3.4 at high altitude) */
  plumeExpansion: number;
  /** Normalized pre-liftoff / pad smoke intensity [0, 1] */
  padSmokeIntensity: number;
  /** Normalized atmospheric re-entry plasma intensity [0, 1] */
  plasmaIntensity: number;
  /** Normalized impact light-pulse progress [0, 1] (0 before impact) */
  impactPulse: number;
  /** Recently separated stages for animated drop-away & tumbling */
  separatedStage1: SeparatedStageState;
  separatedStage2: SeparatedStageState;
  separatedStage3: SeparatedStageState;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Convert geographic latitude/longitude (degrees) and radius (scene units)
 * into Three.js world coordinates matching Three.js SphereGeometry UV mapping.
 */
export function latLonToVector3(
  latDeg: number,
  lonDeg: number,
  radius: number = EARTH_RADIUS_UNITS
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latDeg);
  const theta = THREE.MathUtils.degToRad(lonDeg + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const LAUNCH_UNIT_VEC = latLonToVector3(LAUNCH_SITE.lat, LAUNCH_SITE.lon, 1).normalize();
const TARGET_UNIT_VEC = latLonToVector3(TARGET_ZONE.lat, TARGET_ZONE.lon, 1).normalize();
const CENTRAL_ANGLE_RAD = Math.acos(clamp(LAUNCH_UNIT_VEC.dot(TARGET_UNIT_VEC), -1, 1));
export const TOTAL_GROUND_RANGE_KM = CENTRAL_ANGLE_RAD * EARTH_RADIUS_KM;

/**
 * Spherical linear interpolation (SLERP) along the great circle between launch
 * and target unit vectors.
 */
export function sampleGreatCircleUnitVector(s: number): THREE.Vector3 {
  const clamped = clamp(s, 0, 1);
  if (CENTRAL_ANGLE_RAD < 1e-5) {
    return LAUNCH_UNIT_VEC.clone();
  }
  const sinTotal = Math.sin(CENTRAL_ANGLE_RAD);
  const a = Math.sin((1 - clamped) * CENTRAL_ANGLE_RAD) / sinTotal;
  const b = Math.sin(clamped * CENTRAL_ANGLE_RAD) / sinTotal;
  return new THREE.Vector3(
    LAUNCH_UNIT_VEC.x * a + TARGET_UNIT_VEC.x * b,
    LAUNCH_UNIT_VEC.y * a + TARGET_UNIT_VEC.y * b,
    LAUNCH_UNIT_VEC.z * a + TARGET_UNIT_VEC.z * b
  ).normalize();
}

/**
 * Maps normalized timeline `u ∈ [0, 1]` to downrange ground progress `s ∈ [0, 1]`.
 */
export function computeRangeProgress(u: number): number {
  const { liftoff, stage3Burnout, reentryInterface } = TIMELINE_EVENTS;
  if (u <= liftoff) return 0;
  if (u >= 1.0) return 1;

  const t = clamp((u - liftoff) / (1 - liftoff), 0, 1);
  const boostEase = Math.pow(t, 1.48);
  const coastLinear = smoothstep(0.0, 1.0, t);
  const blend = smoothstep(liftoff, stage3Burnout, u);
  const raw = THREE.MathUtils.lerp(boostEase, coastLinear, blend * 0.62);

  const terminalDrag = smoothstep(reentryInterface, 1.0, u) * 0.014 * (1 - t);
  return clamp(raw - terminalDrag, 0, 1);
}

/**
 * Calibrated altitude control knots `[u, altitudeKm]` using Fritsch-Carlson
 * monotone cubic Hermite interpolation so every timeline marker and phase boundary
 * hits its exact documented altitude with C1 smoothness and zero overshoot.
 */
const ALTITUDE_KNOTS: readonly [number, number][] = [
  [0.0, 0.0],
  [TIMELINE_EVENTS.liftoff, 0.0], // 0.035 -> 0 km
  [TIMELINE_EVENTS.ascentStart, 24.0], // 0.075 -> 24 km (Phase 2 start)
  [TIMELINE_EVENTS.stage1Separation, 68.0], // 0.125 -> 68 km (S1 Sep)
  [TIMELINE_EVENTS.stage2Separation, 150.0], // 0.200 -> 150 km (S2 Sep)
  [TIMELINE_EVENTS.stage3Burnout, 255.0], // 0.280 -> 255 km (MECO / Phase 3 start)
  [0.4, 580.0],
  [TIMELINE_EVENTS.apogee, APOGEE_ALTITUDE_KM], // 0.530 -> 780 km (Exact Apogee)
  [0.68, 520.0],
  [TIMELINE_EVENTS.reentryInterface, ENTRY_INTERFACE_ALTITUDE_KM], // 0.820 -> 120 km (Exact Entry Interface / Phase 4 start)
  [TIMELINE_EVENTS.karmanLine, KARMAN_LINE_ALTITUDE_KM], // 0.845 -> 100 km (Exact Kármán Line)
  [TIMELINE_EVENTS.peakHeating, 52.0], // 0.895 -> 52 km (Peak Heating)
  [TIMELINE_EVENTS.terminalPhaseStart, 18.0], // 0.955 -> 18 km (Phase 5 Impact start)
  [1.0, 0.0], // 1.000 -> 0 km (Target Zone arrival)
];

// Precompute Fritsch-Carlson monotone cubic tangents for ALTITUDE_KNOTS
const ALT_TANGENTS: number[] = (() => {
  const n = ALTITUDE_KNOTS.length;
  const secants: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const du = ALTITUDE_KNOTS[i + 1][0] - ALTITUDE_KNOTS[i][0];
    const dh = ALTITUDE_KNOTS[i + 1][1] - ALTITUDE_KNOTS[i][1];
    secants[i] = dh / du;
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = secants[0];
  m[n - 1] = secants[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (secants[i - 1] * secants[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (secants[i - 1] + secants[i]) * 0.5;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const d = secants[i];
    if (Math.abs(d) < 1e-8) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d;
      const b = m[i + 1] / d;
      const hypot = Math.hypot(a, b);
      if (hypot > 3) {
        const tau = 3 / hypot;
        m[i] = tau * a * d;
        m[i + 1] = tau * b * d;
      }
    }
  }
  return m;
})();

/**
 * Illustrative altitude profile `h(u)` in kilometers.
 * Evaluates the monotone cubic Hermite spline so all milestones agree exactly.
 */
export function computeAltitudeKm(rawU: number): number {
  const u = clamp(rawU, 0, 1);
  if (u <= TIMELINE_EVENTS.liftoff || u >= 1.0) return 0;

  const n = ALTITUDE_KNOTS.length;
  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    if (u >= ALTITUDE_KNOTS[i][0] && u <= ALTITUDE_KNOTS[i + 1][0]) {
      idx = i;
      break;
    }
  }

  const [u0, y0] = ALTITUDE_KNOTS[idx];
  const [u1, y1] = ALTITUDE_KNOTS[idx + 1];
  const h = u1 - u0;
  if (h <= 1e-9) return y0;

  const t = (u - u0) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const val = h00 * y0 + h10 * h * ALT_TANGENTS[idx] + h01 * y1 + h11 * h * ALT_TANGENTS[idx + 1];
  return Math.max(0, val);
}

/**
 * Converts physical altitude (km) to visual scene radius (units) with smooth
 * visual exaggeration so the trajectory curve is clearly legible from space
 * while touching the exact Earth surface at launch and target.
 */
export function altitudeKmToSceneRadius(altitudeKm: number): number {
  const trueOffset = altitudeKm * KM_TO_UNITS;
  return EARTH_RADIUS_UNITS + trueOffset * ALTITUDE_VISUAL_EXAGGERATION;
}

/**
 * Determines the Earth atmospheric layer for a given altitude (km).
 */
export function getAtmosphereLayer(altitudeKm: number): AtmosphereLayer {
  if (altitudeKm < 12) return 'Troposphere';
  if (altitudeKm < 50) return 'Stratosphere';
  if (altitudeKm < 85) return 'Mesosphere';
  if (altitudeKm < 500) return 'Thermosphere';
  return 'Exosphere (Space)';
}

/**
 * Illustrative U.S. Standard Atmosphere speed of sound (m/s) as a function of
 * altitude. The 100 km Kármán line (`KARMAN_LINE_ALTITUDE_KM`) is a conventional
 * boundary of space; as a simplifying choice in this model, the simulator stops
 * displaying Mach numbers above 100 km.
 */
export function getLocalSoundSpeedMs(altitudeKm: number): number | null {
  if (altitudeKm > KARMAN_LINE_ALTITUDE_KM) return null;
  if (altitudeKm <= 11) {
    // Troposphere temperature lapse: 340.3 m/s at sea level -> 295.1 m/s at 11 km
    return THREE.MathUtils.lerp(340.3, 295.1, altitudeKm / 11);
  }
  if (altitudeKm <= 20) {
    return 295.1; // Tropopause isothermal layer
  }
  if (altitudeKm <= 47) {
    // Stratospheric ozone warming: 295.1 -> 329.8 m/s
    return THREE.MathUtils.lerp(295.1, 329.8, (altitudeKm - 20) / 27);
  }
  if (altitudeKm <= 85) {
    // Mesospheric cooling: 329.8 -> 269.4 m/s
    return THREE.MathUtils.lerp(329.8, 269.4, (altitudeKm - 47) / 38);
  }
  // Upper mesosphere / lower thermosphere transition (85 -> 100 km Kármán line)
  return THREE.MathUtils.lerp(269.4, 282.0, (altitudeKm - 85) / 15);
}

/**
 * Illustrative speed profile in km/h across the five flight phases:
 * - Pre-launch (`u <= liftoff`): 0 km/h (Mach 0.0 on launch pad)
 * - Stage 1-3 Powered Ascent: accelerates from 0 to ~24,200 km/h (~6.72 km/s)
 * - Midcourse Coast: slows as kinetic energy converts to gravitational potential
 *   energy toward apogee (~19,400 km/h at 780 km apogee), then re-accelerates on
 *   descent to ~24,600 km/h at the 120 km entry interface
 * - Atmospheric Re-entry: intense aerodynamic deceleration in the mesosphere and
 *   stratosphere down to terminal impact visualization
 */
export function computeVelocityKmh(u: number, altitudeKm: number): number {
  const {
    liftoff,
    stage1Separation,
    stage2Separation,
    stage3Burnout,
    reentryInterface,
    peakHeating,
  } = TIMELINE_EVENTS;

  if (u <= liftoff) return 0;
  if (u >= 1.0) return 0;

  if (u <= stage3Burnout) {
    const s1 = smoothstep(liftoff, stage1Separation, u) * 7600;
    const s2 = smoothstep(stage1Separation, stage2Separation, u) * 8400;
    const s3 = smoothstep(stage2Separation, stage3Burnout, u) * 8200;
    return s1 + s2 + s3; // reaches 24,200 km/h at Stage 3 burnout
  }

  if (u <= reentryInterface) {
    // Vis-viva inspired energy exchange: slower at 780 km apogee (19,400 km/h),
    // faster as it descends back to 120 km entry interface (24,600 km/h)
    const burnoutAlt = 255;
    const deltaAlt = Math.max(0, altitudeKm - burnoutAlt);
    const gravityLoss = (deltaAlt / (APOGEE_ALTITUDE_KM - burnoutAlt)) * 4800;
    const entryGain = smoothstep(0.6, reentryInterface, u) * 400;
    return 24200 - gravityLoss + entryGain;
  }

  // Atmospheric re-entry deceleration below 120 km
  const highAltSpeed = 24600;
  const dragOnset = smoothstep(reentryInterface, peakHeating, u) * 3600;
  const denseAtmoBraking = Math.pow(smoothstep(peakHeating, 0.998, u), 1.38) * 12400;
  return Math.max(0, highAltSpeed - dragOnset - denseAtmoBraking);
}

/**
 * Returns the 3D world-space position along the visual flight path for `u ∈ [0, 1]`.
 */
export function samplePositionAtU(u: number): THREE.Vector3 {
  const s = computeRangeProgress(u);
  const altKm = computeAltitudeKm(u);
  const radius = altitudeKmToSceneRadius(altKm);
  const unitNormal = sampleGreatCircleUnitVector(s);
  return unitNormal.multiplyScalar(radius);
}

/**
 * Maps `u ∈ [0, 1]` to the active StageRange.
 */
export function getStageForU(u: number): StageRange {
  const clamped = clamp(u, 0, 1);
  for (let i = 0; i < STAGE_RANGES.length; i++) {
    const st = STAGE_RANGES[i];
    if (clamped < st.endU || i === STAGE_RANGES.length - 1) {
      return st;
    }
  }
  return STAGE_RANGES[0];
}

// Precompute cumulative arc-length table for path distance telemetry & trajectory geometry
const ARC_TABLE_STEPS = 240;
const ARC_CUMULATIVE_KM: number[] = new Array(ARC_TABLE_STEPS + 1).fill(0);
let prevPt = sampleGreatCircleUnitVector(0).multiplyScalar(EARTH_RADIUS_KM);
for (let i = 1; i <= ARC_TABLE_STEPS; i++) {
  const u = i / ARC_TABLE_STEPS;
  const s = computeRangeProgress(u);
  const alt = computeAltitudeKm(u);
  const pt = sampleGreatCircleUnitVector(s).multiplyScalar(EARTH_RADIUS_KM + alt);
  ARC_CUMULATIVE_KM[i] = ARC_CUMULATIVE_KM[i - 1] + pt.distanceTo(prevPt);
  prevPt = pt;
}
export const TOTAL_PATH_DISTANCE_KM = ARC_CUMULATIVE_KM[ARC_TABLE_STEPS];

function lookupPathDistanceKm(u: number): number {
  const scaled = clamp(u, 0, 1) * ARC_TABLE_STEPS;
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  if (idx >= ARC_TABLE_STEPS) return TOTAL_PATH_DISTANCE_KM;
  return THREE.MathUtils.lerp(ARC_CUMULATIVE_KM[idx], ARC_CUMULATIVE_KM[idx + 1], frac);
}

const _tangentMatrix = new THREE.Matrix4();
const _orthoRight = new THREE.Vector3();
const _orthoForward = new THREE.Vector3();

function buildRocketQuaternion(noseDir: THREE.Vector3, radialUp: THREE.Vector3): THREE.Quaternion {
  const yAxis = noseDir.clone().normalize();
  _orthoRight.crossVectors(yAxis, radialUp);
  if (_orthoRight.lengthSq() < 1e-6) {
    _orthoRight.crossVectors(LAUNCH_UNIT_VEC, TARGET_UNIT_VEC).normalize();
  } else {
    _orthoRight.normalize();
  }
  _orthoForward.crossVectors(_orthoRight, yAxis).normalize();
  _tangentMatrix.makeBasis(_orthoRight, yAxis, _orthoForward);
  return new THREE.Quaternion().setFromRotationMatrix(_tangentMatrix);
}

function computeSeparatedStageState(
  currentU: number,
  sepU: number,
  windowDurationU: number,
  lateralSign: number
): SeparatedStageState {
  const age = (currentU - sepU) / windowDurationU;
  if (age <= 0 || age >= 1) {
    return {
      visible: false,
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      separationAge: 0,
    };
  }

  const lagU = sepU + (currentU - sepU) * 0.72;
  const basePos = samplePositionAtU(lagU);
  const s = computeRangeProgress(lagU);
  const radialUp = sampleGreatCircleUnitVector(s);
  const planeNormal = new THREE.Vector3().crossVectors(LAUNCH_UNIT_VEC, TARGET_UNIT_VEC).normalize();

  const dropUnits = Math.pow(age, 1.6) * 0.42;
  const driftUnits = age * 0.08 * lateralSign;
  const pos = basePos
    .clone()
    .addScaledVector(radialUp, -dropUnits)
    .addScaledVector(planeNormal, driftUnits);

  const pA = samplePositionAtU(Math.max(0, sepU - 0.005));
  const pB = samplePositionAtU(Math.min(1, sepU + 0.005));
  const tangent = pB.sub(pA).normalize();
  const baseQuat = buildRocketQuaternion(tangent, radialUp);
  const tumbleQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0.25 * lateralSign, 0).normalize(),
    age * 3.8 * lateralSign
  );
  baseQuat.multiply(tumbleQuat);

  return {
    visible: true,
    position: pos,
    quaternion: baseQuat,
    separationAge: age,
  };
}

/**
 * Pure deterministic evaluator returning the full simulation state at `u ∈ [0, 1]`.
 */
export function evaluateFlightAt(rawU: number): FlightSample {
  const u = clamp(rawU, 0, 1);
  const {
    liftoff,
    stage1Separation,
    stage2Separation,
    stage3Burnout,
    reentryInterface,
    peakHeating,
    terminalPhaseStart,
  } = TIMELINE_EVENTS;

  const stage = getStageForU(u);
  const phaseProgress = clamp((u - stage.startU) / (stage.endU - stage.startU), 0, 1);
  const rangeProgress = computeRangeProgress(u);
  const altitudeKm = computeAltitudeKm(u);
  const sceneRadius = altitudeKmToSceneRadius(altitudeKm);

  const upNormal = sampleGreatCircleUnitVector(rangeProgress);
  const surfacePosition = upNormal.clone().multiplyScalar(EARTH_RADIUS_UNITS);
  const position = upNormal.clone().multiplyScalar(sceneRadius);

  // Compute smooth 3D velocity tangent along trajectory
  const eps = 0.0025;
  const uPrev = clamp(u - eps, 0, 1);
  const uNext = clamp(u + eps, 0, 1);
  const posPrev = samplePositionAtU(uPrev);
  const posNext = samplePositionAtU(uNext);
  const pathTangent = posNext.clone().sub(posPrev);

  if (pathTangent.lengthSq() < 1e-9) {
    pathTangent.copy(upNormal);
  } else {
    pathTangent.normalize();
  }

  // Blend vehicle nose orientation from vertical on the pad to the 3D velocity vector after liftoff
  const pitchOverBlend = smoothstep(liftoff, liftoff + 0.055, u);
  const noseDir = upNormal.clone().lerp(pathTangent, pitchOverBlend).normalize();
  const quaternion = buildRocketQuaternion(noseDir, upNormal);

  const velocityKmh = computeVelocityKmh(u, altitudeKm);
  const velocityKms = velocityKmh / 3600;
  const localSoundSpeedMs = getLocalSoundSpeedMs(altitudeKm);

  // Mach is defined whenever localSoundSpeedMs is available (altitude <= 100 km Kármán line).
  // On the launch pad (velocity = 0, altitude = 0), Mach is 0.0.
  const machNumber =
    localSoundSpeedMs !== null ? (velocityKms * 1000) / localSoundSpeedMs : null;

  const machUnavailableReason =
    machNumber === null
      ? '100 km is a conventional boundary of space; this simulator stops displaying Mach above 100 km as a simplifying model choice.'
      : null;

  const downrangeKm = rangeProgress * TOTAL_GROUND_RANGE_KM;
  const pathDistanceKm = lookupPathDistanceKm(u);
  const atmosphereLayer = getAtmosphereLayer(altitudeKm);
  const atmosphereDensity = clamp(Math.exp(-altitudeKm / 18.5), 0, 1);

  // Stage attachments & propulsion state
  const stage1Attached = u < stage1Separation;
  const stage2Attached = u < stage2Separation;
  const stage3Attached = u < stage3Burnout;
  const shroudAttached = u < stage2Separation + 0.025;

  let activePropulsionStage: 0 | 1 | 2 | 3 = 0;
  let thrustIntensity = 0;
  if (u >= 0.008 && u < stage1Separation - 0.003) {
    activePropulsionStage = 1;
    thrustIntensity =
      smoothstep(0.008, liftoff, u) *
      (1 - smoothstep(stage1Separation - 0.008, stage1Separation - 0.002, u));
  } else if (u >= stage1Separation + 0.003 && u < stage2Separation - 0.003) {
    activePropulsionStage = 2;
    thrustIntensity =
      smoothstep(stage1Separation + 0.003, stage1Separation + 0.01, u) *
      (1 - smoothstep(stage2Separation - 0.008, stage2Separation - 0.002, u));
  } else if (u >= stage2Separation + 0.003 && u < stage3Burnout) {
    activePropulsionStage = 3;
    thrustIntensity =
      smoothstep(stage2Separation + 0.003, stage2Separation + 0.01, u) *
      (1 - smoothstep(stage3Burnout - 0.01, stage3Burnout, u));
  }

  // Exhaust plume widens significantly as ambient atmospheric pressure drops
  const plumeExpansion = THREE.MathUtils.lerp(1.0, 3.3, smoothstep(0, 110, altitudeKm));

  // Pad ignition & liftoff smoke intensity
  const padSmokeIntensity =
    smoothstep(0.004, liftoff, u) * (1 - smoothstep(liftoff + 0.015, liftoff + 0.065, u));

  // Re-entry plasma sheath intensity (begins at 120 km entry interface, peaks at ~52 km)
  const plasmaRise = smoothstep(reentryInterface, peakHeating, u);
  const plasmaFall = 1 - smoothstep(peakHeating + 0.025, 0.985, u);
  const plasmaIntensity = u >= reentryInterface && u < 0.99 ? plasmaRise * plasmaFall : 0;

  // Impact light pulse (non-destructive optical marker pulse during Phase 5)
  const impactPulse = u >= terminalPhaseStart ? smoothstep(terminalPhaseStart, 1.0, u) : 0;

  // Separated stage drift states
  const separatedStage1 = computeSeparatedStageState(u, stage1Separation, 0.085, 1);
  const separatedStage2 = computeSeparatedStageState(u, stage2Separation, 0.085, -1);
  const separatedStage3 = computeSeparatedStageState(u, stage3Burnout, 0.095, 1);

  return {
    u,
    phaseProgress,
    missionTimeS: u * MISSION_DURATION_S,
    stageId: stage.id,
    stageIndex: stage.index,
    rangeProgress,
    altitudeKm,
    sceneRadius,
    velocityKmh,
    velocityKms,
    machNumber,
    machUnavailableReason,
    localSoundSpeedMs,
    downrangeKm,
    pathDistanceKm,
    atmosphereLayer,
    atmosphereDensity,
    position,
    surfacePosition,
    upNormal,
    velocityDir: noseDir,
    quaternion,
    stage1Attached,
    stage2Attached,
    stage3Attached,
    shroudAttached,
    activePropulsionStage,
    thrustIntensity,
    plumeExpansion,
    padSmokeIntensity,
    plasmaIntensity,
    impactPulse,
    separatedStage1,
    separatedStage2,
    separatedStage3,
  };
}

/**
 * Generates an array of 3D points along the full trajectory for rendering
 * the orbital path curve and ground track projection.
 */
export function buildTrajectoryPoints(segments: number = 180): {
  trajectoryPts: THREE.Vector3[];
  groundTrackPts: THREE.Vector3[];
} {
  const trajectoryPts: THREE.Vector3[] = [];
  const groundTrackPts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const s = computeRangeProgress(u);
    const altKm = computeAltitudeKm(u);
    const unitVec = sampleGreatCircleUnitVector(s);
    trajectoryPts.push(unitVec.clone().multiplyScalar(altitudeKmToSceneRadius(altKm)));
    groundTrackPts.push(unitVec.clone().multiplyScalar(EARTH_RADIUS_UNITS + 0.012));
  }
  return { trajectoryPts, groundTrackPts };
}
