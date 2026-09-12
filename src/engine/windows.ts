import { WINDOW_SECONDS } from 'earshot';
import type { EventEmbedding, WindowResult } from './types';

/**
 * Selects the analysis windows that overlap an event.
 *
 * Shared by everything that summarises an event out of the window history —
 * the log-mel thumbnail and the pooled embedding — so the two can never
 * disagree about which windows an event was made of.
 *
 * @param windows Recent windows, oldest first, each timed in seconds since
 *   capture started.
 * @param startSeconds Event start, in seconds since capture started.
 * @param endSeconds Event end, in seconds since capture started.
 * @returns The overlapping windows, oldest first; empty when none overlap.
 */
export function windowsCovering(
  windows: readonly WindowResult[],
  startSeconds: number,
  endSeconds: number,
): readonly WindowResult[] {
  return windows.filter((window) => {
    const windowEnd = window.t + WINDOW_SECONDS;
    // Overlap, not containment: an event shorter than a window would match
    // nothing under a containment test.
    return windowEnd > startSeconds && window.t < endSeconds;
  });
}

/**
 * Pools the YAMNet embeddings of an event's windows, mean and max (spec 6.3).
 *
 * Spec section 6.3 asks for both poolings, 1024 values each, and section 6.4
 * feeds them to identity. They answer different questions: the mean describes
 * the call as a whole, while the max keeps whatever was loudest in any single
 * window — which is what survives when a two-part call has one strong syllable
 * and one weak one.
 *
 * Max pooling starts from negative infinity, not zero. YAMNet's embedding is
 * the output of a dense layer and its values are freely negative; seeding the
 * running maximum at zero would silently floor every negative dimension and
 * hand identity a vector of mostly zeros.
 *
 * @param windows Recent windows, oldest first, each timed in seconds since
 *   capture started.
 * @param startSeconds Event start, in seconds since capture started.
 * @param endSeconds Event end, in seconds since capture started.
 * @returns The pooled embedding, or null when no covering window carries one —
 *   which is the normal case when earshot runs classifier-only because the
 *   embedder did not load.
 */
export function poolEmbedding(
  windows: readonly WindowResult[],
  startSeconds: number,
  endSeconds: number,
): EventEmbedding | null {
  const covering = windowsCovering(windows, startSeconds, endSeconds);
  const embeddings = covering
    .map((window) => window.embedding)
    .filter((embedding) => embedding.length > 0);
  const dimensions = embeddings[0]?.length ?? 0;
  if (dimensions === 0) return null;

  const sum = new Float64Array(dimensions);
  const max = new Float64Array(dimensions).fill(Number.NEGATIVE_INFINITY);
  let pooled = 0;

  for (const embedding of embeddings) {
    // A window of a different dimension cannot be pooled with the rest, and
    // averaging over a partial vector would be worse than leaving it out.
    if (embedding.length !== dimensions) continue;
    pooled += 1;
    for (let i = 0; i < dimensions; i += 1) {
      const value = embedding[i] ?? 0;
      sum[i] = (sum[i] ?? 0) + value;
      if (value > (max[i] ?? Number.NEGATIVE_INFINITY)) max[i] = value;
    }
  }
  if (pooled === 0) return null;

  return {
    mean: Array.from(sum, (total) => total / pooled),
    max: Array.from(max),
    // Kept because it changes how much the vector is worth: over one window
    // mean and max are the same vector, and identity should know that the
    // event rests on a single 0.975 s look rather than several.
    windows: pooled,
  };
}
