import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared setup for the end-to-end specs.
 *
 * Both suites need a known starting household: the app decides between
 * onboarding and the rest of the app by a persisted flag, so a leftover
 * database from a previous test decides the wrong way.
 */

/** The database name in `src/db/schema.ts`. */
const DATABASE = 'meowlogue';

/**
 * Empties the household so the app shows onboarding.
 *
 * Deletes Meowlogue's own database by name rather than enumerating every
 * database in the origin: it is the one this app owns, and naming it says so.
 */
export async function clearHousehold(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    async (name: string) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        // Resolve on every outcome: a database that was never created, or one
        // still held open by the page, both leave nothing to clear.
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          resolve();
        };
        request.onblocked = () => {
          resolve();
        };
      }),
    DATABASE,
  );
  await page.reload();
}

/** Walks welcome and privacy, landing on the add-cats step. */
export async function reachCatsStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.getByRole('button', { name: 'Lo entiendo' }).click();
  await expect(page.getByRole('heading', { name: 'Añade a tus gatos' })).toBeVisible();
}

/** Adds one cat through the form and waits for it to appear. */
export async function addCat(page: Page, name: string): Promise<void> {
  await page.getByLabel('Nombre').fill(name);
  await page.getByRole('button', { name: 'Añadir gato' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
}

/**
 * Walks onboarding to the end, leaving the app on the next screen.
 *
 * Driven through the UI rather than by seeding IndexedDB directly: the schema
 * is Dexie's to own, and a hand-written record would drift from it silently.
 * The cost is a few seconds per test, which is worth paying to keep the setup
 * honest about what a real first run does.
 */
export async function completeOnboarding(
  page: Page,
  catNames: readonly string[] = ['Luna'],
): Promise<void> {
  await clearHousehold(page);
  await reachCatsStep(page);
  for (const name of catNames) await addCat(page, name);
  await page.getByRole('button', { name: 'Listo' }).click();
}

/**
 * Reads the stored cats straight out of IndexedDB.
 *
 * Deliberately the raw API rather than Dexie: this is a test asserting what
 * actually landed on disk, so it should not go through the same library the
 * app used to put it there.
 */
export async function readStoredCats(page: Page): Promise<
  readonly {
    readonly id: string;
    readonly name: string;
    readonly photoSize: number;
    readonly photoType: string;
  }[]
> {
  return page.evaluate(
    async (name: string) =>
      new Promise<readonly { id: string; name: string; photoSize: number; photoType: string }[]>(
        (resolve, reject) => {
          const open = indexedDB.open(name);
          open.onerror = () => {
            reject(new Error('could not open the database'));
          };
          open.onsuccess = () => {
            const database = open.result;
            const request = database.transaction('cats', 'readonly').objectStore('cats').getAll();
            request.onerror = () => {
              reject(new Error('could not read the cats'));
            };
            request.onsuccess = () => {
              const rows = request.result as { id: string; name: string; photo?: Blob }[];
              resolve(
                rows.map((row) => ({
                  id: row.id,
                  name: row.name,
                  photoSize: row.photo?.size ?? 0,
                  photoType: row.photo?.type ?? '',
                })),
              );
              database.close();
            };
          };
        },
      ),
    DATABASE,
  );
}

/**
 * Writes a detection straight into the events store.
 *
 * The engine cannot be made to produce a real meow here — Chromium's fake
 * device emits a tone, and YAMNet is right not to call it a cat — so the
 * screens that read events are exercised against seeded rows. The raw
 * IndexedDB API again, so the test does not depend on Dexie agreeing with
 * itself.
 */
export async function seedEvent(
  page: Page,
  event: { readonly id: string; readonly type: string; readonly startedAt: number },
): Promise<void> {
  await page.evaluate(
    async ([name, row]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => {
          reject(new Error('could not open the database'));
        };
        open.onsuccess = () => {
          const database = open.result;
          const store = database.transaction('events', 'readwrite').objectStore('events');
          const request = store.put(row);
          request.onerror = () => {
            reject(new Error('could not write the event'));
          };
          request.onsuccess = () => {
            database.close();
            resolve();
          };
        };
      }),
    [
      DATABASE,
      {
        ...event,
        durationMs: 640,
        triggerLabel: 'Meow',
        confidence: 0.72,
        syllables: 2,
        peakDbfs: -18.4,
        possibleHuman: false,
        medianF0Hz: 520,
        contourSlopeSemitonesPerSecond: 4,
        voicedFraction: 0.8,
        spectralCentroidHz: 1400,
      },
    ] as const,
  );
}

/** Reads the stored events back, newest first. */
export async function readStoredEvents(page: Page): Promise<
  readonly {
    readonly id: string;
    readonly catId?: string;
    readonly labelId?: string;
    readonly notACat?: boolean;
  }[]
> {
  return page.evaluate(
    async (name: string) =>
      new Promise<readonly { id: string; catId?: string; labelId?: string; notACat?: boolean }[]>(
        (resolve, reject) => {
          const open = indexedDB.open(name);
          open.onerror = () => {
            reject(new Error('could not open the database'));
          };
          open.onsuccess = () => {
            const database = open.result;
            const request = database
              .transaction('events', 'readonly')
              .objectStore('events')
              .getAll();
            request.onerror = () => {
              reject(new Error('could not read the events'));
            };
            request.onsuccess = () => {
              resolve(request.result as { id: string; catId?: string }[]);
              database.close();
            };
          };
        },
      ),
    DATABASE,
  );
}

/** One cat's confirmed voice, for {@link seedConfirmedVoices}. */
export interface SeededVoice {
  readonly catId: string;
  /**
   * Which synthetic voice this cat has. Two different indices are
   * distinguishable; the same index twice is a household of littermates the
   * classifier cannot possibly learn, which is the case the honesty gate of
   * spec 6.4 has to survive.
   */
  readonly voice: number;
}

/**
 * Seeds a trained household: confirmed events with embeddings, per cat.
 *
 * Identity cannot be reached through the UI in a test — it needs ten real
 * meows per cat — and it is the one feature whose whole point is what it
 * refuses to say before it has them. So the confirmed set is written directly,
 * with synthetic embeddings whose geometry is known: the same construction the
 * unit fixtures use, a unit direction per voice plus a deterministic wobble.
 *
 * @param page The page under test.
 * @param voices One entry per cat, naming its synthetic voice.
 * @param perCat Confirmed examples to write for each cat.
 */
export async function seedConfirmedVoices(
  page: Page,
  voices: readonly SeededVoice[],
  perCat: number,
): Promise<void> {
  await page.evaluate(
    async ([name, seeds, count]) =>
      new Promise<void>((resolve, reject) => {
        const dimensions = 1024;
        const hash = (a: number, b: number, c: number): number => {
          const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
          return (value - Math.floor(value)) * 2 - 1;
        };
        const embedding = (voice: number, example: number): Float32Array => {
          const raw = Array.from(
            { length: dimensions },
            (_, i) =>
              Math.cos((i + 1) * 0.21 * (voice + 1)) + 0.05 * hash(i + 1, example + 1, voice + 1),
          );
          return Float32Array.from(raw);
        };

        const open = indexedDB.open(name);
        open.onerror = () => {
          reject(new Error('could not open the database'));
        };
        open.onsuccess = () => {
          const database = open.result;
          const store = database.transaction('events', 'readwrite').objectStore('events');
          let index = 0;
          for (const seed of seeds) {
            for (let example = 0; example < count; example += 1) {
              index += 1;
              const mean = embedding(seed.voice, example);
              store.put({
                id: `seed-${seed.catId}-${example}`,
                startedAt: Date.UTC(2026, 8, 12, 8, 0, 0) + index * 60_000,
                durationMs: 500 + seed.voice * 120,
                type: 'meow',
                triggerLabel: 'Meow',
                confidence: 0.72,
                syllables: 2,
                peakDbfs: -18.4,
                possibleHuman: false,
                medianF0Hz: 480 + seed.voice * 60,
                contourSlopeSemitonesPerSecond: 4 - seed.voice,
                voicedFraction: 0.8,
                spectralCentroidHz: 1400,
                embeddingMean: mean,
                embeddingMax: Float32Array.from(mean, (value) => value + 0.1),
                embeddingWindows: 3,
                catId: seed.catId,
                confirmedAt: Date.UTC(2026, 8, 12, 8, 30, 0),
              });
            }
          }
          const transaction = store.transaction;
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            reject(new Error('could not write the confirmed events'));
          };
        };
      }),
    [DATABASE, voices, perCat] as const,
  );
}

/**
 * Seeds one unconfirmed event carrying a voice, so identity has something to
 * guess about.
 *
 * @param page The page under test.
 * @param id The event id.
 * @param voice Which synthetic voice it sounds like.
 */
export async function seedUnconfirmedVoice(page: Page, id: string, voice: number): Promise<void> {
  await page.evaluate(
    async ([name, eventId, voiceIndex]) =>
      new Promise<void>((resolve, reject) => {
        const dimensions = 1024;
        const mean = Float32Array.from({ length: dimensions }, (_, i) =>
          Math.cos((i + 1) * 0.21 * (voiceIndex + 1)),
        );
        const open = indexedDB.open(name);
        open.onerror = () => {
          reject(new Error('could not open the database'));
        };
        open.onsuccess = () => {
          const database = open.result;
          const store = database.transaction('events', 'readwrite').objectStore('events');
          const request = store.put({
            id: eventId,
            startedAt: Date.UTC(2026, 8, 12, 10, 5, 0),
            durationMs: 500 + voiceIndex * 120,
            type: 'meow',
            triggerLabel: 'Meow',
            confidence: 0.72,
            syllables: 2,
            peakDbfs: -18.4,
            possibleHuman: false,
            medianF0Hz: 480 + voiceIndex * 60,
            contourSlopeSemitonesPerSecond: 4 - voiceIndex,
            voicedFraction: 0.8,
            spectralCentroidHz: 1400,
            embeddingMean: mean,
            embeddingMax: Float32Array.from(mean, (value) => value + 0.1),
            embeddingWindows: 3,
          });
          request.onerror = () => {
            reject(new Error('could not write the event'));
          };
          request.onsuccess = () => {
            database.close();
            resolve();
          };
        };
      }),
    [DATABASE, id, voice] as const,
  );
}

/**
 * One cat's row in the household list.
 *
 * Scoped to the named list rather than to any list item on the page: the
 * voices section of spec 6.4 is a second list of the same cats, so "the item
 * that mentions Luna" stopped being one element the moment it existed.
 */
export function catRow(page: Page, name: string): Locator {
  return page
    .getByRole('list', { name: 'Tus gatos' })
    .getByRole('listitem')
    .filter({ hasText: name });
}
