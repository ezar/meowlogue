import { describe, expect, it } from 'vitest';
import { countsTowardsIdentity, toStoredEvent } from '@/db/events';
import type { StoredEvent } from '@/db/schema';
import { makeEventEmbedding, makeMeowEvent } from './fixtures/events';

/**
 * What a detection becomes on disk (spec 6.3), and what counts as a training
 * example (spec 6.4). The Dexie writes around these are exercised end to end.
 */

describe('toStoredEvent', () => {
  it('keeps what the screens and the classifiers read', () => {
    const stored = toStoredEvent(makeMeowEvent());

    expect(stored.id).toBe('evt-1');
    expect(stored.type).toBe('meow');
    expect(stored.triggerLabel).toBe('Meow');
    expect(stored.durationMs).toBe(640);
    expect(stored.syllables).toBe(2);
    expect(stored.possibleHuman).toBe(false);
    // The four pitch descriptors of spec 6.3, not the whole contour.
    expect(stored.medianF0Hz).toBe(520);
    expect(typeof stored.contourSlopeSemitonesPerSecond).toBe('number');
    expect(typeof stored.voicedFraction).toBe('number');
  });

  it('stores both poolings as typed arrays', () => {
    // Typed arrays because IndexedDB keeps their bytes: 4 kB per 1024-vector
    // instead of the ~14 kB the same numbers cost as JSON.
    const stored = toStoredEvent(makeMeowEvent());

    expect(stored.embeddingMean).toBeInstanceOf(Float32Array);
    expect(stored.embeddingMax).toBeInstanceOf(Float32Array);
    expect(stored.embeddingMean).toHaveLength(1024);
    expect(stored.embeddingWindows).toBe(3);
  });

  it('copies the thumbnail rather than referencing it', () => {
    // The listener reuses the thumbnail's buffer for the next event, so a
    // reference would be whatever it holds by the time IndexedDB reads it.
    const event = makeMeowEvent();
    const stored = toStoredEvent(event);

    expect(stored.melData).not.toBe(event.melThumbnail?.data);
    expect(stored.melData).toEqual(event.melThumbnail?.data);
    expect(stored.melBands).toBe(64);
  });

  it('leaves the embedding keys out when there is none', () => {
    // Classifier-only is a real state: one cat in the household, or an
    // embedder that did not load. Absent, not zero-filled.
    const stored = toStoredEvent(makeMeowEvent({ embedding: null }));

    expect('embeddingMean' in stored).toBe(false);
    expect('embeddingWindows' in stored).toBe(false);
  });

  it('leaves the thumbnail keys out when there is none', () => {
    const stored = toStoredEvent(makeMeowEvent({ melThumbnail: null }));
    expect('melData' in stored).toBe(false);
  });

  it('carries a pooled embedding through unchanged', () => {
    const embedding = makeEventEmbedding({ mean: [1, 2], max: [3, 4], windows: 2 });
    const stored = toStoredEvent(makeMeowEvent({ embedding }));

    expect([...(stored.embeddingMean ?? [])]).toEqual([1, 2]);
    expect([...(stored.embeddingMax ?? [])]).toEqual([3, 4]);
  });
});

describe('countsTowardsIdentity', () => {
  const base: StoredEvent = toStoredEvent(makeMeowEvent());

  it('counts an event whose cat the user confirmed', () => {
    expect(countsTowardsIdentity({ ...base, catId: 'cat-1', confirmedAt: 1 })).toBe(true);
  });

  it('does not count an unconfirmed event', () => {
    expect(countsTowardsIdentity(base)).toBe(false);
    expect(countsTowardsIdentity({ ...base, catId: 'cat-1' })).toBe(false);
  });

  it('does not count a context without a cat', () => {
    // Knowing a call was about food says nothing about who made it.
    expect(countsTowardsIdentity({ ...base, labelId: 'label-1' })).toBe(false);
  });

  it('never counts something the user said was not a cat', () => {
    expect(countsTowardsIdentity({ ...base, catId: 'cat-1', confirmedAt: 1, notACat: true })).toBe(
      false,
    );
  });
});
