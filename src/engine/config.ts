/**
 * Meowlogue's detection policy.
 *
 * These are the app's numbers, not earshot's: earshot supplies the mechanism
 * and Meowlogue decides where the thresholds sit for a cat household. Every
 * value below is quoted from section 6.2 of the spec, which also flags them as
 * starting points to be tuned against the CatMeows evaluation set.
 *
 * The policy is stated in the spec's own units — milliseconds, dB — and
 * translated into earshot's (seconds) in exactly one place,
 * `toDetectorConfig` in `vocalization.ts`.
 */

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
  /** Level above the noise floor at which a segment opens, in dB. */
  readonly onsetAboveNoiseFloorDb: number;
  /**
   * Silence needed to close a segment, in milliseconds (spec 6.2).
   *
   * NOT currently applied. earshot v0.3.0 closes a segment by level
   * hysteresis — the envelope dropping below a `closeDb` threshold — with no
   * timed release. The value is kept because the spec states it, and because
   * the honest fix is to add a timed release to earshot with tests, tag a
   * release and bump the tag here (spec section 11), not to quietly drop a
   * requirement.
   */
  readonly releaseMs: number;
  /** Segments shorter than this are discarded, in milliseconds. */
  readonly minDurationMs: number;
  /** Cap for non-purr events, in milliseconds. */
  readonly maxDurationMs: number;
  /**
   * Cap for sustained purr segments, in milliseconds.
   *
   * Not passed to the detector: earshot applies one duration cap to every
   * class, and raising it to 60 s would let a minute of room noise become a
   * single event. Purr time is measured separately (spec 6.2).
   */
  readonly maxPurrDurationMs: number;
  /** Segments closer than this are merged into one event, in milliseconds. */
  readonly mergeGapMs: number;
  /** Minimum spacing between emitted events, in milliseconds. */
  readonly debounceMs: number;
  /** Envelope resolution used by the segmenter, in milliseconds. */
  readonly envelopeHopMs: number;
}

/** Audio capture framing, fixed by YAMNet's input contract (spec 6.1). */
export interface CaptureFraming {
  /** Capture sample rate in Hz. YAMNet expects 16000. */
  readonly sampleRateHz: number;
  /** Analysis window length in milliseconds. */
  readonly windowMs: number;
  /** Analysis hop length in milliseconds. */
  readonly hopMs: number;
}

/**
 * YAMNet's input contract: 16 kHz mono, 0.975 s windows, 0.4875 s hop
 * (spec 6.1). earshot owns the framing and exports the same values as
 * `SAMPLE_RATE_HZ`, `WINDOW_SECONDS` and `HOP_SECONDS`; these are asserted
 * against those in the unit tests so the two cannot drift.
 */
export const CAPTURE: CaptureFraming = {
  sampleRateHz: 16_000,
  windowMs: 975,
  hopMs: 487.5,
};

/**
 * Per-class score thresholds for treating a window as a candidate.
 *
 * Purr sits lower because purrs are quiet at distance; hiss and caterwaul sit
 * higher because they are the classes YAMNet most often reaches for on noise.
 */
export const THRESHOLDS: DetectionThresholds = {
  meow: 0.3,
  cat: 0.3,
  purr: 0.25,
  hiss: 0.4,
  caterwaul: 0.4,
  speechGuard: 0.4,
};

/** Segmentation policy (spec 6.2). */
export const SEGMENTATION: SegmentationOptions = {
  onsetAboveNoiseFloorDb: 6,
  releaseMs: 150,
  minDurationMs: 120,
  maxDurationMs: 4_000,
  maxPurrDurationMs: 60_000,
  mergeGapMs: 250,
  debounceMs: 500,
  envelopeHopMs: 10,
};

/** Padding kept on each side of a stored clip, in milliseconds (spec 6.3). */
export const CLIP_PADDING_MS = 300;

/**
 * Identity and context confidence policy (spec 6.4 and 6.5). Held here rather
 * than in earshot because they govern what the user is told, not how the
 * classifier works.
 */
export const CONFIDENCE = {
  /** Below this, a guess is shown as "not sure" instead of a name. */
  notSureBelow: 0.55,
  /** Inside this band the confirmation chips are emphasised (active learning). */
  activeLearningRange: { low: 0.4, high: 0.7 },
  /** At or above this, an unchallenged guess auto-confirms after a day. */
  autoConfirmAtOrAbove: 0.85,
  /** Hours an auto-confirmable guess waits for a correction first. */
  autoConfirmAfterHours: 24,
} as const;

/** Enrollment gate before identity guesses are shown at all (spec 6.4). */
export const IDENTITY_GATE = {
  /** Confirmed vocalizations required per cat. */
  minExamplesPerCat: 10,
  /** Held-out accuracy required in the 5-fold self-test, in the range 0..1. */
  minSelfTestAccuracy: 0.8,
  /** Folds used by the self-test. */
  selfTestFolds: 5,
  /** Confirmed examples per cat before the on-device MLP head is trained. */
  mlpMinExamplesPerCat: 30,
} as const;

/**
 * Where `pnpm models:fetch` puts the YAMNet `.tflite` files and MediaPipe's
 * WASM runtime.
 *
 * Derived from Vite's `BASE_URL` rather than hardcoded to the site root, so
 * the app works when served from a subpath as well as from `/`. A GitHub Pages
 * project site lives at `/<repo>/`, where a root-relative `/models/` resolves
 * to the user site and 404s. `BASE_URL` always carries a trailing slash.
 */
export const MODEL_BASE_URL = `${import.meta.env.BASE_URL}models/`;

/** Model and runtime URLs handed to earshot; it never supplies defaults. */
export const MODEL_URLS = {
  classifierUrl: `${MODEL_BASE_URL}yamnet-classifier.tflite`,
  embedderUrl: `${MODEL_BASE_URL}yamnet-embedder.tflite`,
  wasmBaseUrl: `${MODEL_BASE_URL}wasm`,
} as const;

/** Analysis windows retained for stacking an event's log-mel thumbnail. */
export const THUMBNAIL_WINDOW_HISTORY = 24;
