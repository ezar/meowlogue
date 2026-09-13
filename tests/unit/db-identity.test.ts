import { describe, expect, it } from 'vitest';
import { identityFeaturesOf, toIdentityExample } from '@/db/identity';
import { toStoredEvent } from '@/db/events';
import { makeEventEmbedding, makeMeowEvent } from './fixtures/events';

/**
 * What identity is allowed to learn from (spec 6.4).
 *
 * The rules are all about refusing data rather than accepting it, which is why
 * they are worth testing: every one of them is a way the classifier could be
 * quietly poisoned — by an unconfirmed event, by a false positive, or by a
 * zero vector standing in for an embedding that was never computed.
 */

const confirmed = { catId: 'cat-1', confirmedAt: Date.UTC(2026, 8, 11, 7, 11, 0) };

describe('identityFeaturesOf', () => {
  it('reads both poolings back as plain numbers', () => {
    const stored = toStoredEvent(
      makeMeowEvent({ embedding: makeEventEmbedding({ mean: [0.5, 0.25], max: [1, 0.5] }) }),
    );
    const features = identityFeaturesOf(stored);

    // Float32Array on disk, arrays in the classifier: earshot's kNN takes
    // ArrayLike, but the vectors are concatenated and scaled on the way in,
    // and doing that in float32 would round twice for nothing.
    expect(features?.embeddingMean).toEqual([0.5, 0.25]);
    expect(features?.embeddingMax).toEqual([1, 0.5]);
    expect(features?.durationMs).toBe(640);
    expect(features?.medianF0Hz).toBe(520);
    expect(features?.syllables).toBe(2);
  });

  it('has nothing to offer for an event with no embedding', () => {
    // Classifier-only: a one-cat household that skipped the 13 MB embedder,
    // or a session where it failed to load. A zero vector here would make
    // every such event look identical and identical to each other.
    const stored = toStoredEvent(makeMeowEvent({ embedding: null }));
    expect(identityFeaturesOf(stored)).toBeNull();
  });
});

describe('toIdentityExample', () => {
  it('takes a confirmed event with an embedding', () => {
    const stored = { ...toStoredEvent(makeMeowEvent()), ...confirmed };
    const example = toIdentityExample(stored);

    expect(example?.id).toBe('evt-1');
    expect(example?.catId).toBe('cat-1');
    expect(example?.embeddingMean).toHaveLength(1024);
  });

  it('refuses an event nobody confirmed', () => {
    expect(toIdentityExample(toStoredEvent(makeMeowEvent()))).toBeNull();
    // A cat with no confirmation time is a guess the app wrote itself, not an
    // answer a person gave.
    expect(toIdentityExample({ ...toStoredEvent(makeMeowEvent()), catId: 'cat-1' })).toBeNull();
  });

  it('refuses a false positive however it is labelled', () => {
    const stored = { ...toStoredEvent(makeMeowEvent()), ...confirmed, notACat: true };
    expect(toIdentityExample(stored)).toBeNull();
  });

  it('refuses a confirmed event that has no embedding to learn from', () => {
    const stored = { ...toStoredEvent(makeMeowEvent({ embedding: null })), ...confirmed };
    expect(toIdentityExample(stored)).toBeNull();
  });
});
