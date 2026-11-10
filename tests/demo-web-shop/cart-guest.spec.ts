import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { ESTIMATE_SHIPPING, formatPrice, INVALID, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

const product = PRODUCTS.computingAndInternet;

// Each test has a fresh browser context, so a fresh guest cart; no cleanup is needed.
test.describe('Guest cart', () => {
  test.describe('with one item', () => {
    test.beforeEach(async ({ productPage, cartPage }) => {
      await test.step(`Arrange: add "${product.name}" and open the cart`, async () => {
        await productPage.open(product.path);
        await productPage.addToCart();
        await cartPage.open();
      });
    });

    test('[DWS-040] Updating quantity recalculates cart totals', async ({ cartPage, header }) => {
      await cartPage.setQuantity(product.name, '3');
      await cartPage.updateCart();

      const expected = formatPrice(product.price * 3);
      await expect(cartPage.rowTotal(product.name)).toHaveText(expected);
      await expect(cartPage.totalValue('Sub-Total:')).toHaveText(expected);
      await expect(cartPage.totalValue('Total:')).toHaveText(expected);
      await expect(header.cartLink).toHaveText('Shopping cart (3)');
    });

    test('[DWS-041] Removing the only item empties the cart', async ({ cartPage, header }) => {
      await cartPage.removeProduct(product.name);

      await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
      await expect(header.cartLink).toHaveText('Shopping cart (0)');
    });

    test('[DWS-042] Quantity 0 removes the row; quantity -1 is rejected', async ({ cartPage, productPage, header }) => {
      await test.step('Quantity 0', async () => {
        await cartPage.setQuantity(product.name, '0');
        await cartPage.updateCart();
        await expect(cartPage.rows).toHaveCount(0);
        // Exact text: the content holds only the empty message, no warning.
        await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
        await expect(header.cartLink).toHaveText('Shopping cart (0)');
      });
      await test.step('Quantity -1', async () => {
        await productPage.open(product.path);
        await productPage.addToCart();
        await cartPage.open();
        await cartPage.setQuantity(product.name, INVALID.negativeQty);
        await cartPage.updateCart();
        // Known defect DEF-006: fails while -1 silently removes the item.
        await expect(cartPage.row(product.name), 'DEF-006: quantity -1 is rejected, the item stays in the cart')
          .toBeVisible({ timeout: 2_000 });
      });
    });

    test('[DWS-043] Checkout is blocked until terms of service are accepted', async ({ cartPage, page }) => {
      await cartPage.attemptCheckoutWithoutTerms();

      await expect(cartPage.termsDialog).toContainText(MESSAGES.termsRequired);
      await expect(page).toHaveURL(/\/cart$/);
    });

    test('[DWS-044] Invalid coupon code is rejected', async ({ cartPage }) => {
      const totalBefore = (await cartPage.totalValue('Total:').innerText()).trim();
      await cartPage.applyCoupon(INVALID.coupon);

      await expect(cartPage.couponMessage).toHaveText(MESSAGES.couponInvalid);
      await expect(cartPage.totalValue('Total:')).toHaveText(totalBefore);
    });

    test('[DWS-045] Invalid gift card code shows a gift card message, not the coupon message', async ({ cartPage }) => {
      await cartPage.applyGiftCard(INVALID.giftCard);

      await expect(cartPage.giftCardMessage).toBeVisible();
      // Known defect DEF-004: fails while the gift card error reuses the coupon text.
      await expect(cartPage.giftCardMessage, 'DEF-004: gift card error is not the coupon text')
        .not.toHaveText(MESSAGES.couponInvalid, { timeout: 2_000 });
    });

    test('[DWS-047] Estimate shipping lists shipping options', async ({ cartPage }) => {
      await cartPage.estimateShipping({ country: ESTIMATE_SHIPPING.country, zip: ESTIMATE_SHIPPING.zip });

      // "Computing and Internet" has free shipping (its product page says so), so every option is 0.00.
      // Health Book, which has no free shipping, estimates Ground (10.00), matching checkout (DEF-001 Rejected).
      await expect(cartPage.shippingOptionNames).toHaveText([...ESTIMATE_SHIPPING.options]);
    });

    test('[DWS-048] Guest cart persists after a page refresh', async ({ cartPage, header }) => {
      await cartPage.reload();

      await expect(cartPage.row(product.name)).toBeVisible();
      await expect(cartPage.rowQuantityInput(product.name)).toHaveValue('1');
      await expect(header.cartLink).toHaveText('Shopping cart (1)');
    });
  });

  test('[DWS-046] New guest sees the empty cart state', async ({ cartPage, header }) => {
    await cartPage.open();

    await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
    await expect(header.cartLink).toHaveText('Shopping cart (0)');
    await expect(cartPage.checkoutButton).toHaveCount(0);
  });
});
