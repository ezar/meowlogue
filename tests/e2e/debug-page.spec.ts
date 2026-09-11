import { expect, test } from '@playwright/test';

/**
 * M0 end-to-end coverage.
 *
 * While earshot is absent the page must say so plainly rather than appearing
 * broken. Once the tag lands, the listening assertions below become the real
 * pipeline check against Chromium's fake media stream.
 */
test.describe('debug page', () => {
  test('renders and states the engine is not wired up yet', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Meowlogue debug' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('earshot is not wired up yet');
  });

  test('shows an empty session and disables the export actions', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Nothing detected yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  test('surfaces a typed error instead of crashing when Start is pressed', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByRole('status')).toContainText(/earshot/i);
  });

  test('lists the detection policy the engine runs under', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('group').filter({ hasText: 'Detection policy' }).click();
    await expect(page.getByText('16000 Hz')).toBeVisible();
    await expect(page.getByText('975 ms / 487.5 ms')).toBeVisible();
  });
});
