import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { formatPrice, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

const product = PRODUCTS.healthBook;

test.describe('Wishlist', () => {
  test('[TC-53] New guest sees the empty wishlist state', async ({ wishlistPage, header }) => {
    await wishlistPage.open();

    await expect(wishlistPage.content).toHaveText(MESSAGES.wishlistEmpty);
    await expect(header.wishlistLink).toHaveText('Wishlist (0)');
  });

  test('[TC-54] Guest adds a product to the wishlist', async ({ productPage, header }) => {
    await productPage.open(product.path);
    await productPage.addToWishlist();

    await expect(productPage.notification.successMessage).toHaveText(MESSAGES.addedToWishlist);
    await expect(header.wishlistLink).toHaveText('Wishlist (1)');
  });

  test('[TC-55] Guest wishlist shows the share URL and removes the item', async ({ productPage, wishlistPage, header }) => {
    await test.step(`Arrange: add "${product.name}" to the wishlist`, async () => {
      await productPage.open(product.path);
      await productPage.addToWishlist();
    });
    await wishlistPage.open();

    await expect(wishlistPage.row(product.name)).toBeVisible();
    await expect(wishlistPage.rowUnitPrice(product.name)).toHaveText(formatPrice(product.price));
    await expect(wishlistPage.rowQuantityInput(product.name)).toHaveValue('1');
    await expect(wishlistPage.shareInfo).toContainText(MESSAGES.wishlistShare);
    expect(await wishlistPage.shareUrl()).toMatch(/^\/wishlist\/[0-9a-f-]{36}$/i);
    // Defect DEF-002: soft check, so the removal below still runs; this check fails until the defect is fixed (the share URL is http.).
    await expect.soft(wishlistPage.shareInfo, 'DEF-002: the share URL uses https')
      .toContainText(/https:\/\/\S+\/wishlist\//i, { timeout: 2_000 });

    await wishlistPage.removeProduct(product.name);
    await expect(wishlistPage.content).toHaveText(MESSAGES.wishlistEmpty);
    await expect(header.wishlistLink).toHaveText('Wishlist (0)');
  });

  test('[TC-56] Wishlist item moves to the cart', async ({ productPage, wishlistPage, cartPage, header }) => {
    await test.step(`Arrange: add "${product.name}" to the wishlist`, async () => {
      await productPage.open(product.path);
      await productPage.addToWishlist();
    });
    const cartBefore = await header.cartCount();
    await wishlistPage.open();
    const landedOn = await wishlistPage.moveToCart(product.name);

    await cartPage.open();
    await expect(cartPage.row(product.name)).toBeVisible();
    await expect(header.cartLink).toHaveText(`Shopping cart (${cartBefore + 1})`);
    // Defect DEF-007: soft check, so the R-27 check below still runs; this check fails until the defect is fixed (thumbnails have no size.).
    await expect.soft(cartPage.rowImage(product.name), 'DEF-007: the row thumbnail has a width (no layout shift)')
      .toHaveAttribute('width', /\d+/, { timeout: 2_000 });
    await expect.soft(cartPage.rowImage(product.name), 'DEF-007: the row thumbnail has a height (no layout shift)')
      .toHaveAttribute('height', /\d+/, { timeout: 2_000 });

    // R-27: whether the item leaves the wishlist is recorded, not asserted.
    await wishlistPage.open();
    const stillInWishlist = await wishlistPage.row(product.name).count();
    recordObservation('R-27', `landed on ${new URL(landedOn).pathname}; item still in wishlist: ${stillInWishlist > 0 ? 'yes' : 'no'}`);
  });

  test.describe('Signed in', () => {
    test(
      '[TC-57] Signed-in customer adds and removes an own wishlist item',
      { tag: ['@mutates-account'] },
      async ({ accountCartCleaner, productPage, wishlistPage, header }) => {
        const { wishlistCount: w } = accountCartCleaner.baseline;
        await productPage.open(product.path);
        await productPage.addToWishlist();
        await expect(productPage.notification.successMessage).toHaveText(MESSAGES.addedToWishlist);
        await expect(header.wishlistLink).toHaveText(`Wishlist (${w + 1})`);

        await wishlistPage.open();
        await expect(wishlistPage.heading).toBeVisible();
        await expect(wishlistPage.row(product.name)).toBeVisible();

        // Guarded primitive (D1): removes only this row and verifies every other row is unchanged.
        const result = await wishlistPage.removeReservedRows([product.name]);
        expect(result.removed).toEqual([product.name]);
        await expect(header.wishlistLink).toHaveText(`Wishlist (${w})`);
        await expect(wishlistPage.row(product.name)).toHaveCount(0);
      }
    );
  });
});
