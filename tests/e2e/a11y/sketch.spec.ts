import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// p5.js renders a <canvas> as the sketch surface. Canvas semantics here
// are intentional (generative art, no DOM equivalent); we exclude it from
// the axe scan so the test measures the non-canvas a11y of the surrounding
// page chrome (header, navigation, metadata). Canvas-level a11y is a
// separate concern handled at the component-API layer.
test('sketch page (/sketch/1-formulas) has no a11y violations outside the canvas', async ({ page }) => {
  await page.goto('/sketch/1-formulas');
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .exclude('canvas')
    .analyze();

  expect(results.violations).toEqual([]);
});
