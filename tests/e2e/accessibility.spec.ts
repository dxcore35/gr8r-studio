import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

async function expectNoWcagViolations(page: Page) {
  await expect
    .poll(async () => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      return results.violations;
    })
    .toEqual([]);
}

test('the populated task view has no automated WCAG A or AA violations', async ({ page }) => {
  await page.goto('/my-tasks?scenario=populated');
  await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();

  await expectNoWcagViolations(page);

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await page.evaluate(() => {
    document.documentElement.dataset.accent = 'neutral';
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expectNoWcagViolations(page);
});

test.describe('mobile accessibility', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the task view and open navigation sheet have no automated WCAG A or AA violations', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');
    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
    await expectNoWcagViolations(page);

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    await expectNoWcagViolations(page);
  });
});
