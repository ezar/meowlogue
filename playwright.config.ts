import { defineConfig, devices } from '@playwright/test';

/**
 * Sandboxes and CI images often ship a Chromium that does not match the build
 * `@playwright/test` would download. Point `CHROMIUM_PATH` at that binary to
 * use it; unset, Playwright resolves its own as usual.
 */
const chromiumPath = process.env.CHROMIUM_PATH;

/**
 * The debug page is the only M0 surface, and it needs a real microphone
 * permission grant plus a fake media stream, so every project runs Chromium
 * with the fake-device flags earshot's own eval harness uses.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
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
    command: 'pnpm run build && pnpm run preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
