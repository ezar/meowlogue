import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * M0 end-to-end coverage.
 *
 * These run against a real production build in Chromium with a fake media
 * device, so they exercise the whole chain the browser has to get right:
 * earshot's AudioWorklet loading from a real asset URL, its worker starting,
 * MediaPipe's WASM runtime and the two YAMNet models loading from
 * `/models/`, and the detector wiring surviving minification.
 *
 * They need the models on disk — run `pnpm models:fetch` first.
 */
// The app opens in onboarding until a household exists and the user finishes,
// so every test here walks that first. Before onboarding existed these tests
// landed on the debug page directly; they failed the moment it shipped, which
// is the right way round.
test.beforeEach(async ({ page }) => {
  await completeOnboarding(page);
  // Listen is the app's home now (spec 5.1); the debug page has its own
  // address so it stays available for tuning against a real room.
  await page.goto('/#/debug');
});

test.describe('debug page', () => {
  test('renders the page and starts idle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Idle');
    await expect(page.getByText('Nothing detected yet.')).toBeVisible();
  });

  test('disables the export actions until something is detected', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  test('lists the detection policy the engine runs under', async ({ page }) => {
    await page.getByRole('group').filter({ hasText: 'Detection policy' }).click();
    await expect(page.getByText('16000 Hz')).toBeVisible();
    await expect(page.getByText('975 ms / 487.5 ms')).toBeVisible();
  });

  test('loads the models and reaches the listening state', async ({ page }) => {
    const failures: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });
    page.on('requestfailed', (request) => {
      failures.push(`${request.method()} ${request.url()} failed`);
    });

    await page.getByRole('button', { name: 'Start listening' }).click();

    // Loading YAMNet plus MediaPipe's WASM runtime from our own origin is
    // tens of megabytes, so this is generous on purpose.
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

    // The meter only carries a level once windows are coming out of the
    // worker, so this is the proof that capture, framing and inference are all
    // alive. Addressed by role rather than by text: the detection-policy panel
    // also says "noise floor", and a text locator matches both.
    const meter = page.getByRole('meter', { name: 'Input level' });
    await expect(meter).toHaveAttribute('aria-valuetext', /dBFS/, { timeout: 30_000 });
    await expect(meter).not.toHaveAttribute('aria-valuetext', 'not listening');

    expect(failures, `browser reported: ${failures.join(' | ')}`).toEqual([]);
  });

  test('skips the 13 MB embedder for a one-cat household', async ({ page }) => {
    const assets = new Map<string, number>();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (/\.(tflite|wasm)$/.test(url.pathname)) {
        assets.set(url.pathname, response.status());
      }
    });

    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    const paths = [...assets.keys()];
    // Spec section 11: no network calls beyond the app's own model downloads.
    expect(paths.some((path) => path.endsWith('yamnet-classifier.tflite'))).toBe(true);
    expect(paths.some((path) => path.endsWith('.wasm'))).toBe(true);
    // The household `beforeEach` builds has one cat, so spec 6.4 has nobody to
    // tell apart and the embedder should never be requested.
    expect(paths.some((path) => path.endsWith('yamnet-embedder.tflite'))).toBe(false);
    await expect(page.getByText(/Classifier-only by choice/)).toBeVisible();

    for (const [path, status] of assets) {
      expect(status, `${path} returned ${status}`).toBeLessThan(400);
    }
  });

  test('downloads the embedder once a second cat makes identity meaningful', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await page.goto('/#/debug');

    const paths = new Set<string>();
    page.on('response', (response) => {
      paths.add(new URL(response.url()).pathname);
    });

    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    expect([...paths].some((path) => path.endsWith('yamnet-embedder.tflite'))).toBe(true);
    await expect(page.getByText(/Classifier-only by choice/)).toBeHidden();
  });

  test('stops cleanly and returns to idle', async ({ page }) => {
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('status')).toContainText('Idle');
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  });
});
