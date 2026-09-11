/**
 * The contract meowlogue needs from `earshot`.
 *
 * These types describe the audio engine's surface as specified in section 6 of
 * the Meowlogue spec. They live here, not in application code, so that exactly
 * one module (`earshot-adapter.ts`) ever imports from the `earshot` package.
 * When earshot tags a release, this file is reconciled against its published
 * types and the adapter is pointed at them; nothing else in the app moves.
 *
 * See docs/decisions/0001-earshot-integration-seam.md.
 */

/**
 * A vocalization class earshot can trigger on, named after the AudioSet
 * classes YAMNet exposes (spec 6.1).
 */
export type VocalizationType = 'meow' | 'purr' | 'hiss' | 'yowl' | 'chirp' | 'growl';

/** The AudioSet class names that map onto {@link VocalizationType} triggers. */
export type AudioSetClassName =
  | 'Cat'
  | 'Meow'
  | 'Purr'
  | 'Hiss'
  | 'Caterwaul'
  | 'Growling'
  | 'Animal'
  | 'Domestic animals, pets'
  | 'Speech';

/** One YAMNet classifier score for a single analysis window. */
export interface ClassScore {
  /** AudioSet class name as reported by the classifier. */
  readonly label: string;
  /** Classifier score in the range 0..1. */
  readonly score: number;
}

/**
 * Pitch descriptors for one event, produced by earshot's YIN/pYIN tracker
 * (25 ms frames, 10 ms hop, 80..1200 Hz search range; spec 6.1).
 */
export interface PitchFeatures {
  /** Median fundamental frequency across voiced frames, in Hz. */
  readonly f0MedianHz: number;
  /** 5th percentile of the fundamental frequency, in Hz. */
  readonly f0P5Hz: number;
  /** 95th percentile of the fundamental frequency, in Hz. */
  readonly f0P95Hz: number;
  /**
   * Slope of a linear fit over the f0 contour, in Hz per second. Positive is
   * a rising call, negative is falling.
   */
  readonly contourSlopeHzPerSec: number;
  /** Fraction of frames the tracker considered voiced, in the range 0..1. */
  readonly voicedRatio: number;
  /**
   * Mean tracker confidence across voiced frames, in the range 0..1. Used as a
   * harmonicity proxy (spec 6.3).
   */
  readonly harmonicity: number;
}

/**
 * The full feature vector stored per event (spec 6.3). Embeddings are kept as
 * `Float32Array` so they can be transferred from the worker without a copy.
 */
export interface EventFeatures {
  /** Mean-pooled YAMNet embedding over the event's windows. Length 1024. */
  readonly embeddingMean: Float32Array;
  /** Max-pooled YAMNet embedding over the event's windows. Length 1024. */
  readonly embeddingMax: Float32Array;
  readonly pitch: PitchFeatures;
  /** Event duration in milliseconds. */
  readonly durationMs: number;
  /**
   * Number of syllables detected inside the event; segments closer than 250 ms
   * are merged into one event and counted here (spec 6.2).
   */
  readonly syllableCount: number;
  /** Peak RMS over the event, in dBFS (negative; 0 dBFS is full scale). */
  readonly peakRmsDbfs: number;
  /** Median spectral centroid over the event, in Hz. */
  readonly spectralCentroidMedianHz: number;
  /**
   * 64-band log-mel thumbnail, row-major as `bands * frames`, values in dB.
   * Rendered by the app for the spectrogram image (spec 6.3).
   */
  readonly melThumbnail: MelThumbnail;
}

/** A 64-band log-mel spectrogram thumbnail with its own shape. */
export interface MelThumbnail {
  /** Number of mel bands. Always 64 in v1. */
  readonly bands: number;
  /** Number of time frames in the thumbnail. */
  readonly frames: number;
  /** `bands * frames` magnitudes in dB, row-major (band-major). */
  readonly data: Float32Array;
}

/** A detected and segmented vocalization, before any household labelling. */
export interface DetectedEvent {
  /** Stable id for this detection, unique within a listening session. */
  readonly id: string;
  /** Wall-clock time of the segment start, as epoch milliseconds. */
  readonly startedAt: number;
  /** Event duration in milliseconds. */
  readonly durationMs: number;
  /** The engine's vocalization type guess. */
  readonly type: VocalizationType;
  /** Confidence of the type guess, in the range 0..1. */
  readonly typeConfidence: number;
  /** Top classifier scores for the triggering window, for debugging. */
  readonly topClasses: readonly ClassScore[];
  readonly features: EventFeatures;
  /**
   * True when Speech scored above the human-guard threshold in the same
   * window. Such events are stored but excluded from insights until a human
   * confirms them (spec 6.2).
   */
  readonly possibleHuman: boolean;
  /** Opus-encoded audio for the event with padding, when clip capture is on. */
  readonly clip: Blob | null;
}

/** Root-mean-square level of the most recent analysis window. */
export interface LevelUpdate {
  /** Current RMS level in dBFS (negative; 0 dBFS is full scale). */
  readonly rmsDbfs: number;
  /** Estimated noise floor in dBFS, as tracked by the segmenter. */
  readonly noiseFloorDbfs: number;
}

/** Lifecycle of the capture graph plus the model-loading it depends on. */
export type EngineStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading-models' }
  | { readonly kind: 'listening' }
  | { readonly kind: 'suspended'; readonly reason: 'page-hidden' | 'user' }
  | { readonly kind: 'error'; readonly error: EngineError };

/** Reasons the engine can fail, kept narrow so the UI can speak plainly. */
export type EngineErrorCode =
  | 'earshot-unavailable'
  | 'microphone-denied'
  | 'microphone-unavailable'
  | 'models-missing'
  | 'unsupported-browser'
  | 'internal';

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

/** Events the engine emits to its subscribers. */
export interface EngineEventMap {
  status: EngineStatus;
  level: LevelUpdate;
  detection: DetectedEvent;
}

export type EngineListener<K extends keyof EngineEventMap> = (payload: EngineEventMap[K]) => void;

/** Unsubscribes a listener registered with {@link AudioEngine.on}. */
export type Unsubscribe = () => void;

/**
 * The capture-and-detect engine. One instance owns one AudioContext and one
 * inference worker.
 */
export interface AudioEngine {
  readonly status: EngineStatus;
  on<K extends keyof EngineEventMap>(event: K, listener: EngineListener<K>): Unsubscribe;
  /** Requests microphone access, loads models and starts the capture graph. */
  start(): Promise<void>;
  /** Stops capture and releases the microphone, keeping models warm. */
  stop(): Promise<void>;
  /** Stops capture and tears down the worker and AudioContext. */
  dispose(): Promise<void>;
}

/** Per-class score thresholds for treating a window as a candidate (spec 6.2). */
export interface DetectionThresholds {
  readonly meow: number;
  readonly cat: number;
  readonly purr: number;
  readonly hiss: number;
  readonly caterwaul: number;
  /** Speech score above which an event is flagged `possibleHuman`. */
  readonly speechGuard: number;
}

/** Segmentation policy, all in the units named by each field (spec 6.2). */
export interface SegmentationOptions {
  /** Level above the noise floor at which a segment starts, in dB. */
  readonly onsetAboveNoiseFloorDb: number;
  /** Silence needed to close a segment, in milliseconds. */
  readonly releaseMs: number;
  /** Segments shorter than this are discarded, in milliseconds. */
  readonly minDurationMs: number;
  /** Cap for non-purr events, in milliseconds. */
  readonly maxDurationMs: number;
  /** Cap for sustained purr segments, in milliseconds. */
  readonly maxPurrDurationMs: number;
  /** Segments closer than this are merged into one event, in milliseconds. */
  readonly mergeGapMs: number;
  /** Minimum spacing between emitted events, in milliseconds. */
  readonly debounceMs: number;
  /** Envelope resolution used by the segmenter, in milliseconds. */
  readonly envelopeHopMs: number;
}

/** Audio capture framing, fixed by YAMNet's input contract (spec 6.1). */
export interface CaptureOptions {
  /** Capture sample rate in Hz. YAMNet expects 16000. */
  readonly sampleRateHz: number;
  /** Analysis window length in milliseconds. */
  readonly windowMs: number;
  /** Analysis hop length in milliseconds. */
  readonly hopMs: number;
}

/** Everything the app hands earshot when constructing an engine. */
export interface EngineOptions {
  readonly capture: CaptureOptions;
  readonly thresholds: DetectionThresholds;
  readonly segmentation: SegmentationOptions;
  /** Base URL the YAMNet `.tflite` files are served from. */
  readonly modelBaseUrl: string;
  /** Padding kept on each side of a stored clip, in milliseconds. */
  readonly clipPaddingMs: number;
  /** When false, `DetectedEvent.clip` is always null. */
  readonly captureClips: boolean;
}
