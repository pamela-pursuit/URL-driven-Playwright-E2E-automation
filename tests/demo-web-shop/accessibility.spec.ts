import AxeBuilder from '@axe-core/playwright';
import type { Locator } from '@playwright/test';
import { chromiumOnly, expect, recordObservation, reportOnly, test } from '../../fixtures/demo-web-shop.fixture';
import { LISTING, MAX_TABS_TO_EMAIL, PRODUCTS } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

// Report-only (D4, R-31): findings are recorded as `a11y-gap` annotations and do not fail CI
// until a WCAG target is agreed. DWS-070 runs an axe scan and records violations the same way.
// Used only by DWS-068's single visibility check.
const QUICK = { timeout: 2_000 };
// A single attempt: Playwright checks once before a 1 ms timeout expires (probe r1).
// `timeout: 0` is not usable here: it disables the timeout and waits forever.
const SINGLE_CHECK = { timeout: 1 };

test.describe('Accessibility (report-only)', () => {
  test.describe('Existing account', () => {
    test('[DWS-068] Keyboard-only sign-in', async ({ signInAsExistingUser, header }) => {
      // A rejected sign-in still fails (and trips the lockout circuit breaker); only a11y findings are report-only.
      const report = await signInAsExistingUser({ keyboard: true });

      recordObservation('R-30', `Tab presses to reach Email: ${report.tabsToEmail ?? `not reached within ${MAX_TABS_TO_EMAIL}`}; Tab from Email reached Password: ${report.tabReachedPassword}`);
      await reportOnly('Email field reachable by Tab', async () => {
        expect(report.tabsToEmail, 'Email reached by Tab').not.toBeNull();
      });
      await reportOnly('Tab from Email moves to Password', async () => {
        expect(report.tabReachedPassword, 'Tab order Email -> Password').toBe(true);
      });
      await reportOnly('Signed in after keyboard-only sign-in', async () => {
        await expect(header.logoutLink).toBeVisible(QUICK);
      });
    });
  });

  // Each check makes a single attempt after the page-object ready wait: the known gaps never
  // resolve, so retrying only spent time (first full run: timeouts on firefox/webkit).
  // toHaveCount(1) runs outside reportOnly, so a missing or ambiguous control fails the test.
  test('[DWS-069] Known accessibility gaps are reported', async ({ homePage, header, categoryPage, productPage, cartPage }) => {
    const reportName = async (description: string, control: Locator) => {
      await expect(control, description).toHaveCount(1);
      await reportOnly(description, async () => {
        await expect(control, description).toHaveAccessibleName(/\S/, SINGLE_CHECK);
      });
    };

    await test.step('Home page', async () => {
      await homePage.open();
      await reportOnly('<html> has a lang attribute', async () => {
        expect((await homePage.htmlRoot.getAttribute('lang')) ?? '', '<html lang>').toMatch(/\S+/);
      });
      await reportOnly('Home page has an h1', async () => {
        expect(await homePage.heading.count(), 'h1 count on /').toBeGreaterThan(0);
      });
      await reportName('Header search input has an accessible name', header.searchInput);
      await reportName('Newsletter email input has an accessible name', homePage.newsletterEmail);
    });

    await test.step('Category listing', async () => {
      await categoryPage.open(LISTING.slug);
      await reportName('Listing "Sort by" select has an accessible name', categoryPage.sortSelect);
      await reportName('Listing "Display per page" select has an accessible name', categoryPage.pageSizeSelect);
      await reportName('Listing "View as" select has an accessible name', categoryPage.viewModeSelect);
    });

    await test.step('Cart', async () => {
      await productPage.open(PRODUCTS.computingAndInternet.path);
      await productPage.addToCart();
      await cartPage.open();
      const product = PRODUCTS.computingAndInternet.name;
      await reportName('Cart quantity input has an accessible name', cartPage.rowQuantityInput(product));
      await reportName('Cart remove checkbox has an accessible name', cartPage.rowRemoveCheckbox(product));
      await reportName('Terms of service checkbox has an accessible name', cartPage.termsCheckbox);
      await reportName('Coupon input has an accessible name', cartPage.couponInput);
      await reportName('Gift card input has an accessible name', cartPage.giftCardInput);
    });
  });

  test.describe('Axe scan', () => {
    chromiumOnly('Chromium only: one axe scan per run produces the report; keyboard and accessible-name checks run on all browsers (DWS-068, DWS-069)');

    // Report-only (D4, R-31): each violation becomes an `a11y-axe` annotation and the full axe
    // results are attached as JSON. The test fails only if a page does not load or axe cannot run.
    test('[DWS-070] Automated axe scan of key pages', async ({ page, homePage, loginPage, categoryPage, productPage, cartPage }) => {
      const scan = async (name: string) => {
        const results = await new AxeBuilder({ page }).analyze();
        await test.info().attach(`axe-${name}.json`, {
          body: JSON.stringify({ url: results.url, violations: results.violations, incomplete: results.incomplete }, null, 2),
          contentType: 'application/json'
        });
        for (const v of results.violations) {
          recordObservation('a11y-axe', `${name}: ${v.id} (${v.impact ?? 'unknown'}) on ${v.nodes.length} element(s): ${v.help}`);
        }
        recordObservation('a11y-axe-summary', `${name}: ${results.violations.length} violation rule(s), ${results.passes.length} passed rule(s)`);
      };

      await test.step('Home', async () => {
        await homePage.open();
        await scan('home');
      });
      await test.step('Login', async () => {
        await loginPage.open();
        await scan('login');
      });
      await test.step('Category listing', async () => {
        await categoryPage.open(LISTING.slug);
        await scan('category');
      });
      await test.step('Product', async () => {
        await productPage.open(PRODUCTS.computingAndInternet.path);
        await scan('product');
      });
      await test.step('Cart with one item', async () => {
        await productPage.addToCart();
        await cartPage.open();
        await scan('cart');
      });
    });
  });
});
