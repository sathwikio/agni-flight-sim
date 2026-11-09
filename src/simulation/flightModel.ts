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
 * At 800 km apogee, true scale on R=10 is +1.255 units; visual scale is ~2.35 units.
 */
export const ALTITUDE_VISUAL_EXAGGERATION = 1.85;

/**
 * Vehicle size scale in world units at ground level and in orbital view.
 * Dynamically blended with camera distance so the vehicle is both inspectable
 * on the launch pad and visible during powered ascent / re-entry.
 */
export const MISSION_DURATION_S = 900; // 15 minutes illustrative flight duration
export const PLAYBACK_REALTIME_DURATION_S = 75; // 1x playback completes full mission in 75 seconds

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

// Normalized timeline landmarks (u in [0, 1])
export const TIMELINE_EVENTS = {
  ignitionStart: 0.0,
  liftoff: 0.035,
  stage1Separation: 0.125,
  stage2Separation: 0.215,
  stage3Burnout: 0.28, // End of powered ascent / start of midcourse free-flight
  apogee: 0.54,
  reentryInterface: 0.78, // ~120 km entry interface
  peakHeating: 0.885,
  impact: 1.0,
} as const;

export interface StageRange {
  id: StageId;
  index: number;
  startU: number;
  endU: number;
}

export const STAGE_RANGES: StageRange[] = [
  { id: 'launch', index: 0, startU: 0.0, endU: 0.075 },
  { id: 'ascent', index: 1, startU: 0.075, endU: 0.28 },
  { id: 'midcourse', index: 2, startU: 0.28, endU: 0.78 },
  { id: 'reentry', index: 3, startU: 0.78, endU: 0.955 },
  { id: 'impact', index: 4, startU: 0.955, endU: 1.0 },
];

export interface SeparatedStageState {
  visible: boolean;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  separationAge: number; // 0 -> 1 fade / drift window
}

export interface FlightSample {
  /** Normalized progress in [0, 1] */
  u: number;
  /** Illustrative mission elapsed time in seconds (T-5s to T+895s) */
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
  /** Local Mach number when below 105 km, or null in vacuum/exosphere */
  machNumber: number | null;
  /** Local speed of sound in m/s (null in space) */
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

// Smoothstep & math utilities
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
 * Remains at 0 during pre-launch ignition and vertical rise, accelerates through
 * powered ascent, coasts steadily across midcourse, and decelerates slightly
 * during steep atmospheric re-entry.
 */
export function computeRangeProgress(u: number): number {
  const { liftoff, stage3Burnout, reentryInterface } = TIMELINE_EVENTS;
  if (u <= liftoff) return 0;

  const t = clamp((u - liftoff) / (1 - liftoff), 0, 1);
  // Blend between a smooth pitch-over ease-in and steady orbital angular rate
  const boostEase = Math.pow(t, 1.55);
  const coastLinear = smoothstep(0.0, 1.0, t);
  const blend = smoothstep(liftoff, stage3Burnout, u);
  const raw = THREE.MathUtils.lerp(boostEase, coastLinear, blend * 0.65);

  // Slight steepening at terminal atmospheric entry
  const terminalDrag = smoothstep(reentryInterface, 1.0, u) * 0.018 * (1 - t);
  return clamp(raw - terminalDrag, 0, 1);
}

/**
 * Illustrative altitude profile `h(u)` in kilometers.
 * - Pre-liftoff (`u <= liftoff`): 0 km (on launch canister/pad)
 * - Powered ascent (`liftoff -> stage3Burnout`): smooth climb to ~255 km
 * - Midcourse ballistic arc (`stage3Burnout -> reentryInterface`): elliptic-like
 *   free-flight arch peaking at `APOGEE_ALTITUDE_KM` (780 km) around `u = 0.54`
 * - Atmospheric re-entry (`reentryInterface -> 1.0`): descent from ~120 km to 0 km
 */
export function computeAltitudeKm(u: number): number {
  const { liftoff } = TIMELINE_EVENTS;
  if (u <= liftoff) return 0;
  if (u >= 1.0) return 0;

  const s = computeRangeProgress(u);
  // Symmetric arch over downrange progress s, skewed slightly toward launch for realistic boost-coast look
  const archSkew = Math.pow(s, 0.88);
  const arch = Math.sin(archSkew * Math.PI);
  // Combine range arch with time-based vertical liftoff envelope so vertical climb starts immediately at liftoff
  const earlyVertical = smoothstep(liftoff, liftoff + 0.06, u) * (1 - smoothstep(0.08, 0.25, u)) * 22;
  const mainAltitude = APOGEE_ALTITUDE_KM * Math.pow(arch, 1.18);
  return Math.max(0, mainAltitude + earlyVertical);
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
 * altitude. Above ~105 km, the mean free path of gas molecules exceeds the
 * vehicle scale, so a continuum speed of sound and Mach number are not
 * physically meaningful.
 */
export function getLocalSoundSpeedMs(altitudeKm: number): number | null {
  if (altitudeKm > 105) return null;
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
  // Upper mesosphere / lower thermosphere transition (85 -> 105 km)
  return THREE.MathUtils.lerp(269.4, 285.0, (altitudeKm - 85) / 20);
}

/**
 * Illustrative speed profile in km/h across the five flight phases:
 * - Pre-launch: 0 km/h
 * - Stage 1-3 Powered Ascent: accelerates from 0 to ~24,200 km/h (~6.72 km/s)
 * - Midcourse Coast: slows as kinetic energy converts to gravitational potential
 *   energy toward apogee (~19,400 km/h at apogee), then re-accelerates on descent
 *   to ~24,600 km/h at atmospheric entry interface
 * - Atmospheric Re-entry: intense aerodynamic deceleration in the lower
 *   stratosphere/troposphere from ~24,600 km/h down to ~11,200 km/h at impact
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
    // 3-stage stepped acceleration curve
    const s1 = smoothstep(liftoff, stage1Separation, u) * 7600;
    const s2 = smoothstep(stage1Separation, stage2Separation, u) * 8400;
    const s3 = smoothstep(stage2Separation, stage3Burnout, u) * 8200;
    return s1 + s2 + s3; // reaches ~24,200 km/h at burnout
  }

  if (u <= reentryInterface) {
    // Vis-viva inspired energy exchange: slower at high altitude, faster as it falls back
    const burnoutAlt = computeAltitudeKm(stage3Burnout);
    const deltaAlt = Math.max(0, altitudeKm - burnoutAlt);
    const gravityLoss = (deltaAlt / (APOGEE_ALTITUDE_KM - burnoutAlt)) * 4800;
    const entryGain = smoothstep(0.62, reentryInterface, u) * 400;
    return 24200 - gravityLoss + entryGain;
  }

  // Atmospheric re-entry deceleration (ballistic coefficient + dense lower atmosphere drag)
  const highAltSpeed = 24600;
  const dragOnset = smoothstep(reentryInterface, peakHeating, u) * 3200;
  const denseAtmoBraking = Math.pow(smoothstep(peakHeating, 0.995, u), 1.45) * 10200;
  return Math.max(1200, highAltSpeed - dragOnset - denseAtmoBraking);
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
    if (clamped <= st.endU || i === STAGE_RANGES.length - 1) {
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
  // Construct an orthonormal basis where local +Y is noseDir and local +Z faces away from Earth/trajectory plane
  const yAxis = noseDir.clone().normalize();
  _orthoRight.crossVectors(yAxis, radialUp);
  if (_orthoRight.lengthSq() < 1e-6) {
    // Vertical flight: use trajectory great-circle plane normal as reference
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

  // Follow a lower ballistic arc lagging behind the main vehicle and tumbling gently
  const lagU = sepU + (currentU - sepU) * 0.72;
  const basePos = samplePositionAtU(lagU);
  const s = computeRangeProgress(lagU);
  const radialUp = sampleGreatCircleUnitVector(s);
  const planeNormal = new THREE.Vector3().crossVectors(LAUNCH_UNIT_VEC, TARGET_UNIT_VEC).normalize();

  // Drop radially inward and drift slightly off-axis
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
  } = TIMELINE_EVENTS;

  const stage = getStageForU(u);
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

  // Blend vehicle nose orientation from strictly vertical on the pad to the 3D velocity vector after pitch-over
  const pitchOverBlend = smoothstep(liftoff, liftoff + 0.055, u);
  const noseDir = upNormal.clone().lerp(pathTangent, pitchOverBlend).normalize();
  const quaternion = buildRocketQuaternion(noseDir, upNormal);

  const velocityKmh = computeVelocityKmh(u, altitudeKm);
  const velocityKms = velocityKmh / 3600;
  const localSoundSpeedMs = getLocalSoundSpeedMs(altitudeKm);
  const machNumber =
    localSoundSpeedMs !== null && u > liftoff && u < 1.0
      ? (velocityKms * 1000) / localSoundSpeedMs
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
    thrustIntensity = smoothstep(0.008, liftoff, u) * (1 - smoothstep(stage1Separation - 0.008, stage1Separation - 0.002, u));
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

  // Re-entry plasma sheath intensity (peaks around 65-45 km altitude during hypersonic entry)
  const plasmaRise = smoothstep(reentryInterface, peakHeating, u);
  const plasmaFall = 1 - smoothstep(peakHeating + 0.03, 0.975, u);
  const plasmaIntensity = u >= reentryInterface && u < 0.985 ? plasmaRise * plasmaFall : 0;

  // Impact light pulse (non-destructive optical marker pulse at target zone)
  const impactPulse = u >= 0.965 ? smoothstep(0.965, 1.0, u) : 0;

  // Separated stage drift states
  const separatedStage1 = computeSeparatedStageState(u, stage1Separation, 0.085, 1);
  const separatedStage2 = computeSeparatedStageState(u, stage2Separation, 0.085, -1);
  const separatedStage3 = computeSeparatedStageState(u, stage3Burnout, 0.095, 1);

  return {
    u,
    missionTimeS: u * MISSION_DURATION_S,
    stageId: stage.id,
    stageIndex: stage.index,
    rangeProgress,
    altitudeKm,
    sceneRadius,
    velocityKmh,
    velocityKms,
    machNumber,
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
