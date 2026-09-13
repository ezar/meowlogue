import { expect, test, type Page } from '@playwright/test';
import {
  completeOnboarding,
  readStoredCats,
  seedConfirmedVoices,
  seedUnconfirmedVoice,
} from './helpers';

/**
 * The clock time the seeded query event carries, so its card can be told from
 * the confirmed ones behind it — which are also on screen, because the recent
 * list shows what is stored.
 */
const QUERY_TIME = '10:05';

/** The card of the one unconfirmed event. */
function queryCard(page: Page) {
  return page.getByRole('listitem').filter({ hasText: QUERY_TIME });
}

/**
 * Cat ids by name.
 *
 * By name, never by position: the ids are generated, and `getAll` hands rows
 * back in primary-key order, which has nothing to do with the order the cats
 * were added in.
 */
async function catIds(page: Page): Promise<Record<string, string>> {
  const cats = await readStoredCats(page);
  return Object.fromEntries(cats.map((cat) => [cat.name, cat.id]));
}

/**
 * Identity, end to end (spec 6.4).
 *
 * What these assert is mostly what the app *refuses* to say. Identity is the
 * one feature where being wrong is worse than being silent: a name attached to
 * the wrong cat turns the timeline, the insights and the vet summary into
 * fiction, all of it built on a guess the app was not entitled to make. So
 * there is a test for each way the gate can be shut, not just for it opening.
 *
 * The training set is seeded rather than recorded: the gate needs ten
 * confirmed meows per cat, and Chromium's fake microphone emits a tone.
 */

test.describe('identity', () => {
  test('says which cat it still needs examples from', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    await seedConfirmedVoices(
      page,
      [
        { catId: cats['Luna'] ?? '', voice: 0 },
        { catId: cats['Mia'] ?? '', voice: 1 },
      ],
      4,
    );
    await page.reload();

    // Six more from each, by name: a number a person can act on.
    await expect(page.getByText(/Me faltan ejemplos/)).toBeVisible();
    await expect(page.getByText(/6 de Luna/)).toBeVisible();
    await expect(page.getByText(/6 de Mia/)).toBeVisible();
  });

  test('stays quiet about a cat it has never heard', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    // Luna is fully enrolled, Mia is not enrolled at all. Guessing now would
    // mean calling every one of Mia's calls Luna, with confidence.
    await seedConfirmedVoices(page, [{ catId: cats['Luna'] ?? '', voice: 0 }], 12);
    await seedUnconfirmedVoice(page, 'query-1', 1);
    await page.reload();

    await expect(page.getByText(/Me faltan ejemplos/)).toBeVisible();
    await expect(page.getByText(/10 de Mia/)).toBeVisible();
    await expect(page.getByText(/Creo que ha sido/)).toBeHidden();
  });

  test('will not say names while the self-test is below 80%', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    // Both cats taught as the same voice: enough examples, unlearnable set.
    await seedConfirmedVoices(
      page,
      [
        { catId: cats['Luna'] ?? '', voice: 0 },
        { catId: cats['Mia'] ?? '', voice: 0 },
      ],
      12,
    );
    await seedUnconfirmedVoice(page, 'query-1', 0);
    await page.reload();

    await expect(page.getByText(/no digo nombres por debajo del 80%/)).toBeVisible();
    await expect(page.getByText(/Creo que ha sido/)).toBeHidden();
    // And it still asks, which is the only way out of this state.
    await expect(queryCard(page).getByText('¿Quién ha sido?')).toBeVisible();
  });

  test('guesses who called once it has earned it', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    await seedConfirmedVoices(
      page,
      [
        { catId: cats['Luna'] ?? '', voice: 0 },
        { catId: cats['Mia'] ?? '', voice: 1 },
      ],
      12,
    );
    await seedUnconfirmedVoice(page, 'query-1', 1);
    await page.reload();

    await expect(page.getByText(/Ya distingo las voces/)).toBeVisible();
    // Mia's voice, so Mia's name — and a percentage beside it, never a bare
    // assertion.
    await expect(queryCard(page).getByText(/Creo que ha sido Mia · \d+%/)).toBeVisible();
    // The guess is a suggestion, not an answer: nothing is pressed until the
    // person presses it.
    await expect(queryCard(page).getByRole('button', { name: 'Mia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('says who it thinks called on the event detail too', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    await seedConfirmedVoices(
      page,
      [
        { catId: cats['Luna'] ?? '', voice: 0 },
        { catId: cats['Mia'] ?? '', voice: 1 },
      ],
      12,
    );
    await seedUnconfirmedVoice(page, 'query-1', 1);

    // The detail is a second place the same guess can be shown, and a second
    // chance to word it differently. It must not.
    await page.goto('/#/event/query-1');
    await expect(page.getByRole('heading', { name: 'La vocalización' })).toBeVisible();
    await expect(page.getByText(/Creo que ha sido Mia · \d+%/)).toBeVisible();
  });

  test('shows the self-test where spec 6.4 says it belongs', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    const cats = await catIds(page);
    await seedConfirmedVoices(
      page,
      [
        { catId: cats['Luna'] ?? '', voice: 0 },
        { catId: cats['Mia'] ?? '', voice: 1 },
      ],
      11,
    );
    await page.goto('/#/household');

    await expect(page.getByRole('heading', { name: 'Las voces' })).toBeVisible();
    await expect(
      page.getByText(/Reconocimiento de voz: \d+% con tus propios ejemplos/),
    ).toBeVisible();
    // Enrollment status per cat, as spec 5.2 asks for on this screen.
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Luna' }).getByText('11 ejemplos'),
    ).toBeVisible();
  });
});
