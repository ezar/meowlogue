import { countsTowardsIdentity } from './events';
import { db, type StoredEvent } from './schema';
import type { IdentityExample, IdentityFeatures } from '@/engine';

/**
 * The bridge between what is on disk and what identity trains on (spec 6.4).
 *
 * A stored event is a row; an identity example is a labelled feature bundle.
 * The conversion is separate from both so the arithmetic in `src/engine` never
 * has to know about Dexie, and so the rules about which rows qualify can be
 * tested without a database.
 */

/**
 * The features identity reads from a stored event.
 *
 * @param event Any stored event, confirmed or not.
 * @returns The features, or null when the event has no embedding — a
 *   classifier-only session, or a one-cat household that skipped the 13 MB
 *   embedder. Without one there is nothing to compare voices with, and
 *   inventing a zero vector would make every such event look alike.
 */
export function identityFeaturesOf(event: StoredEvent): IdentityFeatures | null {
  const { embeddingMean, embeddingMax } = event;
  if (embeddingMean === undefined || embeddingMax === undefined) return null;
  return {
    embeddingMean: Array.from(embeddingMean),
    embeddingMax: Array.from(embeddingMax),
    durationMs: event.durationMs,
    medianF0Hz: event.medianF0Hz,
    contourSlopeSemitonesPerSecond: event.contourSlopeSemitonesPerSecond,
    voicedFraction: event.voicedFraction,
    syllables: event.syllables,
  };
}

/**
 * One training example, when the event qualifies as one.
 *
 * @param event Any stored event.
 * @returns The example, or null when the user has not named a cat for it
 *   (spec 6.4 trains on confirmed events only) or it carries no embedding.
 */
export function toIdentityExample(event: StoredEvent): IdentityExample | null {
  if (!countsTowardsIdentity(event)) return null;
  const features = identityFeaturesOf(event);
  if (features === null || event.catId === undefined) return null;
  return { id: event.id, catId: event.catId, ...features };
}

/** Everything a training run needs, read in one pass. */
export interface TrainingSet {
  readonly examples: readonly IdentityExample[];
  /**
   * Every cat in the household, including those with no examples at all: an
   * unheard cat is exactly the one a guess would get wrong, so it has to hold
   * the gate closed (spec 6.4).
   */
  readonly catIds: readonly string[];
}

/** Reads the confirmed set and the household it belongs to. */
export async function readTrainingSet(): Promise<TrainingSet> {
  const [events, cats] = await Promise.all([db.events.toArray(), db.cats.toArray()]);
  const examples: IdentityExample[] = [];
  for (const event of events) {
    const example = toIdentityExample(event);
    if (example !== null) examples.push(example);
  }
  return { examples, catIds: cats.map((cat) => cat.id) };
}
