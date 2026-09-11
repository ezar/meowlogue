import type {
  CaptureOptions,
  DetectionThresholds,
  EngineOptions,
  SegmentationOptions,
} from './types';

/**
 * Meowlogue's detection policy.
 *
 * These are the app's numbers, not earshot's: earshot supplies the mechanism
 * and meowlogue decides where the thresholds sit for a cat household. Every
 * value below is quoted from section 6.2 of the spec, which also flags them as
 * starting points to be tuned against the CatMeows evaluation set.
 */

/** YAMNet's input contract: 16 kHz mono, 0.975 s windows, 0.4875 s hop (spec 6.1). */
export const CAPTURE: CaptureOptions = {
  sampleRateHz: 16_000,
  windowMs: 975,
  hopMs: 487.5,
};

/**
 * Per-class score thresholds for treating a window as a candidate.
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

/** Where `pnpm models:fetch` puts the YAMNet `.tflite` files. */
export const MODEL_BASE_URL = '/models/';

/** The default engine options the debug page and, later, Listen both use. */
export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  capture: CAPTURE,
  thresholds: THRESHOLDS,
  segmentation: SEGMENTATION,
  modelBaseUrl: MODEL_BASE_URL,
  clipPaddingMs: CLIP_PADDING_MS,
  captureClips: true,
};
