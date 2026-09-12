import { expect, test } from '@playwright/test';
import {
  addCat,
  clearHousehold,
  completeOnboarding,
  reachCatsStep,
  readStoredCats,
} from './helpers';

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

  test('stores a downscaled copy of the photo, not the camera original', async ({ page }) => {
    await reachCatsStep(page);

    // A phone-sized photo, made in the browser because nothing here ships a
    // JPEG encoder. The noise matters: a flat colour compresses to almost
    // nothing and the test would prove nothing about downscaling.
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1800;
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('no 2d context');
      const image = context.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = (i * 7) % 255;
        image.data[i + 1] = (i * 13) % 255;
        image.data[i + 2] = (i * 29) % 255;
        image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.95);
    });
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const buffer = Buffer.from(base64, 'base64');

    await page.setInputFiles('#cat-photo', {
      name: 'luna.jpg',
      mimeType: 'image/jpeg',
      buffer,
    });
    await expect(page.getByRole('button', { name: 'Quitar foto' })).toBeVisible();

    await addCat(page, 'Luna');

    const [stored] = await readStoredCats(page);
    expect(stored?.photoType).toBe('image/jpeg');
    expect(stored?.photoSize ?? 0).toBeGreaterThan(0);
    // The stored copy is the 512 px avatar, not the original megabytes.
    expect(stored?.photoSize ?? 0).toBeLessThan(buffer.byteLength / 4);
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

test.describe('household screen', () => {
  test('renames a cat and keeps the name across a reload', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await page.getByRole('button', { name: 'Tu casa' }).click();
    await expect(page.getByRole('heading', { name: 'Tu casa' })).toBeVisible();

    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Nombre').first().fill('Luna Belén');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('listitem').filter({ hasText: 'Luna Belén' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: 'Luna Belén' })).toBeVisible();
  });

  test('refuses a rename that collides with another cat', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await page.getByRole('button', { name: 'Tu casa' }).click();

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByLabel('Nombre').first().fill('  mia ');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('alert')).toContainText('Ya tienes un gato con ese nombre');
    // Renaming a cat to the name it already has is not a collision, though.
    await page.getByLabel('Nombre').first().fill('Luna');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('adds a third cat after onboarding is over', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await page.getByRole('button', { name: 'Tu casa' }).click();

    await page.getByLabel('Nombre').last().fill('Nube');
    await page.getByRole('button', { name: 'Añadir gato' }).click();

    await expect(page.getByRole('listitem').filter({ hasText: 'Nube' })).toBeVisible();
    await expect(page.getByText('3 gatos en casa')).toBeVisible();
  });

  test('starting over asks first, then returns to onboarding', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await page.getByRole('button', { name: 'Tu casa' }).click();

    await page.getByRole('button', { name: 'Borrar y empezar de cero' }).click();
    // The confirmation is the point: one tap must not wipe a household.
    await expect(page.getByRole('button', { name: 'Mejor no' })).toBeVisible();
    await page.getByRole('button', { name: 'Mejor no' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Luna' })).toBeVisible();

    await page.getByRole('button', { name: 'Borrar y empezar de cero' }).click();
    await page.getByRole('button', { name: 'Sí, bórralo todo' }).click();
    await expect(page.getByRole('heading', { name: 'Tus gatos tienen vocabulario' })).toBeVisible();
  });
});

test.describe('help screen', () => {
  test('can be read at any time without touching the household', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await page.getByRole('button', { name: 'Ayuda' }).click();

    await expect(page.getByRole('heading', { name: 'Cómo funciona' })).toBeVisible();
    await expect(page.getByText(/no traduce/i)).toBeVisible();
    // The privacy points are the onboarding copy, not a second version of it.
    await expect(page.getByText(/Todo el análisis ocurre en este dispositivo/)).toBeVisible();

    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
  });

  test('survives being opened straight from its own URL', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await page.goto('/#/help');
    await expect(page.getByRole('heading', { name: 'Cómo funciona' })).toBeVisible();

    // Back must stay inside the app even when there is no history to go back
    // to, which is what a bookmarked hash looks like on a cold start.
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
  });
});

test.describe('removing a cat', () => {
  test('asks first, and names the cat it is about to remove', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await page.getByRole('button', { name: 'Tu casa' }).click();

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();

    // Removing a cat cascades to its labels, so one tap must not do it.
    await expect(page.getByText('¿Quitar a Luna?')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Luna' })).toBeVisible();

    await page.getByRole('button', { name: 'Sí, quitar' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Luna' })).toBeHidden();
    await expect(page.getByRole('listitem').filter({ hasText: 'Mia' })).toBeVisible();
    await expect(page.getByText('1 gato en casa')).toBeVisible();
  });
});
