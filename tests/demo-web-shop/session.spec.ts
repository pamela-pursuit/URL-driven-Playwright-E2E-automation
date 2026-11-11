import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { MESSAGES } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

test.describe('Session', () => {
  test('[TC-07] Signed-in session survives a page reload', async ({ signedIn, existingUser }) => {
    const { header } = signedIn;
    await header.reload();

    await expect(header.logoutLink).toBeVisible();
    expect(await header.accountLinkShows(existingUser.email), 'header account link shows the existingUser email').toBe(true);
  });

  test('[TC-08] Logout restores the guest header', async ({ signedIn, page }) => {
    const { header } = signedIn;
    await header.logOut();

    await expect(page).toHaveURL(/\/$/);
    await expect(header.registerLink).toBeVisible();
    await expect(header.loginLink).toBeVisible();
    await expect(header.cartLink).toHaveText('Shopping cart (0)');
    await expect(header.wishlistLink).toHaveText('Wishlist (0)');
    await expect(header.logoutLink).toHaveCount(0);
    await expect(header.accountLink).toHaveCount(0);
  });

  test('[TC-09] Back navigation after logout shows no signed-in content', async ({ signedIn, cartPage }) => {
    const { header } = signedIn;
    await cartPage.open();
    await header.logOut();

    for (let back = 1; back <= 3; back++) {
      await test.step(`Back ${back}`, async () => {
        const moved = await header.goBack();
        expect(moved, `history entry ${back} exists`).toBe(true);
        await expect(header.logoutLink).toHaveCount(0);
        await expect(header.accountLink).toHaveCount(0);
      });
    }
  });

  test('[TC-10] Cleared session cookies force login on account pages', async ({ signedIn, accountPage, page }) => {
    const { header } = signedIn;
    // Session expiry simulation (R-18: the server-side timeout itself is not observed).
    await page.context().clearCookies();
    await accountPage.goto('info');

    await expect(page).toHaveURL(/\/login\?ReturnUrl=%2fcustomer%2finfo$/i);
    await expect(header.loginLink).toBeVisible();
  });

  test('[TC-11] Login page renders while already signed in', async ({ signedIn, loginPage, page }) => {
    const { header } = signedIn;
    await loginPage.open();

    // R-19: observed behaviour, no redirect. Whether this is intended is unspecified.
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.heading).toHaveText(MESSAGES.loginHeading);
    await expect(header.logoutLink).toBeVisible();
  });
});
