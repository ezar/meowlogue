import { defineConfig, devices } from '@playwright/test';

/**
 * Sandboxes and CI images often ship a Chromium that does not match the build
 * `@playwright/test` would download. Point `CHROMIUM_PATH` at that binary to
 * use it; unset, Playwright resolves its own as usual.
 */
const chromiumPath = process.env.CHROMIUM_PATH;

/**
 * The preview server is pinned to an explicit IPv4 host rather than left on
 * Vite's default `localhost`. On hosts where `localhost` resolves to `::1`
 * first — GitHub's runners among them — Vite listens on IPv6 only while
 * Playwright polls this literal address, and the run dies on a webServer
 * timeout with nothing in the log. Binding and polling the same address is
 * the fix.
 */
const HOST = '127.0.0.1';
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;

/**
 * Every project runs Chromium with the fake-device flags earshot's own eval
 * harness uses, so the debug page can be driven without a real microphone.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    permissions: ['microphone'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(chromiumPath === undefined ? {} : { executablePath: chromiumPath }),
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `pnpm run build && pnpm run preview --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Surface the build and preview output. Without this a webServer that
    // never binds fails with a bare timeout and no clue why.
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
