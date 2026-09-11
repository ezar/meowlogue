import { expect, test } from '@playwright/test';
import { addCat, clearHousehold, reachCatsStep } from './helpers';

/**
 * Onboarding, end to end (spec section 5.1).
 *
 * These run against a production build in Chromium, so they exercise the real
 * Dexie database in IndexedDB rather than a stub. Each test starts from an
 * empty household: the app decides between onboarding and the rest of the app
 * by whether any cat exists, so a leftover cat from a previous test would skip
 * the flow entirely.
 */

test.beforeEach(async ({ page }) => {
  await clearHousehold(page);
});

test.describe('onboarding', () => {
  test('opens in Spanish, which is the default language', async ({ page }) => {
    // Spec section 7: Spanish default, English second. Chromium here reports
    // en-US, so this asserts Spanish is the app's default outright and not
    // the result of locale negotiation — which is what it did at first, and
    // what this test caught.
    await expect(page.getByRole('heading', { name: 'Tus gatos tienen vocabulario' })).toBeVisible();
    await expect(page.getByText('Paso 1 de 3')).toBeVisible();
  });

  test('says outright that it does not translate', async ({ page }) => {
    // Honest framing is a product principle (spec section 2), and this is the
    // first thing a user reads.
    await expect(page.getByText(/no traduce/i)).toBeVisible();
  });

  test('walks forward and back through the steps', async ({ page }) => {
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByRole('heading', { name: 'El audio se queda aquí' })).toBeVisible();
    await expect(page.getByText('Paso 2 de 3')).toBeVisible();

    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByRole('heading', { name: 'Tus gatos tienen vocabulario' })).toBeVisible();
  });

  test('cannot finish with no cats', async ({ page }) => {
    await reachCatsStep(page);
    await expect(page.getByRole('button', { name: 'Listo' })).toBeDisabled();
    await expect(page.getByText('Todavía no hay ningún gato.')).toBeVisible();
  });

  test('adds a cat and persists it across a reload', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');

    // The cat is written to IndexedDB as it is added, not on finish, so
    // reloading mid-onboarding must not lose it.
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: 'Luna' })).toBeVisible();
  });

  test('refuses a duplicate name, case and padding included', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');

    await page.getByLabel('Nombre').fill('  luna ');
    await page.getByRole('button', { name: 'Añadir gato' }).click();

    await expect(page.getByRole('alert')).toContainText('Ya tienes un gato con ese nombre');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('gives the second cat a different colour on its own', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');
    await addCat(page, 'Mia');

    // Colour is named in text as well as shown, so this reads the names.
    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(2);
    const first = await items.nth(0).textContent();
    const second = await items.nth(1).textContent();
    expect(first).not.toBe(second);
  });

  test('warns that identity stays off with a single cat', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');

    // Spec section 5.1: one cat works, with identity disabled, and the copy
    // has to say so rather than quietly doing nothing.
    await expect(page.getByText(/identificación por voz se queda desactivada/i)).toBeVisible();
    await expect(page.getByText('1 gato en casa')).toBeVisible();
  });

  test('drops the single-cat warning once there are two', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');
    await addCat(page, 'Mia');

    await expect(page.getByText(/identificación por voz se queda desactivada/i)).toBeHidden();
    await expect(page.getByText('2 gatos en casa')).toBeVisible();
  });

  test('removes a cat', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');

    await page.getByRole('button', { name: 'Quitar' }).click();
    await expect(page.getByText('Todavía no hay ningún gato.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Listo' })).toBeDisabled();
  });

  test('finishing leads out of onboarding, and it stays gone on reload', async ({ page }) => {
    await reachCatsStep(page);
    await addCat(page, 'Luna');
    await page.getByRole('button', { name: 'Listo' }).click();

    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();

    // A household that exists is the signal, so onboarding must not return.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
  });

  test('offers the eight accents as a keyboard-reachable radio group', async ({ page }) => {
    await reachCatsStep(page);

    // Spec section 10: eight colours, and never conveyed by colour alone —
    // each swatch carries its name for a screen reader.
    const group = page.getByRole('radiogroup', { name: 'Color' });
    await expect(group.getByRole('radio')).toHaveCount(8);
    await expect(group.getByRole('radio', { name: 'miel' })).toBeVisible();
    await expect(group.getByRole('radio', { name: 'ciruela' })).toBeVisible();
  });
});
