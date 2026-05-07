import { expect, test } from '@playwright/test';

test('index page loads cleanly', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: Error[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Sketches' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
