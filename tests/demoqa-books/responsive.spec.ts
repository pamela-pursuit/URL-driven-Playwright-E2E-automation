import { expect, test } from '../../fixtures/demoqa-books.fixture';
import { MOBILE_VIEWPORT } from '../../test-data/demoqa-books.data';

test.describe('Responsive layout at 375x812', () => {
  // Section 10.2 note 6: Playwright does not support isMobile on Firefox; the layout is driven by
  // the viewport width, so Firefox runs with the viewport and touch only.
  test.use({
    viewport: MOBILE_VIEWPORT,
    hasTouch: true,
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox')
  });

  test('[DQB-047] Book list on a 375x812 viewport', async ({ booksPage }) => {
    await booksPage.open();

    await expect(booksPage.menu.link('Book Store')).toBeHidden();
    await expect(booksPage.searchBox).toBeVisible();
    await expect(booksPage.session.loginButton).toBeVisible();
    for (const column of ['Image', 'Title', 'Author'] as const) {
      await expect(booksPage.table.columnHeader(column)).toBeInViewport();
    }
    // Probe P8: the table's overflow wrapper clips Publisher at x=360, leaving about 6% of the
    // header box (its left padding, no text) inside the viewport on all three browsers. "Not
    // visible in the viewport" is therefore checked as less than 10% of the header inside it (R-27):
    // the padding sliver passes, any part of the header text entering the viewport fails.
    await expect(booksPage.table.columnHeader('Publisher')).not.toBeInViewport({ ratio: 0.1 });
    expect(await booksPage.documentScrollWidth(), 'no page-level horizontal scroll').toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  });

  test('[DQB-048] Login page on a 375x812 viewport', async ({ loginPage }) => {
    await loginPage.open();

    await expect(loginPage.userNameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.menu.link('Login')).toBeHidden();
    expect(await loginPage.documentScrollWidth(), 'no page-level horizontal scroll').toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  });
});
