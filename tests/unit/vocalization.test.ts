import { HOP_SECONDS, SAMPLE_RATE_HZ, WINDOW_SECONDS } from 'earshot';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE,
  SEGMENTATION,
  THRESHOLDS,
  TRIGGER_CLASSES,
  lowestTriggerScore,
  passesClassPolicy,
  thresholdFor,
  toDetectorConfig,
  toMeowEvent,
  vocalizationTypeFor,
} from '@/engine';
import { makeMelThumbnail, makeVocalEvent } from './fixtures/events';

/**
 * The translation layer is the part of the seam most likely to be wrong: it is
 * where earshot's units and naming meet Meowlogue's. Every assertion here
 * exists because the two differ somewhere.
 */

describe('capture framing', () => {
  it('matches the values earshot actually uses (spec 6.1)', () => {
    // Meowlogue states the framing in ms because that is how the spec and the
    // UI read it; earshot works in seconds. If either side ever moves, this
    // fails rather than silently mis-framing every window.
    expect(CAPTURE.sampleRateHz).toBe(SAMPLE_RATE_HZ);
    expect(CAPTURE.windowMs / 1000).toBeCloseTo(WINDOW_SECONDS, 6);
    expect(CAPTURE.hopMs / 1000).toBeCloseTo(HOP_SECONDS, 6);
  });
});

describe('vocalizationTypeFor', () => {
  it("maps the specific AudioSet classes onto the app's types", () => {
    expect(vocalizationTypeFor('Meow')).toBe('meow');
    expect(vocalizationTypeFor('Purr')).toBe('purr');
    expect(vocalizationTypeFor('Hiss')).toBe('hiss');
    expect(vocalizationTypeFor('Caterwaul')).toBe('yowl');
    expect(vocalizationTypeFor('Growling')).toBe('growl');
  });

  it('falls back to meow for the generic animal classes', () => {
    expect(vocalizationTypeFor('Cat')).toBe('meow');
    expect(vocalizationTypeFor('Animal')).toBe('meow');
    expect(vocalizationTypeFor('Domestic animals, pets')).toBe('meow');
  });

  it('does not throw on a class it has never seen', () => {
    expect(vocalizationTypeFor('Vacuum cleaner')).toBe('meow');
  });

  it('has a mapping or a fallback for every trigger class', () => {
    for (const label of TRIGGER_CLASSES) {
      expect(typeof vocalizationTypeFor(label)).toBe('string');
    }
  });
});

describe('per-class threshold policy', () => {
  it('gives each class the threshold the spec names', () => {
    expect(thresholdFor('Meow', THRESHOLDS)).toBe(0.3);
    expect(thresholdFor('Purr', THRESHOLDS)).toBe(0.25);
    expect(thresholdFor('Hiss', THRESHOLDS)).toBe(0.4);
    expect(thresholdFor('Caterwaul', THRESHOLDS)).toBe(0.4);
    expect(thresholdFor('Cat', THRESHOLDS)).toBe(0.3);
  });

  it('configures the detector at the lowest threshold so nothing is lost early', () => {
    // earshot takes one trigger score for every class. Setting it above any of
    // our per-class thresholds would discard events before the policy runs.
    const lowest = lowestTriggerScore(THRESHOLDS);
    expect(lowest).toBe(0.25);
    for (const label of TRIGGER_CLASSES) {
      expect(thresholdFor(label, THRESHOLDS)).toBeGreaterThanOrEqual(lowest);
    }
  });

  it('accepts a hiss only once it clears the hiss threshold, not the purr one', () => {
    const weakHiss = makeVocalEvent({ type: 'Hiss', confidence: 0.3 });
    const strongHiss = makeVocalEvent({ type: 'Hiss', confidence: 0.45 });

    // 0.3 passes earshot's 0.25 trigger but must not pass our 0.4 for hiss.
    expect(passesClassPolicy(weakHiss, THRESHOLDS)).toBe(false);
    expect(passesClassPolicy(strongHiss, THRESHOLDS)).toBe(true);
  });

  it('accepts a quiet purr that a single global threshold would reject', () => {
    const purr = makeVocalEvent({ type: 'Purr', confidence: 0.26 });
    expect(passesClassPolicy(purr, THRESHOLDS)).toBe(true);
  });

  it('treats the threshold as inclusive', () => {
    expect(passesClassPolicy(makeVocalEvent({ type: 'Meow', confidence: 0.3 }), THRESHOLDS)).toBe(
      true,
    );
  });
});

describe('toDetectorConfig', () => {
  const config = toDetectorConfig(SEGMENTATION, THRESHOLDS);

  it('converts every duration from milliseconds to seconds', () => {
    expect(config.debounceSeconds).toBeCloseTo(0.5, 6);
    expect(config.minDurationSeconds).toBeCloseTo(0.12, 6);
    expect(config.maxDurationSeconds).toBeCloseTo(4, 6);
    expect(config.segment?.bridgeGapSeconds).toBeCloseTo(0.25, 6);
  });

  it('keeps the envelope hop in milliseconds, which is what earshot wants there', () => {
    // A deliberate asymmetry in earshot's own API: hopMs is ms, everything
    // else in SegmentOptions is seconds.
    expect(config.segment?.hopMs).toBe(SEGMENTATION.envelopeHopMs);
  });

  it('opens the segment at the spec threshold and closes below it', () => {
    expect(config.segment?.openDb).toBe(6);
    // Hysteresis: closing must be easier than opening, or a segment can never
    // end. earshot has no timed release, so this is the only lever.
    expect(config.segment?.closeDb).toBeLessThan(config.segment?.openDb ?? 0);
  });

  it('does not raise the duration cap to the purr ceiling', () => {
    // One cap applies to all classes, so 60 s would let a minute of room noise
    // become a single event.
    expect(config.maxDurationSeconds).toBeLessThan(SEGMENTATION.maxPurrDurationMs / 1000);
  });

  it('passes the speech guard through as the human score', () => {
    expect(config.humanScore).toBe(THRESHOLDS.speechGuard);
  });

  it('requires at least one trigger class, as earshot demands', () => {
    expect(config.triggerClasses.length).toBeGreaterThan(0);
  });
});

describe('toMeowEvent', () => {
  const captureStartedAt = Date.UTC(2026, 8, 11, 7, 0, 0);

  it('turns seconds since capture into a real wall clock', () => {
    // This is the conversion the insights in spec 6.6 depend on: an event at
    // 1.5 s into a capture that began at 07:00:00 happened at 07:00:01.500.
    const event = toMeowEvent(makeVocalEvent(), captureStartedAt, null, []);

    expect(event.startedAt).toBe(captureStartedAt + 1500);
    expect(new Date(event.startedAt).toISOString()).toBe('2026-09-11T07:00:01.500Z');
    expect(event.durationMs).toBe(640);
  });

  it('keeps the raw trigger label alongside the mapped type', () => {
    const event = toMeowEvent(makeVocalEvent({ type: 'Cat' }), captureStartedAt, null, []);

    expect(event.type).toBe('meow');
    expect(event.triggerLabel).toBe('Cat');
  });

  it('carries the thumbnail and embedding it is given', () => {
    const thumbnail = makeMelThumbnail(64, 3);
    const event = toMeowEvent(makeVocalEvent(), captureStartedAt, thumbnail, [0.5, 0.25]);

    expect(event.melThumbnail).toBe(thumbnail);
    expect(event.embedding).toEqual([0.5, 0.25]);
  });

  it('preserves the possible-human flag rather than dropping the event', () => {
    const event = toMeowEvent(makeVocalEvent({ possibleHuman: true }), captureStartedAt, null, []);
    expect(event.possibleHuman).toBe(true);
  });

  it('gives concurrent captures distinguishable ids', () => {
    const a = toMeowEvent(makeVocalEvent({ start: 1.5 }), captureStartedAt, null, []);
    const b = toMeowEvent(makeVocalEvent({ start: 1.5 }), captureStartedAt + 1, null, []);
    const c = toMeowEvent(makeVocalEvent({ start: 2.5 }), captureStartedAt, null, []);

    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });
});
