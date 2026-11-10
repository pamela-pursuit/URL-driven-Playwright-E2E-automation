import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type BrowserContext, type Route } from '@playwright/test';
import { getAccount, type Account } from '../lib/credentials-store.cjs';
import { DemoWebShopAccountPage } from '../pages/demo-web-shop/account.page';
import { DemoWebShopCartPage } from '../pages/demo-web-shop/cart.page';
import { DemoWebShopCategoryPage } from '../pages/demo-web-shop/category.page';
import { DemoWebShopCheckoutPage } from '../pages/demo-web-shop/checkout.page';
import { DemoWebShopHeader } from '../pages/demo-web-shop/header.page';
import { DemoWebShopHomePage } from '../pages/demo-web-shop/home.page';
import { DemoWebShopLoginPage } from '../pages/demo-web-shop/login.page';
import { DemoWebShopNotificationBar } from '../pages/demo-web-shop/notification-bar.page';
import { DemoWebShopOrderCompletedPage } from '../pages/demo-web-shop/order-completed.page';
import { DemoWebShopOrderPage } from '../pages/demo-web-shop/order.page';
import { DemoWebShopProductPage } from '../pages/demo-web-shop/product.page';
import type { PurgeResult } from '../pages/demo-web-shop/reserved-rows';
import { DemoWebShopRegisterPage } from '../pages/demo-web-shop/register.page';
import { DemoWebShopSearchPage } from '../pages/demo-web-shop/search.page';
import { DemoWebShopWishlistPage } from '../pages/demo-web-shop/wishlist.page';
import {
  ADD_TO_CART_URL,
  GUEST_ADDRESS,
  PROTECTED_ACCOUNT_ITEMS,
  RESERVED_TEST_PRODUCTS,
  THIRD_PARTY_BLOCKLIST,
  uniqueGuestEmail,
  type GuestCustomer
} from '../test-data/demo-web-shop.data';

const APP = 'demo-web-shop';
const REJECTED_MARKER = '.existing-user-login-rejected';
const REJECTED_MESSAGE =
  'existingUser sign-in was rejected. Check the credential with: node scripts/credentials.mjs check --app demo-web-shop';
const BREAKER_MESSAGE = 'Skipping sign-in: existingUser was rejected earlier in this run (lockout protection, R-04)';

export interface AccountBaseline {
  cartCount: number;
  wishlistCount: number;
}

export interface AccountCartCleaner {
  /** Header counts after the setup purge (count-relative assertions, D1). */
  baseline: AccountBaseline;
  purge(): Promise<void>;
}

export interface SignInOptions {
  /** 'login-page' (default) opens /login first; 'current-page' uses the login form already shown (ReturnUrl redirect). */
  from?: 'login-page' | 'current-page';
}

export interface LoginCircuitBreaker {
  /** Throws when existingUser was already rejected in this run. */
  ensureClosed(): void;
}

export type CartRequestKind = keyof typeof ADD_TO_CART_URL;

export interface CartNetwork {
  /** Aborts the next matching add-to-cart request. `fired` resolves when the route was used. */
  abortNext(kind?: CartRequestKind): Promise<{ fired: Promise<void> }>;
  /** Fulfils the next matching add-to-cart request with an empty body and the given status. */
  failNextWith(status: number, kind?: CartRequestKind): Promise<{ fired: Promise<void> }>;
  hits(): number;
}

type Fixtures = {
  blockThirdPartyScripts: void;
  header: DemoWebShopHeader;
  notification: DemoWebShopNotificationBar;
  homePage: DemoWebShopHomePage;
  loginPage: DemoWebShopLoginPage;
  registerPage: DemoWebShopRegisterPage;
  searchPage: DemoWebShopSearchPage;
  categoryPage: DemoWebShopCategoryPage;
  productPage: DemoWebShopProductPage;
  cartPage: DemoWebShopCartPage;
  wishlistPage: DemoWebShopWishlistPage;
  checkoutPage: DemoWebShopCheckoutPage;
  orderCompletedPage: DemoWebShopOrderCompletedPage;
  orderPage: DemoWebShopOrderPage;
  accountPage: DemoWebShopAccountPage;
  loginCircuitBreaker: LoginCircuitBreaker;
  signInAsExistingUser: (options?: SignInOptions) => Promise<void>;
  signedIn: { header: DemoWebShopHeader };
  accountCartCleaner: AccountCartCleaner;
  uniqueGuest: GuestCustomer;
  cartNetwork: CartNetwork;
};

type WorkerFixtures = {
  existingUser: Account;
};

/** Blocks third-party hosts that stall the page `load` event (R-03, K5). */
export async function blockThirdParty(context: BrowserContext): Promise<void> {
  for (const pattern of THIRD_PARTY_BLOCKLIST) {
    await context.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  }
}

/** The run folder, derived from the project output dir (<runDir>/test-results). */
function runDirectory(): string {
  return path.dirname(test.info().project.outputDir);
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  blockThirdPartyScripts: [
    async ({ context }, use) => {
      await blockThirdParty(context);
      await use();
    },
    { auto: true }
  ],

  header: async ({ page }, use) => use(new DemoWebShopHeader(page)),
  notification: async ({ page }, use) => use(new DemoWebShopNotificationBar(page)),
  homePage: async ({ page }, use) => use(new DemoWebShopHomePage(page)),
  loginPage: async ({ page }, use) => use(new DemoWebShopLoginPage(page)),
  registerPage: async ({ page }, use) => use(new DemoWebShopRegisterPage(page)),
  searchPage: async ({ page }, use) => use(new DemoWebShopSearchPage(page)),
  categoryPage: async ({ page }, use) => use(new DemoWebShopCategoryPage(page)),
  productPage: async ({ page }, use) => use(new DemoWebShopProductPage(page)),
  cartPage: async ({ page }, use) => use(new DemoWebShopCartPage(page)),
  wishlistPage: async ({ page }, use) => use(new DemoWebShopWishlistPage(page)),
  checkoutPage: async ({ page }, use) => use(new DemoWebShopCheckoutPage(page)),
  orderCompletedPage: async ({ page }, use) => use(new DemoWebShopOrderCompletedPage(page)),
  orderPage: async ({ page }, use) => use(new DemoWebShopOrderPage(page)),
  accountPage: async ({ page }, use) => use(new DemoWebShopAccountPage(page)),

  // Accounts are read only here (credentials.md). Missing role or field: getAccount throws a
  // descriptive error without values and the test fails (it is not skipped).
  existingUser: [
    async ({}, use) => {
      await use(await getAccount(APP, 'existingUser', { required: ['email', 'password'] }));
    },
    { scope: 'worker' }
  ],

  // Run-scoped circuit breaker (R-04): a marker file in the run folder survives worker restarts.
  loginCircuitBreaker: async ({}, use) => {
    const marker = path.join(runDirectory(), REJECTED_MARKER);
    await use({
      ensureClosed: () => {
        if (fs.existsSync(marker)) {
          throw new Error(BREAKER_MESSAGE);
        }
      }
    });
  },

  signInAsExistingUser: async ({ existingUser, loginPage, header, loginCircuitBreaker }, use) => {
    await use(async (options: SignInOptions = {}) => {
      loginCircuitBreaker.ensureClosed();
      if (options.from !== 'current-page') {
        await loginPage.open();
      }
      // Values are filled without step titles (fillAccountValue, P9); the boxed step points errors here.
      const outcome = await test.step(
        'Sign in as existingUser',
        async () => loginPage.signIn(existingUser.email, existingUser.password),
        { box: true }
      );
      if (outcome === 'rejected') {
        const runDir = runDirectory();
        fs.mkdirSync(runDir, { recursive: true });
        fs.writeFileSync(path.join(runDir, REJECTED_MARKER), '');
        throw new Error(REJECTED_MESSAGE);
      }
      if (outcome !== 'signed-in') {
        throw new Error(`existingUser sign-in did not complete (outcome: ${outcome})`);
      }
      await header.logoutLink.waitFor();
    });
  },

  // No logout on teardown: the context is discarded; the account cart persists server-side by design.
  signedIn: async ({ signInAsExistingUser, header }, use) => {
    await signInAsExistingUser();
    await use({ header });
  },

  // D1 / K4: purges only reserved products before and after each mutating test, guarded.
  accountCartCleaner: [
    async ({ signedIn, cartPage, wishlistPage, header, signInAsExistingUser }, use, testInfo) => {
      void signedIn;
      const recordGuard = (where: string, result: PurgeResult) => {
        for (const item of PROTECTED_ACCOUNT_ITEMS) {
          const row = result.untouched.find((candidate) => candidate.name === item);
          if (row) {
            testInfo.annotations.push({
              type: 'cleanup-guard',
              description: `${where}: "${item}" left in place with qty ${row.qty} (removed: ${result.removed.join(', ') || 'none'})`
            });
          }
        }
      };
      const purge = async (phase: string) => {
        await cartPage.open();
        recordGuard(`${phase} cart`, await cartPage.removeReservedRows(RESERVED_TEST_PRODUCTS));
        await wishlistPage.open();
        recordGuard(`${phase} wishlist`, await wishlistPage.removeReservedRows(RESERVED_TEST_PRODUCTS));
      };
      await purge('setup');
      const baseline: AccountBaseline = {
        cartCount: await header.cartCount(),
        wishlistCount: await header.wishlistCount()
      };
      await use({ baseline, purge: () => purge('manual') });
      // Teardown also runs after a failure. Sign in again only on the logout paths (DWS-050, 051).
      if (!(await header.isSignedIn())) {
        await signInAsExistingUser();
      }
      await purge('teardown');
    },
    { timeout: 60_000 }
  ],

  uniqueGuest: async ({}, use) => {
    await use({ ...GUEST_ADDRESS, email: uniqueGuestEmail() });
  },

  cartNetwork: async ({ page }, use) => {
    let hits = 0;
    const register = async (kind: CartRequestKind, handle: (route: Route) => Promise<void>) => {
      let resolveFired!: () => void;
      const fired = new Promise<void>((resolve) => {
        resolveFired = resolve;
      });
      await page.route(
        ADD_TO_CART_URL[kind],
        async (route) => {
          hits += 1;
          await handle(route);
          resolveFired();
        },
        { times: 1 }
      );
      return { fired };
    };
    await use({
      abortNext: (kind = 'details') => register(kind, (route) => route.abort('failed')),
      failNextWith: (status, kind = 'details') => register(kind, (route) => route.fulfill({ status, body: '' })),
      hits: () => hits
    });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

export { expect };

/** D2 / K2: call first inside a test.describe. Skips before any fixture runs on other browsers. */
export function chromiumOnly(reason = 'Chromium only (D2): mutates the shared account or places an order'): void {
  test.skip(({ browserName }) => browserName !== 'chromium', reason);
}

/** Annotation for first-run observations. Never pass account values. */
export function recordObservation(type: string, description: string): void {
  test.info().annotations.push({ type, description });
}
