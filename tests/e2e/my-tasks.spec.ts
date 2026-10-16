import { expect, test } from '@playwright/test';

const reviewDelivery = 'Review the produce delivery';

test.describe('My tasks', () => {
  test('completes and reopens an assigned task', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');

    const taskList = page.getByRole('region', { name: 'Task list' });
    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect(taskList).toContainText('4 open');
    await expect(taskList).toContainText('1 completed');

    await page.getByRole('button', { name: `Complete ${reviewDelivery}` }).click();

    await expect(page.getByRole('button', { name: `Reopen ${reviewDelivery}` })).toBeVisible();
    await expect(taskList).toContainText('3 open');
    await expect(taskList).toContainText('2 completed');
    await expect(page.getByRole('status').filter({ hasText: `${reviewDelivery} completed` })).toHaveText(`${reviewDelivery} completed`);

    await page.getByRole('button', { name: `Reopen ${reviewDelivery}` }).click();

    await expect(page.getByRole('button', { name: `Complete ${reviewDelivery}` })).toBeVisible();
    await expect(taskList).toContainText('4 open');
    await expect(taskList).toContainText('1 completed');
    await expect(page.getByRole('status').filter({ hasText: `${reviewDelivery} reopened` })).toHaveText(`${reviewDelivery} reopened`);
  });

  test('filters the task list and recovers from a filtered empty view', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');

    const filters = page.getByRole('group', { name: 'Filter tasks' });

    await filters.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByText(reviewDelivery, { exact: true })).toBeVisible();
    await expect(page.getByText('Approve the autumn menu copy', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm the weekend rota', { exact: true })).toBeHidden();

    await filters.getByRole('button', { name: 'Upcoming' }).click();
    await expect(page.getByText("Plan Friday's private event", { exact: true })).toBeVisible();
    await expect(page.getByText(reviewDelivery, { exact: true })).toBeHidden();

    await filters.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByText('Send the daily operations brief', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reopen Send the daily operations brief' }).click();
    await expect(page.getByText('Nothing in this filter', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Show all tasks' }).click();
    await expect(page.getByText('Send the daily operations brief', { exact: true })).toBeVisible();
    await expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('retries a failed task load', async ({ page }) => {
    await page.goto('/my-tasks?scenario=error');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Tasks are unavailable');
    await expect(alert).toContainText('Tasks could not be loaded. Try again.');

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Tasks loaded' })).toHaveText('Tasks loaded');
  });

  test('renders intentional empty and loading states', async ({ page }) => {
    await page.goto('/my-tasks?scenario=empty');
    await expect(page.getByRole('region', { name: 'Empty task list' })).toContainText('You have no assigned tasks');
    await expect(page.getByRole('table')).toHaveCount(0);

    await page.goto('/my-tasks?scenario=loading');
    const loading = page.getByRole('region', { name: 'Task list' });
    await expect(loading.getByRole('status', { name: 'Loading task filters' })).toHaveAttribute('aria-busy', 'true');
    await expect(loading.getByRole('status', { name: 'Loading task 5' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('switches between light and dark themes', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');

    const darkThemeButton = page.getByRole('button', { name: 'Use dark theme' });
    await expect(darkThemeButton).toHaveAttribute('aria-pressed', 'false');
    await darkThemeButton.click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const lightThemeButton = page.getByRole('button', { name: 'Use light theme' });
    await expect(lightThemeButton).toHaveAttribute('aria-pressed', 'true');
    await lightThemeButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('My tasks on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens the navigation sheet and announces planned destinations', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');

    await page.getByRole('button', { name: 'Open navigation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Navigation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'My tasks' })).toHaveAttribute('aria-current', 'page');

    await dialog.getByRole('button', { name: 'Projects' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Projects is planned for the next UI slice' })).toHaveText(
      'Projects is planned for the next UI slice',
    );
  });
});

test('keeps the primary task view inside the page at supported widths', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/my-tasks?scenario=populated');

    await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

  test('keeps the mobile navigation operable', async ({ page }) => {
    await page.goto('/my-tasks?scenario=populated');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  });
});
