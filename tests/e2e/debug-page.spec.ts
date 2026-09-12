import { expect, test } from '@playwright/test';

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
test.describe('debug page', () => {
  test('renders the page and starts idle', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Idle');
    await expect(page.getByText('Nothing detected yet.')).toBeVisible();
  });

  test('disables the export actions until something is detected', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  test('lists the detection policy the engine runs under', async ({ page }) => {
    await page.goto('/');

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

    await page.goto('/');
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

  test('fetches both models and the WASM runtime from its own origin', async ({ page }) => {
    const assets = new Map<string, number>();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (/\.(tflite|wasm)$/.test(url.pathname)) {
        assets.set(url.pathname, response.status());
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    const paths = [...assets.keys()];
    // Spec section 11: no network calls beyond the app's own model downloads.
    expect(paths.some((path) => path.endsWith('yamnet-classifier.tflite'))).toBe(true);
    expect(paths.some((path) => path.endsWith('.wasm'))).toBe(true);
    for (const [path, status] of assets) {
      expect(status, `${path} returned ${status}`).toBeLessThan(400);
    }
  });

  test('stops cleanly and returns to idle', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('status')).toContainText('Idle');
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  });
});
