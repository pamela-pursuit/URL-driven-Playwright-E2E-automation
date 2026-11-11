import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { MOBILE_VIEWPORT, TOP_MENU } from '../../test-data/demo-web-shop.data';

test.describe('Responsive layout', () => {
  // Probe P8: isMobile did not throw on Firefox 1.64, but Playwright documents it as unsupported
  // there, so it is enabled only on Chromium and WebKit. The viewport drives the layout.
  test.use({
    viewport: MOBILE_VIEWPORT,
    hasTouch: true,
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox')
  });

  test('[TC-67] Mobile layout shows the category menu at 375x812', async ({ homePage, header }) => {
    await homePage.open();

    expect(await homePage.documentScrollWidth()).toBe(MOBILE_VIEWPORT.width);
    await expect(header.registerLink).toBeVisible();
    await expect(header.loginLink).toBeVisible();
    await expect(header.cartLink).toHaveText('Shopping cart (0)');
    await expect(header.cartLink).toBeVisible();
    await expect(header.wishlistLink).toHaveText('Wishlist (0)');
    await expect(header.wishlistLink).toBeVisible();
    await expect(header.searchInput).toBeVisible();
    await expect(header.topMenu).toBeHidden();
    await expect(header.mobileMenuToggle).toBeVisible();

    await header.openMobileMenu();
    for (const name of TOP_MENU) {
      await expect(header.mobileMenuLink(name)).toBeVisible();
    }
  });
});
