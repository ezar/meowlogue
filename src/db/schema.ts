import Dexie, { type EntityTable } from 'dexie';

/**
 * Local persistence.
 *
 * Everything Meowlogue knows lives here, on the device: there is no backend
 * and no account (spec section 2). The schema follows the data model in spec
 * section 7, and each store arrives with the screen that needs it.
 */

/** A cat in the household (spec section 7). */
export interface Cat {
  id: string;
  name: string;
  /** Accent colour id from `CAT_COLORS`. */
  color: string;
  /** Optional photo, stored as a blob so it never leaves the device. */
  photo?: Blob;
  /** Creation time as epoch milliseconds. */
  createdAt: number;
}

/**
 * A context label belonging to one cat (spec section 5.1).
 *
 * Labels are per cat, not per household, because a cat's calls are its own.
 */
export interface Label {
  id: string;
  catId: string;
  /**
   * Key into the i18n dictionaries for the nine defaults, or free text once
   * the user renames or adds one. `isCustom` says which.
   */
  name: string;
  /** True when the user typed this name, so it is shown verbatim. */
  isCustom: boolean;
  /** Display order within the cat's label set. */
  order: number;
}

/** The default label set every new cat starts with (spec section 5.1). */
export const DEFAULT_LABEL_KEYS: readonly string[] = [
  'label.food',
  'label.door',
  'label.attention',
  'label.greeting',
  'label.play',
  'label.complaint',
  'label.night',
  'label.litter',
  'label.other',
];

/**
 * A vocalization as it is kept on the device (spec sections 6.3 and 7).
 *
 * This is the app's memory. Until it existed every detection lived in the
 * debug page's React state and was gone the moment listening stopped, which
 * left the timeline, the insights, the vet summary and — worst — identity
 * training with nothing to read.
 *
 * The embeddings are stored as `Float32Array` rather than plain arrays:
 * IndexedDB keeps a typed array as its bytes, so a 1024-dimension vector is
 * 4 kB instead of the ~14 kB the same numbers cost as JSON. Two poolings per
 * event is 8 kB, which is what identity in spec 6.4 needs to learn from and
 * the reason the event is worth storing at all.
 */
export interface StoredEvent {
  id: string;
  /** Event start as epoch milliseconds (spec 6.6 buckets by hour of day). */
  startedAt: number;
  durationMs: number;
  /** Meowlogue's vocalization type. */
  type: string;
  /** The raw AudioSet label that triggered it, kept so nothing is hidden. */
  triggerLabel: string;
  /** Trigger class confidence, 0..1. */
  confidence: number;
  /** Amplitude lobes inside the event; a two-part call counts 2 (spec 6.2). */
  syllables: number;
  /** Peak level inside the event, in dBFS. */
  peakDbfs: number;
  /** A human voice was confident in the trigger window (spec 6.2). */
  possibleHuman: boolean;
  /** Median fundamental frequency, in Hz. */
  medianF0Hz: number;
  /** Contour slope, in semitones per second: rising, flat or falling. */
  contourSlopeSemitonesPerSecond: number;
  /** Fraction of frames with a voiced pitch, 0..1. */
  voicedFraction: number;
  /** Centre of mass of the spectrum, in Hz. */
  spectralCentroidHz: number;
  /** Mean pooled YAMNet embedding; absent when the embedder did not run. */
  embeddingMean?: Float32Array;
  /** Max pooled YAMNet embedding over the same windows. */
  embeddingMax?: Float32Array;
  /** How many windows were pooled; 1 means mean and max are the same vector. */
  embeddingWindows?: number;
  /** Log-mel thumbnail, band-major, with its shape. */
  melBands?: number;
  melFrames?: number;
  melData?: Float32Array;
  /** The cat the user confirmed, if any. Absent while unconfirmed. */
  catId?: string;
  /** The context label the user confirmed, if any. */
  labelId?: string;
  /** When the user confirmed the cat, epoch milliseconds. */
  confirmedAt?: number;
  /**
   * The user said this was not a cat.
   *
   * Kept rather than deleted: a false positive is training data for the guard
   * and for threshold tuning, and deleting it would throw away the only
   * examples of what the detector gets wrong in this particular room.
   */
  notACat?: boolean;
}

/**
 * A single stored preference.
 *
 * A key/value table rather than a row per setting: the Settings screen in spec
 * section 5.2 adds language, clip retention and more, and they have nothing in
 * common but being small and scalar.
 */
export interface Setting {
  key: string;
  value: string | number | boolean;
}

/** Keys used in the `settings` table. */
export const SETTING_KEYS = {
  /**
   * Epoch milliseconds when the user finished onboarding.
   *
   * Persisted rather than inferred from whether any cat exists: adding the
   * first cat must not end onboarding, or a two-cat household never gets to
   * add the second one — and spec 5.1 is built around two cats.
   */
  onboardingCompletedAt: 'onboardingCompletedAt',
} as const;

/** Minimum confirmed events per cat before identity is shown (spec 6.4). */
export const IDENTITY_MIN_EXAMPLES = 10;

/** The Dexie database. */
export class MeowlogueDatabase extends Dexie {
  cats!: EntityTable<Cat, 'id'>;
  labels!: EntityTable<Label, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  events!: EntityTable<StoredEvent, 'id'>;

  constructor(name = 'meowlogue') {
    super(name);
    this.version(1).stores({
      cats: 'id, name, createdAt',
      labels: 'id, catId, order',
      settings: 'key',
    });
    // Version 2 adds the events store. Dexie carries the existing stores
    // forward untouched, so a household set up before this upgrade keeps its
    // cats and labels.
    this.version(2).stores({
      events: 'id, startedAt, type, catId, labelId, confirmedAt, [catId+startedAt]',
    });
  }
}

export const db = new MeowlogueDatabase();
