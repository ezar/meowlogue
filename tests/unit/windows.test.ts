import { describe, expect, it } from 'vitest';
import { poolEmbedding, windowsCovering } from '@/engine';
import { makeWindow } from './fixtures/events';

/**
 * Window selection and embedding pooling (spec 6.3).
 *
 * Windows are 0.975 s long at a 0.4875 s hop, so `makeWindow(t)` covers
 * `[t, t + 0.975)`.
 */

describe('windowsCovering', () => {
  it('takes every window that overlaps the event', () => {
    const windows = [makeWindow(0), makeWindow(0.4875), makeWindow(0.975), makeWindow(1.4625)];
    const covering = windowsCovering(windows, 0.5, 1.2);
    expect(covering.map((window) => window.t)).toEqual([0, 0.4875, 0.975]);
  });

  it('counts overlap, not containment, so a short event still matches', () => {
    // 120 ms is the shortest event the policy allows: far shorter than a
    // window, and contained by it rather than containing it.
    expect(windowsCovering([makeWindow(0)], 0.4, 0.52)).toHaveLength(1);
  });

  it('excludes windows that only touch the event boundaries', () => {
    // A window ending exactly at the start, or starting exactly at the end,
    // shares no audio with the event.
    expect(windowsCovering([makeWindow(0)], 0.975, 1.5)).toHaveLength(0);
    expect(windowsCovering([makeWindow(1)], 0.5, 1)).toHaveLength(0);
  });

  it('returns nothing when the history does not reach the event', () => {
    expect(windowsCovering([makeWindow(0)], 10, 11)).toHaveLength(0);
    expect(windowsCovering([], 0, 1)).toHaveLength(0);
  });
});

describe('poolEmbedding', () => {
  it('averages and maximises element-wise over the covering windows', () => {
    const windows = [
      makeWindow(0, { embedding: [1, 10, 0] }),
      makeWindow(0.4875, { embedding: [3, 2, 0] }),
      // Outside the event: must not reach either pooling.
      makeWindow(30, { embedding: [100, 100, 100] }),
    ];
    const pooled = poolEmbedding(windows, 0.5, 1.2);
    expect(pooled).not.toBeNull();
    expect(pooled?.mean).toEqual([2, 6, 0]);
    expect(pooled?.max).toEqual([3, 10, 0]);
    expect(pooled?.windows).toBe(2);
  });

  it('keeps negative dimensions instead of flooring them at zero', () => {
    // YAMNet's embedding is a dense layer's output and is freely negative. A
    // max seeded at zero would report 0 for every negative dimension, which
    // is the bug this asserts against.
    const windows = [
      makeWindow(0, { embedding: [-4, -1] }),
      makeWindow(0.4875, { embedding: [-2, -3] }),
    ];
    const pooled = poolEmbedding(windows, 0, 1);
    expect(pooled?.max).toEqual([-2, -1]);
    expect(pooled?.mean).toEqual([-3, -2]);
  });

  it('reports one window when a single window covers the event', () => {
    // Mean and max are then the same vector, and identity should be able to
    // tell that the event rests on one look rather than several.
    const pooled = poolEmbedding([makeWindow(0, { embedding: [0.5, -0.5] })], 0.4, 0.52);
    expect(pooled?.windows).toBe(1);
    expect(pooled?.mean).toEqual(pooled?.max);
  });

  it('is null when the embedder did not load', () => {
    // earshot falls back to classifier-only and reports empty embeddings;
    // spec 2 says a missing capability says so rather than faking a vector.
    const windows = [makeWindow(0, { embedding: [] }), makeWindow(0.4875, { embedding: [] })];
    expect(poolEmbedding(windows, 0, 1)).toBeNull();
  });

  it('is null when no window covers the event', () => {
    expect(poolEmbedding([makeWindow(0)], 10, 11)).toBeNull();
  });

  it('ignores a window whose embedding has a different dimension', () => {
    const windows = [
      makeWindow(0, { embedding: [2, 4] }),
      makeWindow(0.4875, { embedding: [1, 2, 3] }),
    ];
    const pooled = poolEmbedding(windows, 0, 1);
    expect(pooled?.mean).toEqual([2, 4]);
    expect(pooled?.windows).toBe(1);
  });

  it('pools the full 1024 dimensions of a real embedding', () => {
    const pooled = poolEmbedding([makeWindow(0), makeWindow(0.4875)], 0, 1);
    expect(pooled?.mean).toHaveLength(1024);
    expect(pooled?.max).toHaveLength(1024);
  });
});
