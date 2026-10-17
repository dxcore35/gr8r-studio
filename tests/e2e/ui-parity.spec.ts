import { expect, test } from '@playwright/test';

test('keeps the upstream Gr8r desktop geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/my-tasks?scenario=populated');
  await expect(page.locator('#app')).toHaveAttribute('data-hydrated', 'true');

  const geometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.shell');
    const sidebar = document.querySelector<HTMLElement>('.side');
    const topbar = document.querySelector<HTMLElement>('.topbar');
    const pageHeader = document.querySelector<HTMLElement>('.page.flush > .ph');
    const heading = pageHeader?.querySelector<HTMLElement>('h1');
    const row = document.querySelector<HTMLElement>('.trow');
    if (!shell || !sidebar || !topbar || !pageHeader || !heading || !row) throw new Error('Gr8r layout is incomplete');

    return {
      columns: getComputedStyle(shell).gridTemplateColumns,
      headingSize: getComputedStyle(heading).fontSize,
      headerLeftPadding: getComputedStyle(pageHeader).paddingLeft,
      rowHeight: row.getBoundingClientRect().height,
      sidebarWidth: sidebar.getBoundingClientRect().width,
      topbarHeight: topbar.getBoundingClientRect().height,
    };
  });

  expect(geometry).toEqual({
    columns: '252px 1188px',
    headingSize: '23px',
    headerLeftPadding: '24px',
    rowHeight: 40,
    sidebarWidth: 252,
    topbarHeight: 46,
  });
});

test('keeps the upstream Gr8r mobile shell and task cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-tasks?scenario=populated');
  await expect(page.locator('#app')).toHaveAttribute('data-hydrated', 'true');

  const geometry = await page.evaluate(() => {
    const bottomNavigation = document.querySelector<HTMLElement>('.bottomnav');
    const heading = document.querySelector<HTMLElement>('.page.flush > .ph h1');
    const row = document.querySelector<HTMLElement>('.trow');
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!bottomNavigation || !heading || !row || !topbar) throw new Error('Responsive Gr8r layout is incomplete');

    return {
      bottomNavigationDisplay: getComputedStyle(bottomNavigation).display,
      headingSize: getComputedStyle(heading).fontSize,
      rowDisplay: getComputedStyle(row).display,
      rowRadius: getComputedStyle(row).borderRadius,
      topbarHeight: topbar.getBoundingClientRect().height,
    };
  });

  expect(geometry).toEqual({
    bottomNavigationDisplay: 'flex',
    headingSize: '19px',
    rowDisplay: 'flex',
    rowRadius: '8px',
    topbarHeight: 50,
  });

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.side')).toHaveCSS('width', '280px');
});
