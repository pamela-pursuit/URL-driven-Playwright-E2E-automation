import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { INVALID, LISTING, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

test.describe('Product page', () => {
  test('[TC-32] Guest adds a product to the cart from its page', async ({ productPage, header }) => {
    await productPage.open(PRODUCTS.computingAndInternet.path);
    await productPage.addToCart();

    await expect(productPage.notification.successMessage).toHaveText(MESSAGES.addedToCart);
    await expect(header.cartLink).toHaveText('Shopping cart (1)');
  });

  test('[TC-33] Quantity 0 and non-numeric quantity are rejected', async ({ productPage, header }) => {
    await productPage.open(PRODUCTS.computingAndInternet.path);
    for (const qty of INVALID.qty) {
      await test.step(`Quantity "${qty}"`, async () => {
        await productPage.setQuantity(qty);
        await productPage.addToCart();
        await expect(productPage.notification.errorMessage).toHaveText(MESSAGES.quantityPositive);
        await expect(header.cartLink).toHaveText('Shopping cart (0)');
      });
    }
  });

  test('[TC-34] Negative quantity on the product page adds nothing', async ({ productPage, header }) => {
    await productPage.open(PRODUCTS.computingAndInternet.path);
    await productPage.setQuantity(INVALID.negativeQty);
    await productPage.addToCart();

    // R-23 (closed): observed on the first run, now asserted.
    await expect(productPage.notification.errorMessage).toHaveText(MESSAGES.quantityPositive);
    await expect(header.cartLink).toHaveText('Shopping cart (0)');
  });

  test('[TC-35] Home Add to cart on a configurable product opens its page', async ({ homePage, header, page }) => {
    await homePage.open();
    const product = await homePage.openProductViaAddToCart(PRODUCTS.buildYourOwnComputer.name);

    await expect(page).toHaveURL(new RegExp(`/${PRODUCTS.buildYourOwnComputer.path}$`));
    await expect(product.heading).toHaveText(PRODUCTS.buildYourOwnComputer.name);
    await expect(product.notification.root).toBeHidden();
    await expect(header.cartLink).toHaveText('Shopping cart (0)');
  });

  test('[TC-36] Add to cart from the category listing', async ({ categoryPage, header }) => {
    await categoryPage.open(LISTING.slug);
    const name = await categoryPage.addFirstAvailableProductToCart();
    recordObservation('listing-product', `added "${name}"`);

    await expect(categoryPage.notification.successMessage).toHaveText(MESSAGES.addedToCart);
    await expect(header.cartLink).toHaveText('Shopping cart (1)');
  });

  test('[TC-39] Double-click on Add to cart keeps header and cart consistent', async ({ productPage, cartPage, header }) => {
    await productPage.open(PRODUCTS.computingAndInternet.path);
    await productPage.doubleClickAddToCart();
    await cartPage.open();

    // R-25: consistency only; the count itself (1 or 2) is recorded.
    const headerCount = await header.cartCount();
    const rowQty = await cartPage.rowQuantity(PRODUCTS.computingAndInternet.name);
    recordObservation('R-25', `double-click added ${rowQty} unit(s); header shows ${headerCount}`);
    expect(headerCount).toBe(rowQty);
  });
});
