import { expect, type Page } from '@playwright/test';

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
export async function completeOnboarding(page: Page, catName = 'Luna'): Promise<void> {
  await clearHousehold(page);
  await reachCatsStep(page);
  await addCat(page, catName);
  await page.getByRole('button', { name: 'Listo' }).click();
}
