import { expect, test, type Page } from '@playwright/test';

const reviewDelivery = 'Review the produce delivery';

async function openScenario(page: Page, scenario: 'populated' | 'empty' | 'loading' | 'error' = 'populated') {
  await page.goto(`/my-tasks?scenario=${scenario}`);
  await expect(page.locator('#app')).toHaveAttribute('data-hydrated', 'true');
}

function groupHeader(page: Page, label: string) {
  return page.getByRole('button', { name: `Toggle ${label} group` }).locator('..');
}

test.describe('My tasks', () => {
  test('completes and reopens an assigned task', async ({ page }) => {
    await openScenario(page);

    await expect(page.getByRole('heading', { level: 1, name: 'My Tasks' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect(groupHeader(page, 'Today')).toContainText('2');
    await expect(groupHeader(page, 'Completed')).toContainText('1');

    await page.getByRole('checkbox', { name: `Complete ${reviewDelivery}` }).click();

    await expect(page.getByRole('checkbox', { name: `Complete ${reviewDelivery}` })).toBeHidden();
    await expect(groupHeader(page, 'Today')).toContainText('1');
    await expect(groupHeader(page, 'Completed')).toContainText('2');
    await page.getByRole('button', { name: 'Toggle Completed group' }).click();
    await expect(page.getByRole('checkbox', { name: `Reopen ${reviewDelivery}` })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: `${reviewDelivery} completed` })).toHaveText(`${reviewDelivery} completed`);

    await page.getByRole('checkbox', { name: `Reopen ${reviewDelivery}` }).click();

    await expect(page.getByRole('checkbox', { name: `Complete ${reviewDelivery}` })).toBeVisible();
    await expect(groupHeader(page, 'Today')).toContainText('2');
    await expect(groupHeader(page, 'Completed')).toContainText('1');
    await expect(page.getByRole('status').filter({ hasText: `${reviewDelivery} reopened` })).toHaveText(`${reviewDelivery} reopened`);
  });

  test('filters the task list and recovers from a filtered empty view', async ({ page }) => {
    await openScenario(page);

    const filterButton = page.getByRole('button', { name: /^Filter/ });
    const selectFilter = async (name: string) => {
      await filterButton.click();
      await page.getByRole('group', { name: 'Filter tasks' }).getByRole('button', { name, exact: true }).click();
    };

    await selectFilter('Today');
    await expect(page.getByText(reviewDelivery, { exact: true })).toBeVisible();
    await expect(page.getByText('Approve the autumn menu copy', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm the weekend rota', { exact: true })).toBeHidden();

    await selectFilter('Upcoming');
    await expect(page.getByText("Plan Friday's private event", { exact: true })).toBeVisible();
    await expect(page.getByText(reviewDelivery, { exact: true })).toBeHidden();

    await selectFilter('Completed');
    await expect(page.getByText('Send the daily operations brief', { exact: true })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Reopen Send the daily operations brief' }).click();
    await expect(page.getByText('Send the daily operations brief', { exact: true })).toBeHidden();
    await expect(groupHeader(page, 'Completed')).toContainText('0');

    await selectFilter('All tasks');
    await expect(page.getByText('Send the daily operations brief', { exact: true })).toBeVisible();
  });

  test('creates and edits tasks through the original Gr8r flows', async ({ page }) => {
    await openScenario(page);

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('menu', { name: 'create menu' }).getByRole('menuitem', { name: /^Task/ }).click();
    const composer = page.getByRole('dialog', { name: 'New task' });
    await expect(composer).toBeVisible();
    await composer.getByLabel('Task name').fill('Brief the evening shift');
    await composer.getByRole('button', { name: 'Create task' }).click();

    await expect(composer).toBeHidden();
    await expect(page.getByText('Brief the evening shift', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Brief the evening shift created' })).toHaveText('Brief the evening shift created');

    await page.getByRole('button', { name: 'Add task to Today' }).click();
    const inlineComposer = page.getByRole('textbox', { name: 'New task name' });
    await inlineComposer.fill('Check the table plan');
    await inlineComposer.press('Enter');
    await expect(page.getByRole('button', { name: 'Check the table plan', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Check the table plan', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Task: Check the table plan' });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Priority').selectOption('high');
    await expect(page.getByRole('status').filter({ hasText: 'Check the table plan updated' })).toHaveText('Check the table plan updated');
    await drawer.getByRole('button', { name: 'Close task details' }).click();
    await expect(drawer).toBeHidden();

    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.getByRole('button', { name: 'Check the table plan', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Check the table plan', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Task: Check the table plan' }).getByLabel('Priority')).toHaveValue('high');
  });

  test('opens task details from the month and week calendar', async ({ page }) => {
    await openScenario(page);

    await page.getByRole('tab', { name: 'Calendar' }).click();
    const calendar = page.getByRole('region', { name: 'Task calendar' });
    await expect(calendar).toBeVisible();
    await calendar.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(calendar.getByRole('button', { name: 'Previous week' })).toBeVisible();
    await calendar.getByRole('button', { name: new RegExp(reviewDelivery) }).click();
    await expect(page.getByRole('dialog', { name: `Task: ${reviewDelivery}` })).toBeVisible();
  });

  test('retries a failed task load', async ({ page }) => {
    await openScenario(page, 'error');

    const alert = page.getByRole('alert', { name: 'Task list error' });
    await expect(alert).toContainText('Tasks are unavailable');
    await expect(alert).toContainText('Tasks could not be loaded. Try again.');

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Tasks loaded' })).toHaveText('Tasks loaded');
  });

  test('renders intentional empty and loading states', async ({ page }) => {
    await openScenario(page, 'empty');
    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    for (const label of ['Overdue', 'Today', 'Upcoming', 'Completed']) await expect(groupHeader(page, label)).toContainText('0');

    await openScenario(page, 'loading');
    const loading = page.getByRole('region', { name: 'Task list' });
    await expect(loading.getByRole('status', { name: 'Loading task filters' })).toHaveAttribute('aria-busy', 'true');
    await expect(loading.getByRole('status', { name: 'Loading task 5' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('persists the upstream account-menu theme preference', async ({ page }) => {
    await openScenario(page);

    await page.getByRole('button', { name: 'Account menu' }).click();
    const accountMenu = page.getByRole('menu', { name: 'account menu' });
    await accountMenu.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('carries shell preferences into the complete upstream fallback', async ({ page }) => {
    await openScenario(page);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menu', { name: 'account menu' }).getByRole('menuitemradio', { name: 'Light', exact: true }).click();

    await Promise.all([
      page.waitForURL('**/upstream/index.html#projects'),
      page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Projects', exact: true }).first().click(),
    ]);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  });

  test('opens the selected upstream project view and team', async ({ page }) => {
    await openScenario(page);

    await Promise.all([
      page.waitForURL('**/upstream/index.html?id=p1&tab=board#project'),
      page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: /Website Redesign/ })
        .click(),
    ]);
    await expect(page.getByRole('navigation', { name: 'Project views' }).getByRole('button', { name: 'Board', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await openScenario(page);
    await Promise.all([
      page.waitForURL('**/upstream/index.html?id=p1&tab=files#project'),
      page.locator('#project-p1-subpages').getByRole('button', { name: 'Files', exact: true }).click(),
    ]);
    await expect(page.getByRole('heading', { level: 1, name: 'Website Redesign' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Project views' }).getByRole('button', { name: 'Files', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await openScenario(page);
    await Promise.all([
      page.waitForURL('**/upstream/index.html?id=design#team'),
      page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Design', exact: true }).click(),
    ]);
    await expect(page.getByRole('heading', { level: 1, name: 'Design' })).toBeVisible();
  });

  test('keeps task changes in sync with the complete upstream app', async ({ page }) => {
    const title = 'Bridge round-trip task';
    await openScenario(page);

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('menu', { name: 'create menu' }).getByRole('menuitem', { name: /^Task/ }).click();
    const composer = page.getByRole('dialog', { name: 'New task' });
    await composer.getByLabel('Task name').fill(title);
    await composer.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

    await page.goto('/upstream/index.html#tasks');
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible();
    const legacyRow = page.locator('[data-task-row]', { hasText: title });
    await expect(legacyRow).toHaveCount(1);
    await expect(legacyRow).toContainText('Mara Ionescu');
    await legacyRow.locator('[data-a="openTask"]').click();
    const legacyDrawer = page.getByRole('dialog', { name: `Task: ${title}` });
    await legacyDrawer.getByRole('button', { name: 'Favorite', exact: true }).click();
    await expect(legacyDrawer.getByRole('button', { name: 'Favorite', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await legacyDrawer.getByRole('button', { name: 'Mark complete', exact: true }).click();

    await expect
      .poll(() =>
        page.evaluate(taskTitle => {
          const raw = localStorage.getItem('gr8r.tasks.v1');
          if (!raw) return null;
          const stored = JSON.parse(raw) as {
            data?: { groups?: Array<{ tasks: Array<{ title: string; status: string }> }> };
          };
          return stored.data?.groups?.flatMap(group => group.tasks).find(task => task.title === taskTitle)?.status ?? null;
        }, title),
      )
      .toBe('done');

    await openScenario(page);
    await page.getByRole('button', { name: 'Toggle Completed group' }).click();
    await expect(page.getByRole('checkbox', { name: `Reopen ${title}` })).toBeVisible();

    await page.goto('/upstream/index.html#tasks');
    const persistedLegacyRow = page.locator('[data-task-row]', { hasText: title });
    await persistedLegacyRow.locator('[data-a="openTask"]').click();
    await expect(page.getByRole('dialog', { name: `Task: ${title}` }).getByRole('button', { name: 'Favorite', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('My tasks on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens the navigation sheet and hands unported routes to the complete upstream app', async ({ page }) => {
    await openScenario(page);

    const navigationButton = page.getByRole('button', { name: 'Open navigation' });
    await navigationButton.click();
    const navigation = page.getByRole('navigation', { name: 'Main' });
    await expect(page.locator('.shell')).toHaveClass(/mnav/);
    await expect(navigation.getByRole('button', { name: 'My Tasks' })).toHaveAttribute('aria-current', 'page');

    await Promise.all([page.waitForURL('**/upstream/index.html#projects'), navigation.getByRole('button', { name: 'Projects', exact: true }).first().click()]);
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  });
});

test('keeps the primary task view inside the page at supported widths', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openScenario(page);

    await expect(page.getByRole('heading', { level: 1, name: 'My Tasks' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tasks assigned to Mara Ionescu' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });

  test('keeps the mobile navigation operable', async ({ page }) => {
    await openScenario(page);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.locator('.shell')).toHaveClass(/mnav/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.shell')).not.toHaveClass(/mnav/);
  });
});
