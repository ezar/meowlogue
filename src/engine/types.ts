/**
 * The engine seam's types.
 *
 * earshot's own types are re-exported here rather than restated, so there is
 * one definition of a window, a pitch track or a detected vocalization and it
 * is earshot's. What this file *adds* is the app-level event: earshot speaks in
 * seconds since capture started and in YAMNet class labels, while Meowlogue
 * stores epoch milliseconds and its own vocalization vocabulary.
 *
 * See docs/decisions/0002-the-seam-is-a-directory.md.
 */

import type { ClassScore, PitchTrack, WindowFeatures } from 'earshot';

export type {
  AppliedConstraints,
  Capture,
  ClassScore,
  Engine,
  EventDetector,
  EventDetectorConfig,
  Example as KnnExample,
  GuardConfig,
  LabelReport,
  ModelUrls,
  Neighbour,
  PitchFrame,
  PitchTrack,
  Prediction,
  ValidationReport,
  VocalEvent,
  WindowFeatures,
  WindowGuard,
  WindowGuardReason,
  WindowResult,
} from 'earshot';

/**
 * earshot's own interference list, re-exported so Meowlogue can be tested
 * against it rather than against a copy.
 *
 * It is SteadyHum's list, and it contains `Cat`: for a machine-listening app a
 * cat is something contaminating the recording. Here the cat is the recording.
 * See `GUARDS` in `config.ts`.
 */
export { INTERFERENCE_CLASSES as EARSHOT_INTERFERENCE_CLASSES } from 'earshot';

/**
 * A vocalization class Meowlogue reports to the user (spec 5.1).
 *
 * `chirp` has no YAMNet class behind it; it arrives with the CLAP refinement
 * in P1 (spec 6.1) and is listed here so the timeline and insights already
 * have a slot for it.
 */
export type VocalizationType = 'meow' | 'purr' | 'hiss' | 'yowl' | 'chirp' | 'growl';

/** A 64-band log-mel thumbnail with its own shape. */
export interface MelThumbnail {
  /** Number of mel bands. Always 64 in v1. */
  readonly bands: number;
  /** Number of time frames; one per analysis window covering the event. */
  readonly frames: number;
  /** `bands * frames` magnitudes in dB, row-major (band-major). */
  readonly data: Float32Array;
}

/**
 * A detected vocalization in Meowlogue's own terms.
 *
 * Mapped from earshot's `VocalEvent`. The differences are deliberate and all
 * live in one place (`toMeowEvent`): seconds become epoch milliseconds so
 * events survive a reload and can be bucketed by hour of day (spec 6.6), and
 * the raw trigger label becomes a {@link VocalizationType} while the original
 * class scores are kept so nothing is hidden.
 */
export interface MeowEvent {
  /** Stable id, unique within a listening session. */
  readonly id: string;
  /** Event start as epoch milliseconds. */
  readonly startedAt: number;
  /** Event duration in milliseconds. */
  readonly durationMs: number;
  /** Meowlogue's vocalization type. */
  readonly type: VocalizationType;
  /** The YAMNet class that actually triggered the event, e.g. `"Caterwaul"`. */
  readonly triggerLabel: string;
  /** Confidence of the trigger class, in the range 0..1. */
  readonly confidence: number;
  /** Every class score of the triggering window, strongest first. */
  readonly classes: readonly ClassScore[];
  /** Pitch contour over the event's own audio. */
  readonly pitch: PitchTrack;
  /** Interpretable features of the event. */
  readonly features: WindowFeatures;
  /** Amplitude lobes inside the event; a two-part call counts 2 (spec 6.2). */
  readonly syllables: number;
  /** Peak level inside the event, in dBFS. */
  readonly peakDbfs: number;
  /**
   * True when a human-voice class was confident in the trigger window. Such
   * events are stored but excluded from insights until confirmed (spec 6.2),
   * because everyone imitates their cat.
   */
  readonly possibleHuman: boolean;
  /**
   * Log-mel thumbnail stacked from the windows covering the event, or null
   * when no window was retained for it.
   */
  readonly melThumbnail: MelThumbnail | null;
  /**
   * Mean and max pooled YAMNet embedding over the event's windows (spec 6.3),
   * or null when earshot is running classifier-only and there is none.
   */
  readonly embedding: EventEmbedding | null;
}

/**
 * An event's pooled YAMNet embedding (spec 6.3).
 *
 * Both poolings are kept because identity (spec 6.4) uses both: the mean
 * describes the whole call, the max keeps the strongest evidence from any one
 * window.
 */
export interface EventEmbedding {
  /** Mean over the event's windows, one value per embedding dimension. */
  readonly mean: readonly number[];
  /** Element-wise maximum over the same windows. */
  readonly max: readonly number[];
  /** How many windows were pooled; 1 means mean and max are the same vector. */
  readonly windows: number;
}

/** Root-mean-square level of the most recent analysis window. */
export interface LevelUpdate {
  /** Current RMS level in dBFS (negative; 0 dBFS is full scale). */
  readonly rmsDbfs: number;
  /** Estimated noise floor in dBFS, tracked over recent windows. */
  readonly noiseFloorDbfs: number;
}

/** Lifecycle of the capture graph plus the model loading it depends on. */
export type EngineStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading-models' }
  | { readonly kind: 'listening' }
  | { readonly kind: 'suspended'; readonly reason: 'page-hidden' | 'user' }
  | { readonly kind: 'error'; readonly error: EngineError };

/** Reasons the engine can fail, kept narrow so the UI can speak plainly. */
export type EngineErrorCode =
  | 'microphone-denied'
  | 'microphone-unavailable'
  | 'models-missing'
  | 'embedder-unavailable'
  | 'unsupported-browser'
  | 'internal';

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

/** Events the listener emits to its subscribers. */
export interface ListenerEventMap {
  status: EngineStatus;
  level: LevelUpdate;
  detection: MeowEvent;
}

export type ListenerListener<K extends keyof ListenerEventMap> = (
  payload: ListenerEventMap[K],
) => void;

/** Unsubscribes a listener registered with {@link Listener.on}. */
export type Unsubscribe = () => void;

/**
 * Meowlogue's listening session: one microphone, one inference worker and one
 * vocalization detector, composed.
 */
export interface Listener {
  readonly status: EngineStatus;
  /** True when the YAMNet embedder loaded; identity needs it (spec 6.4). */
  readonly hasEmbedder: boolean;
  on<K extends keyof ListenerEventMap>(event: K, listener: ListenerListener<K>): Unsubscribe;
  /** Requests microphone access, loads models and starts capturing. */
  start(): Promise<void>;
  /** Stops capture and tears down the worker and AudioContext. */
  stop(): Promise<void>;
}
