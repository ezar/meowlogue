import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * The PWA layer (spec section 7).
 *
 * These assert the two things that are silent when they break: a manifest icon
 * that 404s makes the app uninstallable, and a service worker that does not
 * cache the models leaves a phone re-downloading about 23 MB on every visit —
 * neither shows up as an error in the app.
 *
 * They run against a production build; there is no service worker under
 * `vite dev` by design.
 */

/** The runtime cache named in `vite.config.ts`. */
const MODEL_CACHE = 'meowlogue-models';

test.describe('installability', () => {
  test('serves a manifest whose icons all exist', async ({ page, request }) => {
    await page.goto('/');

    const href = await page.getAttribute('link[rel=manifest]', 'href');
    expect(href).not.toBeNull();

    const manifestUrl = new URL(href ?? '', page.url()).toString();
    const response = await request.get(manifestUrl);
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name: string;
      start_url: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Meowlogue');
    // Both sizes Android asks for, and a maskable variant so the launcher does
    // not letterbox the mark.
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('192x192');
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl).toString();
      const iconResponse = await request.get(iconUrl);
      expect(iconResponse.status(), `${iconUrl} returned ${iconResponse.status()}`).toBe(200);
      expect(iconResponse.headers()['content-type']).toContain('image/png');
    }
  });

  test('serves the favicon that used to 404', async ({ page, request }) => {
    await page.goto('/');
    for (const selector of ['link[rel=icon][sizes="32x32"]', 'link[rel=apple-touch-icon]']) {
      const href = await page.getAttribute(selector, 'href');
      const iconResponse = await request.get(new URL(href ?? '', page.url()).toString());
      expect(iconResponse.status(), `${selector} -> ${href ?? 'missing'}`).toBe(200);
    }
  });

  test('registers a service worker that takes control of the page', async ({ page }) => {
    await page.goto('/');
    const controlled = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      // `ready` resolves as soon as there is an active worker, which can still
      // be `activating`. Waiting for the state itself is the difference
      // between a test that passes and one that passes reliably.
      if (worker !== null && worker.state !== 'activated') {
        await new Promise<void>((resolve) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') resolve();
          });
        });
      }
      return {
        active: worker?.state ?? 'none',
        // `clientsClaim` is what makes the first load controlled; without it
        // nothing is cached until a second visit.
        controller: navigator.serviceWorker.controller !== null,
      };
    });
    expect(controlled.active).toBe('activated');
    expect(controlled.controller).toBe(true);
  });
});

test.describe('model caching', () => {
  test('keeps the downloaded models in a cache of their own', async ({ page }) => {
    await completeOnboarding(page, ['Luna', 'Mia']);
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Nothing is cached until something asks for a model, so this has to
    // actually start the engine.
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText('Listening', { timeout: 90_000 });

    const cached = await page.evaluate(async (cacheName: string) => {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      return keys.map((request) => new URL(request.url).pathname);
    }, MODEL_CACHE);

    // Both models with two cats in the household, plus MediaPipe's runtime.
    expect(cached.some((path) => path.endsWith('yamnet-classifier.tflite'))).toBe(true);
    expect(cached.some((path) => path.endsWith('yamnet-embedder.tflite'))).toBe(true);
    expect(cached.some((path) => path.endsWith('.wasm'))).toBe(true);
  });

  test('does not precache the models, so installing stays small', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const precached = await page.evaluate(async () => {
      const names = await caches.keys();
      const workbox = names.filter((name) => name.includes('precache'));
      const entries: string[] = [];
      for (const name of workbox) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) entries.push(new URL(request.url).pathname);
      }
      return entries;
    });

    expect(precached.length).toBeGreaterThan(0);
    // 23 MB in the precache manifest would mean downloading the embedder
    // before the app could be used at all — including for the one-cat
    // household that deliberately skips it.
    expect(precached.filter((path) => path.includes('/models/'))).toEqual([]);
  });
});
