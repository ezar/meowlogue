import type { IdentityExample, IdentityFeatures } from '@/engine';

/**
 * Synthetic cat voices for the identity tests (spec 6.7).
 *
 * A real YAMNet embedding of a real meow is not something a unit test can
 * conjure, and it is not what these tests are about: what has to be proved
 * here is the arithmetic around the classifier — the weighting, the
 * standardization, the gate — and that needs vectors with known geometry, not
 * realistic ones. Each cat gets a direction of its own, every example is that
 * direction plus a deterministic wobble, and nothing here uses a random
 * generator, so a failure is always reproducible.
 */

/** Embedding dimensions per pooling, as YAMNet's. */
const DIMENSIONS = 64;

/**
 * A cat's characteristic embedding direction, of unit length.
 *
 * Unit length matters: the blend of two directions of different lengths is not
 * equidistant from either, so an unnormalized pair would make
 * {@link blendVoices} lean towards whichever voice happened to be longer and a
 * "split vote" test would never see a split vote.
 *
 * @param voice Index of the voice; different indices point different ways.
 */
function direction(voice: number, dimensions = DIMENSIONS): number[] {
  const raw = Array.from({ length: dimensions }, (_, i) => Math.cos((i + 1) * 0.21 * (voice + 1)));
  const length = Math.sqrt(raw.reduce((sum, value) => sum + value * value, 0));
  return raw.map((value) => value / length);
}

/**
 * A deterministic pseudo-random value in `-1..1` from three integers.
 *
 * The fractional part of a large sine: reproducible across runs and platforms,
 * and — unlike a smooth function of the indices — uncorrelated with the voice,
 * which is what noise has to be. A wobble that varied smoothly with the voice
 * would be a second signature rather than noise, and the voices would only get
 * *easier* to tell apart as it grew.
 */
function hash(a: number, b: number, c: number): number {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

/** A deterministic perturbation of one example, scaled by `amount`. */
function wobble(voice: number, example: number, amount: number, dimensions = DIMENSIONS): number[] {
  return Array.from({ length: dimensions }, (_, i) => amount * hash(i + 1, example + 1, voice + 1));
}

/** Options for {@link makeIdentityFeatures}. */
export interface VoiceOptions {
  /** Which cat this sounds like; distinct voices are distinguishable. */
  readonly voice: number;
  /** Which example of that voice, so no two are identical. */
  readonly example?: number;
  /**
   * How far this example strays from its voice, in both the embedding and the
   * descriptors. Around 0.05 the voices are cleanly separable; by 2.5 they
   * overlap and the honest self-test result is a low one.
   */
  readonly noise?: number;
  /** Overrides for the pitch and duration descriptors. */
  readonly descriptors?: Partial<IdentityFeatures>;
}

/** One event's features, as identity sees them. */
export function makeIdentityFeatures(options: VoiceOptions): IdentityFeatures {
  const { voice, example = 0, noise = 0.05 } = options;
  // Scaled to the unit direction, so `noise` means the same thing whatever
  // the dimension count.
  const base = direction(voice);
  const offset = wobble(voice, example, noise / Math.sqrt(DIMENSIONS));
  const mean = base.map((value, i) => value + (offset[i] ?? 0));
  // Max pooling is element-wise larger than the mean by construction.
  const max = mean.map((value) => value + 0.1);
  // The descriptors are jittered by the same `noise`, or a set with
  // overlapping embeddings would still be perfectly separable by duration and
  // pitch alone — which is a fixture telling the test what it wants to hear.
  return {
    embeddingMean: mean,
    embeddingMax: max,
    durationMs: 500 + voice * 120 + noise * 300 * hash(7, example + 1, voice + 1),
    medianF0Hz: 480 + voice * 60 + noise * 150 * hash(11, example + 1, voice + 1),
    contourSlopeSemitonesPerSecond: 4 - voice + noise * 3 * hash(13, example + 1, voice + 1),
    voicedFraction: 0.8,
    syllables: 2,
    ...options.descriptors,
  };
}

/**
 * A confirmed training set: `perCat` examples for each cat id.
 *
 * @param catIds The cats to generate, in order; each gets its own voice.
 * @param perCat How many confirmed examples each one has.
 * @param noise How far examples stray from their voice.
 */
export function makeTrainingSet(
  catIds: readonly string[],
  perCat: number,
  noise = 0.05,
): IdentityExample[] {
  const examples: IdentityExample[] = [];
  catIds.forEach((catId, voice) => {
    for (let example = 0; example < perCat; example += 1) {
      examples.push({
        id: `${catId}-${example}`,
        catId,
        ...makeIdentityFeatures({ voice, example, noise }),
      });
    }
  });
  return examples;
}

/**
 * An event halfway between two voices, descriptors included.
 *
 * A query like this is what a split vote looks like: the honest answer is
 * "not sure", and spec 6.4 requires the app to say so rather than pick.
 */
export function blendVoices(a: IdentityFeatures, b: IdentityFeatures): IdentityFeatures {
  const mid = (x: number, y: number): number => (x + y) / 2;
  return {
    embeddingMean: a.embeddingMean.map((value, i) => mid(value, b.embeddingMean[i] ?? 0)),
    embeddingMax: a.embeddingMax.map((value, i) => mid(value, b.embeddingMax[i] ?? 0)),
    durationMs: mid(a.durationMs, b.durationMs),
    medianF0Hz: mid(a.medianF0Hz, b.medianF0Hz),
    contourSlopeSemitonesPerSecond: mid(
      a.contourSlopeSemitonesPerSecond,
      b.contourSlopeSemitonesPerSecond,
    ),
    voicedFraction: mid(a.voicedFraction, b.voicedFraction),
    syllables: mid(a.syllables, b.syllables),
  };
}

/**
 * A training set the classifier cannot possibly learn: several cats sharing
 * one voice.
 *
 * Two cats whose calls really are indistinguishable is not a contrived case —
 * littermates exist — and it is the one the honesty gate has to survive: the
 * self-test has to come back near chance and identity has to stay hidden,
 * rather than the app guessing at 50% and calling it a name.
 *
 * @param catIds The cats to spread the examples over.
 * @param perCat How many examples each one gets.
 */
export function makeIndistinguishableSet(
  catIds: readonly string[],
  perCat: number,
): IdentityExample[] {
  return Array.from({ length: catIds.length * perCat }, (_, index) => {
    const catId = catIds[index % catIds.length] as string;
    return {
      id: `${catId}-${index}`,
      catId,
      ...makeIdentityFeatures({ voice: 0, example: index }),
    };
  });
}
