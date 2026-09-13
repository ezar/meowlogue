import { crossValidate, l2Normalize, predictWith, semitones } from 'earshot';
import { CONFIDENCE, IDENTITY_FEATURES, IDENTITY_GATE } from './config';
import type { KnnExample, Neighbour, ValidationReport } from './types';

/**
 * "Who was that?" — identity over confirmed vocalizations (spec 6.4).
 *
 * earshot supplies the mechanism: a cosine kNN with distance-weighted votes,
 * per-label prototypes and a stratified k-fold self-test. What it cannot
 * supply is the part that is about cats and about honesty:
 *
 * 1. **The feature vector.** Spec 6.4 does not classify on the embedding
 *    alone. It concatenates the L2-normalized embedding with standardized
 *    pitch and duration descriptors, weighted so the 2048 embedding
 *    dimensions cannot drown out the five that a person would actually
 *    describe ("Luna's call is short and rising").
 * 2. **The gate.** A guess is not shown until each cat has
 *    {@link IDENTITY_GATE.minExamplesPerCat} confirmed examples *and* the
 *    self-test reaches {@link IDENTITY_GATE.minSelfTestAccuracy}. Until then
 *    the app says it is still learning. That is the whole difference between
 *    Meowlogue and an app that translates cats.
 *
 * Everything here is pure and synchronous: no DOM, no database, no model. It
 * takes plain numbers and returns plain numbers, which is what makes spec
 * 6.4's arithmetic testable on synthetic fixtures.
 */

/** The pitch and duration descriptors of an event, before standardization. */
export interface IdentityFeatures {
  /** Mean pooled YAMNet embedding over the event's windows (spec 6.3). */
  readonly embeddingMean: readonly number[];
  /** Element-wise maximum pooling over the same windows. */
  readonly embeddingMax: readonly number[];
  /** Event duration, in milliseconds. */
  readonly durationMs: number;
  /** Median fundamental frequency, in Hz. */
  readonly medianF0Hz: number;
  /** Contour slope, in semitones per second: rising, flat or falling. */
  readonly contourSlopeSemitonesPerSecond: number;
  /** Fraction of frames with a voiced pitch, 0..1. */
  readonly voicedFraction: number;
  /** Amplitude lobes inside the event; a two-part call counts 2. */
  readonly syllables: number;
}

/** One confirmed example: features plus the cat the user named. */
export interface IdentityExample extends IdentityFeatures {
  /** The event id, so a prediction can point back at what produced it. */
  readonly id: string;
  /** The confirmed cat id; this is the kNN label. */
  readonly catId: string;
}

/**
 * Mean and deviation of each descriptor across a training set.
 *
 * Standardization has to be fitted on the household's own cats, not on
 * constants: a Siamese and a British Shorthair do not share a pitch range, and
 * a fixed scale would make every call in one house look extreme.
 */
export interface DescriptorStats {
  readonly mean: readonly number[];
  /** Standard deviation per descriptor, floored so a constant one is inert. */
  readonly deviation: readonly number[];
  /** Examples the statistics were fitted on. */
  readonly count: number;
}

/**
 * The descriptors, in vector order.
 *
 * Pitch and duration only, as spec 6.4 says — the spectral features stay out
 * of the identity vector because they describe the room at least as much as
 * the cat, and a cat that moves between rooms is still the same cat.
 */
export const IDENTITY_DESCRIPTORS = [
  /** Log duration: the difference between 200 ms and 400 ms matters as much
      as between 1 s and 2 s, which a linear millisecond scale would miss. */
  'logDuration',
  /** Median f0 in semitones, because pitch is perceived logarithmically. */
  'pitchSemitones',
  'contourSlope',
  'voicedFraction',
  'syllables',
] as const;

/** Reference pitch for the semitone scale, in Hz (A4). */
const PITCH_REFERENCE_HZ = 440;

/** Smallest deviation treated as real, so a constant descriptor scales to 0. */
const MIN_DEVIATION = 1e-6;

/**
 * How many deviations a standardized descriptor is allowed to reach.
 *
 * One 3-second yowl among ten meows would otherwise produce a duration
 * component twenty times the size of every other axis and decide the vote on
 * its own.
 */
const DESCRIPTOR_CLIP = 3;

/**
 * The raw descriptors of one event, in {@link IDENTITY_DESCRIPTORS} order.
 *
 * @param features The event's pitch, duration and syllable count.
 * @returns One value per descriptor, in their natural units.
 */
export function descriptorsOf(features: IdentityFeatures): number[] {
  return [
    Math.log(Math.max(1, features.durationMs)),
    semitones(PITCH_REFERENCE_HZ, features.medianF0Hz),
    features.contourSlopeSemitonesPerSecond,
    features.voicedFraction,
    features.syllables,
  ];
}

/**
 * Fits per-descriptor mean and deviation over a training set.
 *
 * @param examples The confirmed examples to fit on; an empty set gives
 *   zero means and inert deviations, so vectors stay well-formed.
 */
export function fitDescriptorStats(examples: readonly IdentityFeatures[]): DescriptorStats {
  const dimensions = IDENTITY_DESCRIPTORS.length;
  const mean = new Float64Array(dimensions);
  const deviation = new Float64Array(dimensions).fill(MIN_DEVIATION);
  if (examples.length === 0) {
    return { mean: Array.from(mean), deviation: Array.from(deviation), count: 0 };
  }

  const rows = examples.map((example) => descriptorsOf(example));
  for (const row of rows) {
    for (let i = 0; i < dimensions; i += 1) mean[i] = (mean[i] ?? 0) + (row[i] ?? 0);
  }
  for (let i = 0; i < dimensions; i += 1) mean[i] = (mean[i] ?? 0) / rows.length;

  for (const row of rows) {
    for (let i = 0; i < dimensions; i += 1) {
      const delta = (row[i] ?? 0) - (mean[i] ?? 0);
      deviation[i] = (deviation[i] ?? 0) + delta * delta;
    }
  }
  for (let i = 0; i < dimensions; i += 1) {
    // Population deviation, not sample: with ten examples the difference is
    // real but this is a scale factor, not an inference about a wider set.
    const variance = ((deviation[i] ?? 0) - MIN_DEVIATION) / rows.length;
    deviation[i] = Math.max(MIN_DEVIATION, Math.sqrt(variance));
  }

  return { mean: Array.from(mean), deviation: Array.from(deviation), count: rows.length };
}

/**
 * Builds the feature vector spec 6.4 classifies on.
 *
 * Three blocks, concatenated, each scaled so that its share of the vector's
 * length is the share spec 6.4 asks for — 0.7 embedding, 0.3 pitch and
 * duration. Because the distance is cosine, only the *relative* lengths of the
 * blocks matter, and this is how the weighting is expressed:
 *
 * - **Mean embedding**, L2-normalized, scaled by `0.7 / √2`.
 * - **Max embedding**, L2-normalized, scaled by `0.7 / √2`. Two halves of one
 *   0.7 block: the mean describes the whole call, the max keeps the strongest
 *   window, and neither is allowed to outweigh the other.
 * - **Descriptors**, standardized and divided by `√5`, scaled by 0.3. The
 *   division is what makes the 0.3 honest: a standardized descriptor has unit
 *   variance, so five of them have an expected squared length of 5, and
 *   dividing by `√5` brings the block's *expected* length to 1 before the
 *   weight is applied. Normalizing the block per event instead would amplify
 *   the most average-sounding calls to full length, which is the opposite of
 *   what it should do.
 *
 * @param features One event's embeddings, pitch and duration.
 * @param stats Statistics fitted on the training set with
 *   {@link fitDescriptorStats}.
 * @returns A vector of `2 × embedding length + 5` values.
 */
export function identityVector(features: IdentityFeatures, stats: DescriptorStats): number[] {
  const { embedding: embeddingWeight, descriptors: descriptorWeight } = IDENTITY_FEATURES;
  const halfWeight = embeddingWeight / Math.SQRT2;
  const vector: number[] = [];

  for (const pooling of [features.embeddingMean, features.embeddingMax]) {
    const unit = l2Normalize(pooling);
    for (const value of unit) vector.push(value * halfWeight);
  }

  const raw = descriptorsOf(features);
  const scale = descriptorWeight / Math.sqrt(IDENTITY_DESCRIPTORS.length);
  for (let i = 0; i < IDENTITY_DESCRIPTORS.length; i += 1) {
    const standardized = ((raw[i] ?? 0) - (stats.mean[i] ?? 0)) / (stats.deviation[i] ?? 1);
    const clipped = Math.max(-DESCRIPTOR_CLIP, Math.min(DESCRIPTOR_CLIP, standardized));
    vector.push(clipped * scale);
  }

  return vector;
}

/** A trained identity model: the examples, their scaling, and its self-test. */
export interface IdentityModel {
  /** The kNN examples, embeddings already normalized by earshot. */
  readonly examples: readonly KnnExample[];
  /** The standardization the vectors were built with. */
  readonly stats: DescriptorStats;
  /** The 5-fold self-test over those examples (spec 6.4). */
  readonly report: ValidationReport;
  /** Confirmed examples per cat id. */
  readonly countsByCat: Readonly<Record<string, number>>;
  /** Neighbours considered per prediction. */
  readonly k: number;
}

/**
 * Trains identity on the confirmed set and self-tests it.
 *
 * There is no fitting step beyond standardization: kNN stores its examples.
 * The expensive half is the cross-validation, which is why this runs once when
 * the confirmed set changes rather than once per prediction.
 *
 * @param examples Every confirmed vocalization, with the cat the user named.
 * @returns A model that {@link predictIdentity} can query, plus the self-test
 *   that {@link identityReadiness} judges.
 */
export function trainIdentity(examples: readonly IdentityExample[]): IdentityModel {
  const stats = fitDescriptorStats(examples);
  const knnExamples: KnnExample[] = examples.map((example) => ({
    id: example.id,
    label: example.catId,
    embedding: identityVector(example, stats),
  }));

  const countsByCat: Record<string, number> = {};
  for (const example of examples) {
    countsByCat[example.catId] = (countsByCat[example.catId] ?? 0) + 1;
  }

  const report = crossValidate(knnExamples, {
    folds: IDENTITY_GATE.selfTestFolds,
    k: IDENTITY_FEATURES.neighbours,
  });

  return { examples: knnExamples, stats, report, countsByCat, k: IDENTITY_FEATURES.neighbours };
}

/** What the model thinks, and how loudly it is allowed to say it. */
export interface IdentityGuess {
  /** The most likely cat id. */
  readonly catId: string;
  /**
   * Vote **margin**, 0..1: the winner's share of the vote minus the
   * runner-up's (spec 6.4).
   *
   * Not the winner's share, which is what earshot returns, and the difference
   * is not cosmetic. With k=5 neighbours and two cats the winner's share can
   * never fall below 0.6 — three votes out of five — so a "not sure" threshold
   * of 0.55 against the share would never fire and every guess would be shown
   * as certain. Spec 6.4 asks for the margin precisely because the margin is
   * what a split vote looks like: 3 votes to 2 is a margin of 0.2, and a
   * household where both cats claim the same call reads as unsure rather than
   * as a coin flip won.
   */
  readonly confidence: number;
  /** The winner's raw share of the vote weight, kept so nothing is hidden. */
  readonly voteShare: number;
  /**
   * True when the confidence is below {@link CONFIDENCE.notSureBelow} and the
   * guess must be shown as "not sure" rather than as a name.
   */
  readonly notSure: boolean;
  /**
   * True inside {@link CONFIDENCE.activeLearningRange}, where spec 6.4 asks
   * for the confirmation chips to be emphasised: these are the events whose
   * answers teach the classifier the most.
   */
  readonly askAgain: boolean;
  /** The neighbours behind the vote, nearest first, so nothing is a black box. */
  readonly neighbours: readonly Neighbour[];
}

/**
 * Classifies one event against a trained model.
 *
 * @param model The model from {@link trainIdentity}.
 * @param features The event to identify.
 * @returns The guess, or null when the model holds no examples at all.
 */
export function predictIdentity(
  model: IdentityModel,
  features: IdentityFeatures,
): IdentityGuess | null {
  if (model.examples.length === 0) return null;
  const prediction = predictWith(model.examples, identityVector(features, model.stats), model.k);
  if (prediction.label === null) return null;

  const [best, runnerUp] = prediction.scores;
  const margin = (best?.score ?? 0) - (runnerUp?.score ?? 0);
  const { low, high } = CONFIDENCE.activeLearningRange;
  return {
    catId: prediction.label,
    confidence: margin,
    voteShare: prediction.confidence,
    notSure: margin < CONFIDENCE.notSureBelow,
    askAgain: margin >= low && margin <= high,
    neighbours: prediction.neighbours,
  };
}

/**
 * Whether identity may be shown at all, and what is missing when it may not.
 *
 * Spec 6.4's gate, as a value rather than as a boolean, because the app has to
 * tell the user which of the two conditions is unmet: "two more from Mia" is
 * something a person can act on, "still learning" twice in a row is not.
 */
export type IdentityReadiness =
  | { readonly kind: 'active'; readonly accuracy: number }
  /** One cat, or none: there is nobody to tell apart (spec 5.1). */
  | { readonly kind: 'needs-cats' }
  /** Confirmed examples still needed, per cat id. */
  | { readonly kind: 'needs-examples'; readonly missingByCat: Readonly<Record<string, number>> }
  /** Enough examples, but the self-test is below the threshold. */
  | { readonly kind: 'needs-accuracy'; readonly accuracy: number };

/**
 * Applies spec 6.4's gate to a trained model.
 *
 * @param model The model from {@link trainIdentity}.
 * @param catIds Every cat in the household, including those with no examples:
 *   a cat the app has never heard is exactly the one that breaks a guess.
 */
export function identityReadiness(
  model: IdentityModel,
  catIds: readonly string[],
): IdentityReadiness {
  if (catIds.length < 2) return { kind: 'needs-cats' };

  const missingByCat: Record<string, number> = {};
  for (const catId of catIds) {
    const missing = IDENTITY_GATE.minExamplesPerCat - (model.countsByCat[catId] ?? 0);
    if (missing > 0) missingByCat[catId] = missing;
  }
  if (Object.keys(missingByCat).length > 0) return { kind: 'needs-examples', missingByCat };

  const accuracy = model.report.accuracy;
  if (accuracy < IDENTITY_GATE.minSelfTestAccuracy) return { kind: 'needs-accuracy', accuracy };
  return { kind: 'active', accuracy };
}
