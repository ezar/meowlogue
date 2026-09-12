import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE,
  IDENTITY_DESCRIPTORS,
  IDENTITY_FEATURES,
  IDENTITY_GATE,
  descriptorsOf,
  fitDescriptorStats,
  identityReadiness,
  identityVector,
  predictIdentity,
  trainIdentity,
} from '@/engine';
import {
  makeIdentityFeatures,
  makeIndistinguishableSet,
  makeTrainingSet,
} from './fixtures/identity';

/**
 * Identity (spec 6.4): the feature vector, the classifier and the gate.
 *
 * The gate is the part worth testing hardest. Getting a guess slightly wrong
 * is a classifier being a classifier; showing a guess the app has not earned
 * is Meowlogue breaking its one promise.
 */

/** Euclidean length of a vector. */
function norm(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

describe('descriptorsOf', () => {
  it('puts duration and pitch on logarithmic scales', () => {
    const short = descriptorsOf(
      makeIdentityFeatures({ voice: 0, descriptors: { durationMs: 250 } }),
    );
    const long = descriptorsOf(
      makeIdentityFeatures({ voice: 0, descriptors: { durationMs: 500 } }),
    );
    const longer = descriptorsOf(
      makeIdentityFeatures({ voice: 0, descriptors: { durationMs: 1000 } }),
    );

    // A doubling is the same step wherever it happens, which is the point of
    // the log: 250 to 500 ms is as big a difference as 500 to 1000 ms.
    expect((long[0] ?? 0) - (short[0] ?? 0)).toBeCloseTo((longer[0] ?? 0) - (long[0] ?? 0), 10);

    const low = descriptorsOf(makeIdentityFeatures({ voice: 0, descriptors: { medianF0Hz: 440 } }));
    const octave = descriptorsOf(
      makeIdentityFeatures({ voice: 0, descriptors: { medianF0Hz: 880 } }),
    );
    expect(low[1]).toBeCloseTo(0, 10);
    expect(octave[1]).toBeCloseTo(12, 10);
  });

  it('survives a silent event without a pitch', () => {
    // `medianF0Hz` is 0 when nothing was voiced; a log of zero would poison
    // the whole vector with a NaN and take the classifier with it.
    const values = descriptorsOf(
      makeIdentityFeatures({ voice: 0, descriptors: { medianF0Hz: 0, durationMs: 0 } }),
    );
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe('fitDescriptorStats', () => {
  it('fits the household it is given, not a constant', () => {
    const stats = fitDescriptorStats(makeTrainingSet(['luna', 'mia'], 6));

    expect(stats.count).toBe(12);
    expect(stats.mean).toHaveLength(IDENTITY_DESCRIPTORS.length);
    // Two cats 120 ms and 60 Hz apart: both descriptors have to vary.
    expect(stats.deviation[0] ?? 0).toBeGreaterThan(0.01);
    expect(stats.deviation[1] ?? 0).toBeGreaterThan(0.5);
  });

  it('makes a descriptor that never varies inert rather than infinite', () => {
    // Every fixture has two syllables, so its deviation is zero. Dividing by
    // it would give Infinity for every event and the vector would be nothing
    // but that one axis.
    const stats = fitDescriptorStats(makeTrainingSet(['luna', 'mia'], 6));
    const vector = identityVector(makeIdentityFeatures({ voice: 0 }), stats);

    expect(vector.every((value) => Number.isFinite(value))).toBe(true);
    expect(vector.at(-1)).toBe(0);
  });

  it('returns a usable scaling for an empty set', () => {
    const stats = fitDescriptorStats([]);
    expect(stats.count).toBe(0);
    const vector = identityVector(makeIdentityFeatures({ voice: 0 }), stats);
    expect(vector.every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe('identityVector', () => {
  const examples = makeTrainingSet(['luna', 'mia'], 8);
  const stats = fitDescriptorStats(examples);

  it('is both poolings plus the descriptors', () => {
    const features = makeIdentityFeatures({ voice: 0 });
    const vector = identityVector(features, stats);
    expect(vector).toHaveLength(features.embeddingMean.length * 2 + IDENTITY_DESCRIPTORS.length);
  });

  it('gives the embedding exactly the share spec 6.4 asks for', () => {
    const vector = identityVector(makeIdentityFeatures({ voice: 0 }), stats);
    const dimensions = 64;
    const meanBlock = vector.slice(0, dimensions);
    const maxBlock = vector.slice(dimensions, dimensions * 2);

    // 0.7 over the two poolings, split evenly between them.
    expect(norm([...meanBlock, ...maxBlock])).toBeCloseTo(IDENTITY_FEATURES.embedding, 5);
    expect(norm(meanBlock)).toBeCloseTo(norm(maxBlock), 5);
  });

  it('keeps the descriptors near their share instead of dominating', () => {
    // Standardized descriptors have unit variance, so the block's length
    // varies per event; what must hold is that a typical event lands near
    // 0.3 and an extreme one cannot run away with the vote.
    const lengths = makeTrainingSet(['luna', 'mia'], 8).map((example) =>
      norm(identityVector(example, stats).slice(128)),
    );
    const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;

    expect(average).toBeGreaterThan(IDENTITY_FEATURES.descriptors * 0.5);
    expect(average).toBeLessThan(IDENTITY_FEATURES.descriptors * 1.5);
  });

  it('clips an outlier instead of letting it decide the vote', () => {
    // A three-second yowl among half-second meows is about eight deviations
    // out. Unclipped, its duration axis alone would be longer than the whole
    // embedding block.
    const yowl = makeIdentityFeatures({ voice: 0, descriptors: { durationMs: 3000 } });
    const descriptors = identityVector(yowl, stats).slice(128);

    expect(norm(descriptors)).toBeLessThan(IDENTITY_FEATURES.embedding);
    const perAxis = IDENTITY_FEATURES.descriptors / Math.sqrt(IDENTITY_DESCRIPTORS.length);
    expect(Math.abs(descriptors[0] ?? 0)).toBeCloseTo(perAxis * 3, 5);
  });
});

describe('trainIdentity', () => {
  it('counts the confirmed examples per cat', () => {
    const model = trainIdentity(makeTrainingSet(['luna', 'mia'], 7));
    expect(model.countsByCat).toEqual({ luna: 7, mia: 7 });
    expect(model.examples).toHaveLength(14);
  });

  it('self-tests with the folds and k spec 6.4 names', () => {
    const model = trainIdentity(makeTrainingSet(['luna', 'mia'], 10));
    expect(model.report.folds).toBe(IDENTITY_GATE.selfTestFolds);
    expect(model.k).toBe(IDENTITY_FEATURES.neighbours);
    expect(model.report.accuracy).toBeGreaterThan(IDENTITY_GATE.minSelfTestAccuracy);
  });

  it('reports a poor self-test rather than hiding it', () => {
    // Two cats taught as one voice: the honest answer is a number near
    // chance, and it has to come back as one.
    const model = trainIdentity(makeIndistinguishableSet(['luna', 'mia'], 10));
    expect(model.report.accuracy).toBeLessThan(IDENTITY_GATE.minSelfTestAccuracy);
    expect(model.report.labels.map((label) => label.label).sort()).toEqual(['luna', 'mia']);
  });
});

describe('predictIdentity', () => {
  const model = trainIdentity(makeTrainingSet(['luna', 'mia', 'nube'], 10));

  it('names the cat whose voice it matches, with its neighbours', () => {
    const guess = predictIdentity(model, makeIdentityFeatures({ voice: 1, example: 99 }));

    expect(guess?.catId).toBe('mia');
    expect(guess?.confidence).toBeGreaterThan(CONFIDENCE.notSureBelow);
    expect(guess?.notSure).toBe(false);
    // Every prediction can point at the stored examples behind it: nothing in
    // Meowlogue is allowed to be a number with no provenance.
    expect(guess?.neighbours).toHaveLength(IDENTITY_FEATURES.neighbours);
    expect(guess?.neighbours[0]?.id).toContain('mia');
  });

  it('says it is not sure when both cats claim the same call', () => {
    // One voice, ten examples, confirmed alternately as Luna and as Mia: a
    // household where the person cannot tell them apart either. The five
    // nearest neighbours then split three to two, and spec 6.4 requires "not
    // sure" rather than the coin flip that three votes out of five would be.
    const guess = predictIdentity(
      trainIdentity(makeIndistinguishableSet(['luna', 'mia'], 5)),
      makeIdentityFeatures({ voice: 0, example: 99 }),
    );

    expect(guess?.voteShare).toBeGreaterThan(0.5);
    expect(guess?.confidence).toBeLessThan(CONFIDENCE.notSureBelow);
    expect(guess?.notSure).toBe(true);
  });

  it('does not ask again when the vote is unanimous', () => {
    // The active learning band of spec 6.4 is for the events whose answer
    // teaches the most. A call every neighbour agrees about is not one of
    // them, and highlighting it would train the user to ignore highlights.
    const guess = predictIdentity(model, makeIdentityFeatures({ voice: 2, example: 99 }));

    expect(guess?.confidence).toBeGreaterThan(CONFIDENCE.activeLearningRange.high);
    expect(guess?.askAgain).toBe(false);
  });

  it('has nothing to say before anything is confirmed', () => {
    expect(predictIdentity(trainIdentity([]), makeIdentityFeatures({ voice: 0 }))).toBeNull();
  });
});

describe('identityReadiness', () => {
  it('is not a question at all with fewer than two cats', () => {
    const model = trainIdentity(makeTrainingSet(['luna'], 20));
    expect(identityReadiness(model, ['luna'])).toEqual({ kind: 'needs-cats' });
    expect(identityReadiness(model, [])).toEqual({ kind: 'needs-cats' });
  });

  it('says how many examples each cat still needs', () => {
    const model = trainIdentity([...makeTrainingSet(['luna'], 10), ...makeTrainingSet(['mia'], 4)]);
    const readiness = identityReadiness(model, ['luna', 'mia']);

    expect(readiness).toEqual({
      kind: 'needs-examples',
      missingByCat: { mia: IDENTITY_GATE.minExamplesPerCat - 4 },
    });
  });

  it('counts a cat it has never heard as needing all of them', () => {
    // The cat with no examples is precisely the one a guess would get wrong,
    // so an unheard cat holds identity back for the whole household.
    const model = trainIdentity(makeTrainingSet(['luna', 'mia'], 12));
    const readiness = identityReadiness(model, ['luna', 'mia', 'nube']);

    expect(readiness).toEqual({
      kind: 'needs-examples',
      missingByCat: { nube: IDENTITY_GATE.minExamplesPerCat },
    });
  });

  it('holds identity back when the self-test is below the threshold', () => {
    const model = trainIdentity(makeIndistinguishableSet(['luna', 'mia'], 12));
    const readiness = identityReadiness(model, ['luna', 'mia']);

    expect(readiness.kind).toBe('needs-accuracy');
    expect(readiness.kind === 'needs-accuracy' && readiness.accuracy).toBeLessThan(
      IDENTITY_GATE.minSelfTestAccuracy,
    );
  });

  it('activates only with enough examples and enough accuracy', () => {
    const model = trainIdentity(makeTrainingSet(['luna', 'mia'], 12));
    const readiness = identityReadiness(model, ['luna', 'mia']);

    expect(readiness.kind).toBe('active');
    expect(readiness.kind === 'active' && readiness.accuracy).toBeGreaterThanOrEqual(
      IDENTITY_GATE.minSelfTestAccuracy,
    );
  });
});
