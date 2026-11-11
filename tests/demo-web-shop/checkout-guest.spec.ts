import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { CHECKOUT_STEP_TITLES, HEALTH_BOOK_COD_ORDER, INVALID, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

// Guest checkout never clicks Confirm here (only TC-61 places an order).
// Health Book is used because Ground costs 10.00 for it (Computing and Internet ships free).
const product = PRODUCTS.healthBook;

test.describe('Guest checkout', () => {
  test('[TC-15] Direct checkout with an empty guest cart redirects to the cart', async ({ checkoutPage, cartPage, page }) => {
    await checkoutPage.goto();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
  });

  test.describe('with one item', () => {
    test.beforeEach(async ({ productPage, cartPage }) => {
      await test.step(`Arrange: add "${product.name}" and open the cart`, async () => {
        await productPage.open(product.path);
        await productPage.addToCart();
        await cartPage.open();
      });
    });

    test('[TC-58] Guest reaches checkout via Checkout as Guest', async ({ cartPage, page }) => {
      const loginPage = await cartPage.acceptTermsAndCheckoutAsGuest();

      await expect(page).toHaveURL(/\/login\/checkoutasguest\?returnUrl=%2Fcart$/i);
      await expect(loginPage.heading).toHaveText(MESSAGES.loginHeading);
      await expect(loginPage.checkoutAsGuestButton).toBeVisible();
      await expect(loginPage.registerButton).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();

      const checkoutPage = await loginPage.checkoutAsGuest();
      await expect(page).toHaveURL(/\/onepagecheckout$/);
      await expect(checkoutPage.heading).toBeVisible();
      // The DOM text is lower case ("Billing address"); CSS text-transform renders the visible titles.
      await expect(checkoutPage.stepTitles).toHaveText([...CHECKOUT_STEP_TITLES], { useInnerText: true });
      await expect(checkoutPage.billingForm).toBeVisible();
    });

    test('[TC-59] Billing step enforces required fields and email format', async ({ cartPage }) => {
      const checkoutPage = await (await cartPage.acceptTermsAndCheckoutAsGuest()).checkoutAsGuest();

      await test.step('Continue with empty fields', async () => {
        await checkoutPage.continueBillingExpectingErrors();
        await expect(checkoutPage.billingFieldErrors).toHaveText([...MESSAGES.billingErrors]);
        await expect(checkoutPage.activeStep('billing')).toBeVisible();
      });
      await test.step('Continue with a malformed email', async () => {
        await checkoutPage.billingField('Email:').fill(INVALID.email);
        await checkoutPage.continueBillingExpectingErrors();
        await expect(checkoutPage.billingEmailError).toHaveText(MESSAGES.wrongEmail);
        await expect(checkoutPage.activeStep('billing')).toBeVisible();
      });
    });

    test('[TC-60] Guest checkout reaches the Confirm Order summary without placing an order', async ({ cartPage, uniqueGuest, header }) => {
      test.slow();
      const checkoutPage = await (await cartPage.acceptTermsAndCheckoutAsGuest()).checkoutAsGuest();

      await test.step('Billing Address', async () => {
        await checkoutPage.fillBillingAddress(uniqueGuest);
        await checkoutPage.continueBilling();
        await expect(checkoutPage.activeStep('shipping')).toBeVisible();
      });
      await test.step('Shipping Address: keep the preselected address', async () => {
        await checkoutPage.continueShippingAddress();
        await expect(checkoutPage.activeStep('shipping_method')).toBeVisible();
      });
      await test.step('Shipping Method: Ground', async () => {
        await expect(checkoutPage.shippingOption('Ground')).toBeChecked();
        await checkoutPage.continueShippingMethod();
        await expect(checkoutPage.activeStep('payment_method')).toBeVisible();
      });
      await test.step('Payment Method: Cash On Delivery', async () => {
        await expect(checkoutPage.codRadio).toBeChecked();
        await expect(checkoutPage.checkedPaymentMethod).toHaveAttribute('value', 'Payments.CashOnDelivery');
        await checkoutPage.continuePaymentMethod();
        await expect(checkoutPage.activeStep('payment_info')).toBeVisible();
      });
      await test.step('Payment Information', async () => {
        await expect(checkoutPage.paymentInfo).toContainText(MESSAGES.payByCod);
        await checkoutPage.continuePaymentInfo();
        await expect(checkoutPage.activeStep('confirm_order')).toBeVisible();
      });

      await test.step('Confirm Order summary (Confirm is not selected)', async () => {
        for (const line of HEALTH_BOOK_COD_ORDER.summaryAddressLines) {
          await expect(checkoutPage.summaryBilling).toContainText(line);
        }
        await expect(checkoutPage.summaryPaymentMethod).toHaveText(MESSAGES.codMethodName);
        await expect(checkoutPage.summaryShippingMethod).toHaveText(HEALTH_BOOK_COD_ORDER.shippingMethod);
        const { row } = HEALTH_BOOK_COD_ORDER;
        await expect(checkoutPage.summaryCartRow(row.name)).toContainText([row.name, row.price, row.qty, row.total].join(' '), { useInnerText: true });
        for (const [label, value] of Object.entries(HEALTH_BOOK_COD_ORDER.confirmTotals)) {
          await expect(checkoutPage.summaryTotalValue(label), label).toHaveText(value);
        }
        expect(await checkoutPage.confirmButtonVisible(), 'Confirm button is shown (not selected)').toBe(true);
      });

      await test.step('Cleanup: empty the guest cart', async () => {
        await cartPage.open();
        await cartPage.removeProduct(product.name);
        await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
        await expect(header.cartLink).toHaveText('Shopping cart (0)');
      });
    });

    test('[TC-62] Back on the Shipping Address step returns to Billing', async ({ cartPage, uniqueGuest, page }) => {
      const checkoutPage = await (await cartPage.acceptTermsAndCheckoutAsGuest()).checkoutAsGuest();
      await checkoutPage.fillBillingAddress(uniqueGuest);
      await checkoutPage.continueBilling();

      await checkoutPage.goBackFrom('shipping');

      await expect(checkoutPage.activeStep('billing')).toBeVisible();
      await expect(checkoutPage.activeStep('shipping')).toHaveCount(0);
      await expect(page).toHaveURL(/\/onepagecheckout$/);
      recordObservation('R-28', `billing form visible after Back: ${await checkoutPage.billingForm.isVisible()}`);
    });
  });
});
