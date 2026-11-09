import { create } from 'zustand';
import {
  clamp,
  getStageForU,
  PLAYBACK_REALTIME_DURATION_S,
  StageId,
} from './flightModel';
import { STAGE_DEFINITIONS } from './stages';

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;
export type CameraMode = 'follow' | 'earth' | 'free';
export type QualityMode = 'high' | 'reduced';
export type MenuSection = 'telemetry' | 'physics' | 'controls';

const isSmallMobileDevice =
  typeof window !== 'undefined' && window.innerWidth < 768;

export interface SimulationState {
  /** Normalized timeline progress u in [0, 1] */
  u: number;
  /** Whether timeline playback is currently advancing */
  playing: boolean;
  /** Playback rate multiplier */
  speed: PlaybackSpeed;
  /** Active stage identifier derived from u */
  stageId: StageId;
  /** Active camera framing mode */
  cameraMode: CameraMode;
  /** Show / hide 3D trajectory arc & ground track */
  showTrajectory: boolean;
  /** Show / hide 3D in-scene flight milestone labels */
  showFlightLabels: boolean;
  /** Graphics quality preset ('high' or 'reduced' for slower/mobile devices) */
  qualityMode: QualityMode;
  /** Monotonically incremented counter when user explicitly triggers a camera jump/stage select */
  cameraSnapNonce: number;
  /** Selected science topic tab inside the educational panel (null = follow current stage default) */
  selectedConceptId: string | null;
  /** Whether the single optional Menu drawer is open */
  menuOpen: boolean;
  /** Active section inside the unified optional Menu drawer */
  menuSection: MenuSection;

  // Actions
  setU: (u: number, snapCamera?: boolean) => void;
  advanceByDelta: (deltaSeconds: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  restart: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  selectStage: (stageId: StageId) => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleTrajectory: () => void;
  toggleFlightLabels: () => void;
  setQualityMode: (mode: QualityMode) => void;
  toggleQualityMode: () => void;
  setSelectedConceptId: (id: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: (section?: MenuSection) => void;
  setMenuSection: (section: MenuSection) => void;
}

export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4];

export const useSimulationStore = create<SimulationState>((set, get) => ({
  u: 0.0,
  playing: true,
  speed: 1,
  stageId: 'launch',
  cameraMode: 'follow',
  showTrajectory: true,
  showFlightLabels: !isSmallMobileDevice,
  qualityMode: isSmallMobileDevice ? 'reduced' : 'high',
  cameraSnapNonce: 0,
  selectedConceptId: null,
  menuOpen: false,
  menuSection: 'telemetry',

  setU: (rawU, snapCamera = false) => {
    const nextU = clamp(rawU, 0, 1);
    const nextStage = getStageForU(nextU).id;
    const prevStage = get().stageId;
    set((state) => ({
      u: nextU,
      playing: false,
      stageId: nextStage,
      selectedConceptId: nextStage !== prevStage ? null : state.selectedConceptId,
      cameraSnapNonce: snapCamera ? state.cameraSnapNonce + 1 : state.cameraSnapNonce,
    }));
  },

  advanceByDelta: (deltaSeconds) => {
    const { playing, u, speed, stageId } = get();
    if (!playing) return;
    const du = (deltaSeconds * speed) / PLAYBACK_REALTIME_DURATION_S;
    const nextU = u + du;
    if (nextU >= 1.0) {
      set({
        u: 1.0,
        playing: false,
        stageId: 'impact',
      });
      return;
    }
    const nextStage = getStageForU(nextU).id;
    set((state) => ({
      u: nextU,
      stageId: nextStage,
      selectedConceptId: nextStage !== stageId ? null : state.selectedConceptId,
    }));
  },

  togglePlay: () => {
    const { playing, u } = get();
    if (!playing && u >= 0.999) {
      set((state) => ({
        u: 0,
        playing: true,
        stageId: 'launch',
        selectedConceptId: null,
        cameraSnapNonce: state.cameraSnapNonce + 1,
      }));
    } else {
      set({ playing: !playing });
    }
  },

  setPlaying: (playing) => set({ playing }),

  restart: () =>
    set((state) => ({
      u: 0,
      playing: true,
      stageId: 'launch',
      selectedConceptId: null,
      cameraSnapNonce: state.cameraSnapNonce + 1,
    })),

  setSpeed: (speed) => set({ speed }),

  selectStage: (targetStageId) => {
    const def = STAGE_DEFINITIONS.find((s) => s.id === targetStageId);
    if (!def) return;
    set((state) => ({
      u: clamp(def.startU, 0, 1),
      playing: false,
      stageId: targetStageId,
      selectedConceptId: null,
      cameraSnapNonce: state.cameraSnapNonce + 1,
    }));
  },

  setCameraMode: (cameraMode) =>
    set((state) => ({
      cameraMode,
      cameraSnapNonce: state.cameraSnapNonce + 1,
    })),

  toggleTrajectory: () => set((state) => ({ showTrajectory: !state.showTrajectory })),

  toggleFlightLabels: () => set((state) => ({ showFlightLabels: !state.showFlightLabels })),

  setQualityMode: (qualityMode) => set({ qualityMode }),

  toggleQualityMode: () =>
    set((state) => ({
      qualityMode: state.qualityMode === 'high' ? 'reduced' : 'high',
    })),

  setSelectedConceptId: (selectedConceptId) => set({ selectedConceptId }),

  setMenuOpen: (menuOpen) => set({ menuOpen }),

  toggleMenu: (section) =>
    set((state) => {
      if (section && state.menuOpen && state.menuSection !== section) {
        return { menuSection: section };
      }
      return {
        menuOpen: !state.menuOpen,
        menuSection: section ?? state.menuSection,
      };
    }),

  setMenuSection: (menuSection) => set({ menuSection, menuOpen: true }),
}));
