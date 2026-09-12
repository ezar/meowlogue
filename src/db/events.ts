import type { MeowEvent } from '@/engine';
import { db, type StoredEvent } from './schema';

/**
 * Reading and writing vocalizations.
 *
 * The pure half — what a detection becomes on disk, and what counts as
 * confirmed — is exported separately from the Dexie writes so it can be tested
 * without a database.
 */

/**
 * Flattens a detection into a stored row.
 *
 * Deliberately lossy, and the losses are listed rather than left to be
 * discovered:
 *
 * - **The full class score list is dropped**, keeping only the trigger and its
 *   confidence. The rest is tens of labels per event and nothing in spec 5 or
 *   6 reads them back; the debug page's JSON export is where they belong.
 * - **The pitch track is reduced to its four descriptors** from spec 6.3.
 *   Storing every frame would be the largest field on the row and the
 *   classifiers take the descriptors, not the contour.
 * - **The embeddings are kept in full**, because spec 6.4 trains on them.
 *
 * @param event The detection as the listener emitted it.
 * @returns The row to put in the `events` store.
 */
export function toStoredEvent(event: MeowEvent): StoredEvent {
  const { pitch, features, melThumbnail, embedding } = event;
  return {
    id: event.id,
    startedAt: event.startedAt,
    durationMs: event.durationMs,
    type: event.type,
    triggerLabel: event.triggerLabel,
    confidence: event.confidence,
    syllables: event.syllables,
    peakDbfs: event.peakDbfs,
    possibleHuman: event.possibleHuman,
    medianF0Hz: pitch.medianF0Hz,
    contourSlopeSemitonesPerSecond: pitch.contourSlopeSemitonesPerSecond,
    voicedFraction: pitch.voicedFraction,
    spectralCentroidHz: features.spectralCentroidHz,
    ...(embedding === null
      ? {}
      : {
          embeddingMean: Float32Array.from(embedding.mean),
          embeddingMax: Float32Array.from(embedding.max),
          embeddingWindows: embedding.windows,
        }),
    ...(melThumbnail === null
      ? {}
      : {
          melBands: melThumbnail.bands,
          melFrames: melThumbnail.frames,
          // Copied rather than referenced: the thumbnail's buffer is reused by
          // the next event, and IndexedDB would otherwise store whatever it
          // holds at write time.
          melData: Float32Array.from(melThumbnail.data),
        }),
  };
}

/**
 * Whether an event counts towards a cat's training set (spec 6.4).
 *
 * Confirmed means a person said which cat it was. An event marked "not a cat"
 * never counts however it is labelled, and neither does one that only has a
 * context: knowing a call was about food says nothing about who made it.
 */
export function countsTowardsIdentity(event: StoredEvent): boolean {
  return event.notACat !== true && event.catId !== undefined && event.confirmedAt !== undefined;
}

/** Stores a detection. */
export async function recordEvent(event: MeowEvent): Promise<void> {
  await db.events.put(toStoredEvent(event));
}

/**
 * Records who the user says made this call.
 *
 * Confirming a cat clears any "not a cat" mark: the two answers contradict
 * each other, and the later one is the one the person meant.
 */
export async function confirmCat(eventId: string, catId: string): Promise<void> {
  await db.events.update(eventId, { catId, confirmedAt: Date.now(), notACat: false });
}

/** Records what the user says the call was about (spec 5.1). */
export async function confirmLabel(eventId: string, labelId: string): Promise<void> {
  await db.events.update(eventId, { labelId });
}

/**
 * Records that this was not a cat at all.
 *
 * The row stays: a false positive is the only evidence of what the detector
 * gets wrong in this particular room, and spec 6.7 tunes thresholds against
 * exactly that. Any cat and context already on it are cleared, because they
 * were answers to a question that turned out not to apply.
 */
export async function markNotACat(eventId: string): Promise<void> {
  const event = await db.events.get(eventId);
  if (event === undefined) return;
  // Read, strip, put — rather than updating the fields to `undefined`. Dexie's
  // update spec has no way to say "remove this key" that survives
  // `exactOptionalPropertyTypes`, and a row carrying `catId: undefined` is not
  // the same as one with no `catId`: the index would still hold an entry.
  const next: StoredEvent = { ...event, notACat: true };
  delete next.catId;
  delete next.labelId;
  delete next.confirmedAt;
  await db.events.put(next);
}

/** The most recent events, newest first. */
export async function recentEvents(limit = 50): Promise<StoredEvent[]> {
  return db.events.orderBy('startedAt').reverse().limit(limit).toArray();
}

/** How many confirmed examples each cat has, keyed by cat id (spec 6.4). */
export async function confirmedCountsByCat(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.events.each((event) => {
    if (!countsTowardsIdentity(event)) return;
    const catId = event.catId ?? '';
    counts[catId] = (counts[catId] ?? 0) + 1;
  });
  return counts;
}

/** Removes one event for good. */
export async function deleteEvent(eventId: string): Promise<void> {
  await db.events.delete(eventId);
}
