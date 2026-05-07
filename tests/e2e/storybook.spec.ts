import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

type StorybookEntry = {
  id: string;
  type: string;
};

type StorybookIndex = {
  entries: Record<string, StorybookEntry>;
};

const indexPath = resolve(process.cwd(), 'storybook-static/index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf-8')) as StorybookIndex;

for (const entry of Object.values(index.entries)) {
  if (entry.type !== 'story') continue;

  test(`${entry.id} screenshot`, async ({ page }) => {
    await page.goto(`http://localhost:6006/iframe.html?id=${entry.id}&viewMode=story`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${entry.id}.png`);
  });
}
