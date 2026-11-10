import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { ACCOUNT_SECTIONS_PROTECTED, HEADINGS } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

test.describe('Authorization', () => {
  test('[DWS-012] Guest is redirected to login from protected account pages', async ({ accountPage, loginPage, page }) => {
    for (const section of ACCOUNT_SECTIONS_PROTECTED) {
      await test.step(`/customer/${section}`, async () => {
        await accountPage.goto(section);
        await expect(page).toHaveURL(new RegExp(`/login\\?ReturnUrl=%2fcustomer%2f${section}$`, 'i'));
        await expect(loginPage.loginButton).toBeVisible();
      });
    }
  });

  test.describe('Existing account', () => {
    test('[DWS-013] Sign-in from a ReturnUrl redirect returns to the requested page', async ({ accountPage, signInAsExistingUser, page }) => {
      await accountPage.goto('info');
      await expect(page).toHaveURL(/\/login\?ReturnUrl=%2fcustomer%2finfo$/i);

      await signInAsExistingUser({ from: 'current-page' });

      // R-20: assumed landing page; the actual URL path is recorded for review.
      recordObservation('R-20', `landing path after ReturnUrl sign-in: ${new URL(page.url()).pathname}`);
      await expect(page).toHaveURL(/\/customer\/info$/);
      await expect(accountPage.heading).toHaveText(HEADINGS.customerInfo);
    });
  });

  test('[DWS-014] Guest is redirected to login from the back-in-stock subscriptions page', async ({ accountPage, page }) => {
    await accountPage.goto('backinstocksubscriptions');

    // Known defect DEF-007: fails while the page renders for a guest instead of redirecting like DWS-013.
    await expect(page, 'DEF-007: guest is redirected to login like the other /customer/* pages')
      .toHaveURL(/\/login\?ReturnUrl=%2fcustomer%2fbackinstocksubscriptions$/i, { timeout: 5_000 });
  });
});
