import { DEFAULT_LABEL_KEYS, SETTING_KEYS, db, type Cat, type Label } from './schema';
import { CAT_COLORS, DEFAULT_CAT_COLOR_ID } from '@/lib/cat-colors';

/**
 * Household operations.
 *
 * The pure decisions — validating a name, choosing the next colour, building
 * a cat's starting label set — are separate from the Dexie writes so they can
 * be unit-tested without a database.
 */

/** Why a proposed cat name was rejected. */
export type NameProblem = 'empty' | 'too-long' | 'duplicate';

/** Longest cat name accepted, in characters. */
export const MAX_NAME_LENGTH = 24;

/**
 * Validates a cat's name against the household.
 *
 * @param name The name as typed, before trimming.
 * @param existingNames Names already in the household.
 * @returns The problem, or null when the name is acceptable.
 */
export function validateCatName(
  name: string,
  existingNames: readonly string[],
): NameProblem | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > MAX_NAME_LENGTH) return 'too-long';
  // Case-insensitive: "Luna" and "luna" would be indistinguishable on a card.
  const folded = trimmed.toLocaleLowerCase();
  if (existingNames.some((existing) => existing.trim().toLocaleLowerCase() === folded)) {
    return 'duplicate';
  }
  return null;
}

/**
 * Picks the next accent colour for a new cat.
 *
 * Walks the palette in order and takes the first one nobody is using, so a
 * two-cat household never gets two cats the same colour by accident. Once all
 * eight are taken it wraps to the first, since the palette is a convenience
 * and not a limit on how many cats someone has.
 *
 * @param usedColorIds Colours already assigned in the household.
 */
export function nextCatColorId(usedColorIds: readonly string[]): string {
  const free = CAT_COLORS.find((color) => !usedColorIds.includes(color.id));
  return free?.id ?? DEFAULT_CAT_COLOR_ID;
}

/**
 * Builds the default label set for a cat (spec section 5.1).
 *
 * @param catId The cat these labels belong to.
 * @param makeId Injected id factory, so tests get deterministic ids.
 */
export function buildDefaultLabels(catId: string, makeId: () => string): Label[] {
  return DEFAULT_LABEL_KEYS.map((key, index) => ({
    id: makeId(),
    catId,
    name: key,
    isCustom: false,
    order: index,
  }));
}

/** Creates an id. Extracted so tests can replace it. */
function createId(): string {
  return globalThis.crypto.randomUUID();
}

/** A cat about to be persisted. */
export interface NewCat {
  readonly name: string;
  readonly color?: string;
  readonly photo?: Blob;
}

/**
 * Persists a cat and its default labels in one transaction.
 *
 * @returns The stored cat.
 * @throws When the name does not pass {@link validateCatName}.
 */
export async function addCat(candidate: NewCat): Promise<Cat> {
  const existing = await db.cats.toArray();
  const problem = validateCatName(
    candidate.name,
    existing.map((cat) => cat.name),
  );
  if (problem !== null) {
    throw new Error(`cannot add cat: name is ${problem}`);
  }

  const cat: Cat = {
    id: createId(),
    name: candidate.name.trim(),
    color: candidate.color ?? nextCatColorId(existing.map((entry) => entry.color)),
    createdAt: Date.now(),
    ...(candidate.photo === undefined ? {} : { photo: candidate.photo }),
  };

  await db.transaction('rw', db.cats, db.labels, async () => {
    await db.cats.add(cat);
    await db.labels.bulkAdd(buildDefaultLabels(cat.id, createId));
  });

  return cat;
}

/** Removes a cat and every label belonging to it. */
export async function removeCat(catId: string): Promise<void> {
  await db.transaction('rw', db.cats, db.labels, async () => {
    await db.cats.delete(catId);
    await db.labels.where('catId').equals(catId).delete();
  });
}

/** Every cat, oldest first. */
export async function listCats(): Promise<Cat[]> {
  return db.cats.orderBy('createdAt').toArray();
}

/**
 * Records that the user finished onboarding.
 *
 * Separate from "has at least one cat" on purpose: adding the first cat must
 * not end onboarding, or someone with two cats never gets to add the second.
 */
export async function markOnboardingComplete(at = Date.now()): Promise<void> {
  await db.settings.put({ key: SETTING_KEYS.onboardingCompletedAt, value: at });
}

/** Whether onboarding has been finished before. */
export async function isOnboardingComplete(): Promise<boolean> {
  const stored = await db.settings.get(SETTING_KEYS.onboardingCompletedAt);
  return stored !== undefined;
}

/**
 * Whether identity recognition is worth offering (spec section 5.1).
 *
 * One cat works with identity disabled: there is nobody to confuse it with,
 * so asking "who was that?" would be theatre.
 */
export function identityIsMeaningful(catCount: number): boolean {
  return catCount >= 2;
}
