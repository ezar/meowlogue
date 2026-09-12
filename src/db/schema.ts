import Dexie, { type EntityTable } from 'dexie';

/**
 * Local persistence.
 *
 * Everything Meowlogue knows lives here, on the device: there is no backend
 * and no account (spec section 2). The schema follows the data model in spec
 * section 7; this milestone creates the `cats` and `labels` stores, and the
 * rest arrive with the screens that need them.
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

/** The Dexie database. */
export class MeowlogueDatabase extends Dexie {
  cats!: EntityTable<Cat, 'id'>;
  labels!: EntityTable<Label, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'meowlogue') {
    super(name);
    this.version(1).stores({
      cats: 'id, name, createdAt',
      labels: 'id, catId, order',
      settings: 'key',
    });
  }
}

export const db = new MeowlogueDatabase();
