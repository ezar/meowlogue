import type { GuardConfig, ModelUrls } from './types';

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
   * NOT currently applied. earshot closes a segment by level
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

/**
 * Guard policy handed to the engine (earshot 0.5.0).
 *
 * With guards configured, earshot skips the embedder for windows it rejects.
 * That is most of the per-window cost — 17.0 ms falls to 7.3 ms on silence —
 * and a cat household is mostly silence, so this is the single biggest saving
 * available to the listening loop.
 *
 * **The default list cannot be used here.** earshot's `INTERFERENCE_CLASSES`
 * is SteadyHum's: it exists to drop windows polluted by something other than
 * the machine being listened to, and it lists `Cat`, `Dog` and `Bird` among
 * the pollutants. In Meowlogue the cat is the signal. Passing the defaults
 * would reject exactly the windows identity needs and silently leave every
 * meow without an embedding.
 *
 * So the interference guard is switched off by an empty list, and only the
 * level guards remain:
 *
 * - **silence** — a window below the floor holds no vocalization to embed.
 *   The floor sits lower than earshot's -65 dBFS default because spec 6.2
 *   treats purrs as quiet at distance, and a purr wrongly called silence
 *   would lose its embedding.
 * - **too-loud** — a clipped window's embedding describes the clipping.
 *
 * Human voice is deliberately *not* a guard. Spec 6.2 says an event that may
 * be a person is stored and marked `possibleHuman`, not dropped, and the
 * confirmation flow in 6.4 needs its embedding to exist.
 */
export const GUARDS: GuardConfig = {
  silenceFloorDbfs: -72,
  maxLevelDbfs: -3,
  interferenceClasses: [],
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

/**
 * How an identity feature vector is put together (spec 6.4).
 *
 * The split is spec 6.4's starting point — "0.7 embedding, 0.3 pitch and
 * duration, and tune on the evaluation set" — and it lives here because it is
 * a decision about what makes a cat recognisable, not about how kNN works.
 * `embedding + descriptors` is 1 by construction; see `identityVector`.
 */
export const IDENTITY_FEATURES = {
  /** Share of the vector's length given to the two pooled embeddings. */
  embedding: 0.7,
  /** Share given to the standardized pitch and duration descriptors. */
  descriptors: 0.3,
  /** Neighbours per prediction: spec 6.4's k. */
  neighbours: 5,
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

/**
 * The model set to load for a session, with or without the embedder.
 *
 * The embedder is **13 MB**, three times the classifier, and about half of the
 * per-window model cost. Spec 6.4 needs two cats before identity means
 * anything — with one cat there is nobody to tell apart — so a one-cat
 * household should not pay for it. earshot treats `embedderUrl` as optional
 * and runs classifier-only when it is absent, reporting `hasEmbedder: false`.
 *
 * The decision itself is the app's: see `identityIsMeaningful` in
 * `src/db/household.ts`. This function only assembles the URLs.
 *
 * @param options `embedder` false omits the embedder URL entirely.
 */
export function modelUrlsFor(options: { readonly embedder: boolean }): ModelUrls {
  // A conditional spread rather than `embedderUrl: undefined`: under
  // `exactOptionalPropertyTypes` an optional property must be absent, and
  // earshot's worker branches on `=== undefined`.
  return {
    classifierUrl: MODEL_URLS.classifierUrl,
    wasmBaseUrl: MODEL_URLS.wasmBaseUrl,
    ...(options.embedder ? { embedderUrl: MODEL_URLS.embedderUrl } : {}),
  };
}

/** Analysis windows retained for stacking an event's log-mel thumbnail. */
export const THUMBNAIL_WINDOW_HISTORY = 24;
