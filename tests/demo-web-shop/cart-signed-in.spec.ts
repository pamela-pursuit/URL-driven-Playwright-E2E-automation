import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

// D1: only reserved products are added; accountCartCleaner purges them before and after each
// test and its guard throws if any other row (e.g. "14.1-inch Laptop") changes. Assertions are
// relative to the baseline count N.
test.describe('Signed-in cart', () => {
  test(
    '[TC-49] Signed-in customer adds an own item without touching existing items',
    { tag: ['@mutates-account'] },
    async ({ accountCartCleaner, productPage, cartPage, header }) => {
      const { cartCount: n } = accountCartCleaner.baseline;
      const before = await test.step('Record the rows already in the cart', async () => {
        await cartPage.open();
        return cartPage.snapshot();
      });

      await productPage.open(PRODUCTS.healthBook.path);
      await productPage.addToCart();
      await expect(productPage.notification.successMessage).toHaveText(MESSAGES.addedToCart);
      await expect(header.cartLink).toHaveText(`Shopping cart (${n + 1})`);

      await cartPage.open();
      await expect(cartPage.rowQuantityInput(PRODUCTS.healthBook.name)).toHaveValue('1');
      for (const row of before) {
        await expect(cartPage.rowQuantityInput(row.name), `pre-existing row "${row.name}" is unchanged`).toHaveValue(row.qty);
      }

      await test.step('Cleanup: remove only the reserved rows', async () => {
        await accountCartCleaner.purge();
        await expect(header.cartLink).toHaveText(`Shopping cart (${n})`);
      });
    }
  );

  test(
    '[TC-50] Account cart persists across logout and login',
    { tag: ['@mutates-account'] },
    async ({ accountCartCleaner, productPage, cartPage, header, signInAsExistingUser }) => {
      const { cartCount: n } = accountCartCleaner.baseline;
      await productPage.open(PRODUCTS.healthBook.path);
      await productPage.addToCart();
      await expect(header.cartLink).toHaveText(`Shopping cart (${n + 1})`);

      await header.logOut();
      await expect(header.cartLink).toHaveText('Shopping cart (0)');

      await signInAsExistingUser();
      await expect(header.cartLink).toHaveText(`Shopping cart (${n + 1})`);
      await cartPage.open();
      await expect(cartPage.rowQuantityInput(PRODUCTS.healthBook.name)).toHaveValue('1');
    }
  );

  test(
    '[TC-51] Guest cart merges into the account cart on login',
    { tag: ['@mutates-account'] },
    async ({ accountCartCleaner, productPage, cartPage, header, signInAsExistingUser }) => {
      const { cartCount: n } = accountCartCleaner.baseline;
      const before = await test.step('Record the rows already in the cart', async () => {
        await cartPage.open();
        return cartPage.snapshot();
      });
      await header.logOut();

      await test.step('As a guest add "Computing and Internet"', async () => {
        await productPage.open(PRODUCTS.computingAndInternet.path);
        await productPage.addToCart();
        await expect(header.cartLink).toHaveText('Shopping cart (1)');
      });

      await signInAsExistingUser();
      await expect(header.cartLink).toHaveText(`Shopping cart (${n + 1})`);
      await cartPage.open();
      await expect(cartPage.rowQuantityInput(PRODUCTS.computingAndInternet.name)).toHaveValue('1');
      for (const row of before) {
        await expect(cartPage.rowQuantityInput(row.name), `pre-existing row "${row.name}" is still present`).toHaveValue(row.qty);
      }
    }
  );
});
