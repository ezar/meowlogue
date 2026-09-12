import type { EventDetectorConfig, VocalEvent } from 'earshot';
import type { DetectionThresholds, SegmentationOptions } from './config';
import type { EventEmbedding, MelThumbnail, MeowEvent, VocalizationType } from './types';

/**
 * Translation between earshot's vocabulary and Meowlogue's.
 *
 * Everything here is pure and unit-tested. It is the part of the seam most
 * likely to be wrong, because it is where two sets of assumptions meet: units
 * (seconds against milliseconds), naming (AudioSet labels against the app's
 * own types) and policy (one global trigger score against per-class
 * thresholds).
 */

/**
 * AudioSet classes that can open a detection (spec 6.1).
 *
 * The generic animal classes are included because YAMNet often reaches for
 * `Cat` or `Domestic animals, pets` on a real meow while scoring `Meow`
 * itself below threshold. Letting them trigger and then applying the
 * per-class policy below costs a little recall in exchange for not missing
 * calls outright.
 */
export const TRIGGER_CLASSES: readonly string[] = [
  'Meow',
  'Cat',
  'Purr',
  'Hiss',
  'Caterwaul',
  'Growling',
  'Animal',
  'Domestic animals, pets',
];

/** AudioSet class name to the type Meowlogue shows the user. */
const TYPE_BY_LABEL: Readonly<Record<string, VocalizationType>> = {
  Meow: 'meow',
  Purr: 'purr',
  Hiss: 'hiss',
  Caterwaul: 'yowl',
  Growling: 'growl',
};

/**
 * Maps a trigger label to a vocalization type.
 *
 * The generic classes (`Cat`, `Animal`, `Domestic animals, pets`) carry no
 * information about *what kind* of call it was, and the type set has no
 * "unknown" member, so they fall back to `meow` — the overwhelmingly common
 * case in a house with cats. The raw label and the full class list travel on
 * every {@link MeowEvent}, so this guess is never the only thing on record.
 *
 * @param label AudioSet class name as reported by the classifier.
 */
export function vocalizationTypeFor(label: string): VocalizationType {
  return TYPE_BY_LABEL[label] ?? 'meow';
}

/**
 * Per-class score threshold for a label (spec 6.2).
 *
 * @returns The threshold in the range 0..1 that this label must clear.
 */
export function thresholdFor(label: string, thresholds: DetectionThresholds): number {
  switch (label) {
    case 'Meow':
      return thresholds.meow;
    case 'Purr':
      return thresholds.purr;
    case 'Hiss':
      return thresholds.hiss;
    case 'Caterwaul':
      return thresholds.caterwaul;
    default:
      // Cat, Growling and the generic animal classes all sit on the Cat
      // threshold; the spec sets one value for them.
      return thresholds.cat;
  }
}

/**
 * Applies Meowlogue's per-class policy to an event earshot already emitted.
 *
 * earshot's detector takes a single `triggerScore` for every trigger class,
 * whereas spec 6.2 sets a different threshold per class. So the detector is
 * configured at the *lowest* of our thresholds — permissive on purpose — and
 * this function rejects what that let through. Keeping the policy here rather
 * than loosening the spec means the numbers in `config.ts` stay the ones the
 * spec names.
 *
 * @param event An event emitted by earshot's detector.
 * @param thresholds Meowlogue's per-class thresholds.
 */
export function passesClassPolicy(event: VocalEvent, thresholds: DetectionThresholds): boolean {
  return event.confidence >= thresholdFor(event.type, thresholds);
}

/**
 * The lowest threshold across all trigger classes.
 *
 * This is what earshot's detector is configured with, so that no event our
 * policy might accept is discarded before we see it.
 */
export function lowestTriggerScore(thresholds: DetectionThresholds): number {
  return Math.min(
    thresholds.meow,
    thresholds.cat,
    thresholds.purr,
    thresholds.hiss,
    thresholds.caterwaul,
  );
}

/**
 * Builds earshot's detector configuration from Meowlogue's policy.
 *
 * This is the only place milliseconds become seconds. Meowlogue keeps its
 * policy in milliseconds because that is how the spec states it and how the UI
 * reads; earshot's detector takes seconds.
 *
 * Purrs are deliberately *not* given their 60 s ceiling here: earshot applies
 * one `maxDurationSeconds` to every class, and raising it to 60 s would let a
 * minute of room noise become a single "meow". Purr time is measured
 * separately (spec 6.2), so the event cap stays at the meow ceiling.
 */
export function toDetectorConfig(
  segmentation: SegmentationOptions,
  thresholds: DetectionThresholds,
): EventDetectorConfig {
  return {
    triggerClasses: TRIGGER_CLASSES,
    triggerScore: lowestTriggerScore(thresholds),
    humanScore: thresholds.speechGuard,
    debounceSeconds: segmentation.debounceMs / 1000,
    minDurationSeconds: segmentation.minDurationMs / 1000,
    maxDurationSeconds: segmentation.maxDurationMs / 1000,
    segment: {
      hopMs: segmentation.envelopeHopMs,
      openDb: segmentation.onsetAboveNoiseFloorDb,
      // earshot closes a segment by level hysteresis, so the close threshold
      // has to sit below the open one. The spec fixes the onset at noise floor
      // + 6 dB but says nothing about the close level; earshot's own defaults
      // use half the open value (12 dB open, 6 dB close), so that ratio is
      // carried over rather than a number invented here.
      closeDb: segmentation.onsetAboveNoiseFloorDb / 2,
      minDurationSeconds: segmentation.minDurationMs / 1000,
      maxDurationSeconds: segmentation.maxDurationMs / 1000,
      bridgeGapSeconds: segmentation.mergeGapMs / 1000,
    },
  };
}

/**
 * Converts an earshot event into Meowlogue's own.
 *
 * @param event The event as earshot emitted it.
 * @param captureStartedAtEpochMs Wall-clock time capture began, epoch ms.
 *   earshot times events from the start of capture, which says nothing about
 *   hour of day; the insights in spec 6.6 need the real clock.
 * @param melThumbnail Thumbnail stacked from the covering windows, or null.
 * @param embedding Pooled embedding of the covering windows, or null when
 *   earshot is running classifier-only.
 */
export function toMeowEvent(
  event: VocalEvent,
  captureStartedAtEpochMs: number,
  melThumbnail: MelThumbnail | null,
  embedding: EventEmbedding | null,
): MeowEvent {
  return {
    id: `${captureStartedAtEpochMs}-${event.start.toFixed(3)}`,
    startedAt: captureStartedAtEpochMs + Math.round(event.start * 1000),
    durationMs: Math.round(event.duration * 1000),
    type: vocalizationTypeFor(event.type),
    triggerLabel: event.type,
    confidence: event.confidence,
    classes: event.classes,
    pitch: event.pitch,
    features: event.features,
    syllables: event.syllables,
    peakDbfs: event.peakDbfs,
    possibleHuman: event.possibleHuman,
    melThumbnail,
    embedding,
  };
}
