import { expect, test } from '@playwright/test';
import { completeOnboarding, readStoredEvents, seedEvent } from './helpers';

/**
 * The Listen screen (spec 5.1).
 *
 * Detections are seeded rather than produced: Chromium's fake device emits a
 * tone, and YAMNet is right not to call that a cat. What is tested here is
 * everything after the detection — that it is written, shown, confirmed, and
 * still there after a reload — which is the part that did not exist at all
 * until now.
 */

/** A fixed moment so the rendered clock time is stable. */
const NOON = Date.UTC(2026, 8, 12, 10, 5, 0);

test.describe('listen', () => {
  test('is the screen the app opens on', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await expect(page.getByRole('heading', { name: 'Escuchar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Empezar a escuchar' })).toBeVisible();
  });

  test('says it is still learning instead of guessing who called', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    // Spec 6.4 forbids an identity guess before 10 examples per cat and an
    // 80% self-test. Nothing is trained, so the screen must not pretend.
    await expect(page.getByText(/Todavía estoy aprendiendo las voces/)).toBeVisible();
    await expect(page.getByText(/10 ejemplos por gato/)).toBeVisible();
  });

  test('starts empty, with a hint about when cats talk', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await expect(page.getByText('Todavía no he oído nada.')).toBeVisible();
    await expect(page.getByText(/antes de comer, en la puerta/)).toBeVisible();
  });

  test('shows a stored detection and survives a reload', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: NOON });
    await page.reload();

    await expect(page.getByRole('listitem').filter({ hasText: 'maullido' })).toBeVisible();
    // The point of the whole change: an event outlives the session that heard
    // it, which is what the timeline and the insights will read.
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: 'maullido' })).toBeVisible();
  });

  test('confirms who called, and writes it to the event', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: NOON });
    await page.reload();

    await expect(page.getByText('¿Quién ha sido?')).toBeVisible();
    await page.getByRole('button', { name: 'Luna' }).click();
    await expect(page.getByRole('button', { name: 'Luna' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const [stored] = await readStoredEvents(page);
    expect(stored?.catId).toBeTruthy();

    // The context chips are per cat (spec 5.1) and only appear once there is a
    // cat to attach them to.
    await expect(page.getByText('¿De qué iba?')).toBeVisible();
    await page.getByRole('button', { name: 'comida' }).click();
    const [labelled] = await readStoredEvents(page);
    expect(labelled?.labelId).toBeTruthy();
  });

  test('does not ask who called in a one-cat household', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: NOON });
    await page.reload();

    await expect(page.getByText('¿Quién ha sido?')).toBeHidden();
    await expect(page.getByText(/no hay a quién distinguir/)).toBeVisible();
    // Context still applies: it belongs to the only cat there is.
    await expect(page.getByText('¿De qué iba?')).toBeVisible();
  });

  test('keeps a false positive instead of deleting it', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: NOON });
    await page.reload();

    await page.getByRole('button', { name: 'No era un gato' }).click();
    await expect(page.getByText('Marcado como «no era un gato»')).toBeVisible();

    // Spec 6.7 tunes thresholds against what the detector gets wrong in this
    // particular room, so the row stays.
    const stored = await readStoredEvents(page);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.notACat).toBe(true);
    expect(stored[0]?.catId).toBeUndefined();
  });

  test('deletes an event when asked', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: NOON });
    await page.reload();

    await page.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByText('Todavía no he oído nada.')).toBeVisible();
    expect(await readStoredEvents(page)).toHaveLength(0);
  });

  test('keeps the debug page reachable at its own address', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await page.goto('/#/debug');
    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();

    await page.getByRole('button', { name: 'Escuchar' }).click();
    await expect(page.getByRole('heading', { name: 'Escuchar' })).toBeVisible();
  });
});
