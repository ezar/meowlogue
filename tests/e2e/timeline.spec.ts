import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding, readStoredCats, readStoredEvents, seedEvent } from './helpers';

/**
 * The timeline (spec 5.1): the list, its filters, and one event in full.
 *
 * Events are seeded rather than recorded — Chromium's fake microphone emits a
 * tone, and YAMNet is right not to call that a cat — so what is tested here is
 * everything downstream of a detection: that it can be found again, narrowed
 * down, opened, answered and deleted.
 */

/** Today at a fixed hour, so the "Hoy" heading is deterministic. */
function todayAt(hour: number, minute = 0): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).getTime();
}

/** A fixed older day, well clear of "yesterday". */
const OLDER = new Date(2026, 0, 15, 8, 30).getTime();

async function openTimeline(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
}

test.describe('timeline', () => {
  test('is reachable from Listen and says when it has nothing', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await openTimeline(page);

    await expect(page.getByText('Todavía no he oído nada.')).toBeVisible();
    // And back out again, without leaving the app.
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { name: 'Escuchar' })).toBeVisible();
  });

  test('groups by day, newest first, and names today', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await seedEvent(page, { id: 'old', type: 'purr', startedAt: OLDER });
    await seedEvent(page, { id: 'early', type: 'meow', startedAt: todayAt(7, 10) });
    await seedEvent(page, { id: 'late', type: 'meow', startedAt: todayAt(21, 40) });
    await openTimeline(page);

    const headings = page.getByRole('heading', { level: 2 });
    await expect(headings.first()).toHaveText('Hoy');
    await expect(page.getByText('3 vocalizaciones')).toBeVisible();

    // Newest first inside the day: 21:40 above 07:10.
    const times = await page.getByRole('listitem').allInnerTexts();
    expect(times[0]).toContain('21:40');
    expect(times[1]).toContain('07:10');
  });

  test('filters by cat, by state and by day', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await readStoredCats(page);
    const luna = cats.find((cat) => cat.name === 'Luna')?.id ?? '';

    await seedEvent(page, { id: 'a', type: 'meow', startedAt: todayAt(9), catId: luna });
    await seedEvent(page, { id: 'b', type: 'purr', startedAt: todayAt(10) });
    await seedEvent(page, { id: 'c', type: 'meow', startedAt: OLDER, catId: luna });
    await openTimeline(page);
    await expect(page.getByText('3 vocalizaciones')).toBeVisible();

    await page.getByLabel('Gato').selectOption(luna);
    await expect(page.getByText('2 vocalizaciones')).toBeVisible();

    await page.getByLabel('Estado').selectOption('unconfirmed');
    await expect(page.getByText('Nada con estos filtros.')).toBeVisible();

    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page.getByText('3 vocalizaciones')).toBeVisible();

    // The day picker reaches past the 200-event cap, which is what it is for.
    await page.getByLabel('Día').fill('2026-01-15');
    await expect(page.getByText('1 vocalización')).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('opens one event, with its own address', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: todayAt(9, 5) });
    await openTimeline(page);

    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByRole('heading', { name: 'La vocalización' })).toBeVisible();
    expect(page.url()).toContain('#/event/evt-1');

    // What was actually kept, and — said plainly — what was not.
    await expect(page.getByText('Lo que medí')).toBeVisible();
    await expect(page.getByText('520 Hz')).toBeVisible();
    await expect(page.getByText(/Todavía no guardo el audio/)).toBeVisible();

    // The same question as the Listen card, and the same effect.
    await page.getByRole('button', { name: 'Luna' }).click();
    const [stored] = await readStoredEvents(page);
    expect(stored?.catId).toBeTruthy();
  });

  test('survives a reload on an event, and says so when it is gone', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: todayAt(9, 5) });

    await page.goto('/#/event/evt-1');
    await expect(page.getByRole('heading', { name: 'La vocalización' })).toBeVisible();

    await page.goto('/#/event/nope');
    await expect(page.getByText('Esa vocalización ya no está.')).toBeVisible();
  });

  test('deletes from the detail and returns to the list', async ({ page }) => {
    await completeOnboarding(page, ['Luna']);
    await seedEvent(page, { id: 'evt-1', type: 'meow', startedAt: todayAt(9, 5) });
    await page.goto('/#/event/evt-1');

    await page.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
    await expect(page.getByText('Todavía no he oído nada.')).toBeVisible();
    expect(await readStoredEvents(page)).toHaveLength(0);
  });
});
