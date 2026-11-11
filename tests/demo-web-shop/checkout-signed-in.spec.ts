import { expect, test } from '../../fixtures/demo-web-shop.fixture';
import { CHECKOUT_STEP_TITLES, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

// P9: account values must not reach report artifacts. Values are filled without step titles
// (fillAccountValue); a trace would still record evaluate arguments and signed-in DOM snapshots,
// so tracing is off for this file (trace is worker-scoped, so it cannot be set per describe).
test.use({ trace: 'off' });

// D5: signed-in checkout stops at Billing. Continue is never selected (continueBilling() throws
// while signed in), so nothing is saved to the account.
test.describe('Signed-in checkout', () => {
  test(
    '[TC-52] Signed-in checkout reaches Billing with prefilled details',
    { tag: ['@mutates-account'] },
    async ({ accountCartCleaner, productPage, cartPage, existingUser, page }) => {
      void accountCartCleaner;
      await test.step('Arrange: add "Health Book" and open the cart', async () => {
        await productPage.open(PRODUCTS.healthBook.path);
        await productPage.addToCart();
        await cartPage.open();
      });

      await test.step('Checkout without accepting the terms', async () => {
        await cartPage.attemptCheckoutWithoutTerms();
        await expect(cartPage.termsDialog).toContainText(MESSAGES.termsRequired);
        await expect(page).toHaveURL(/\/cart$/);
        await cartPage.closeTermsDialog();
      });

      const checkoutPage = await cartPage.acceptTermsAndCheckoutSignedIn();

      await expect(page).toHaveURL(/\/onepagecheckout$/);
      await expect(checkoutPage.heading).toBeVisible();
      // The DOM text is lower case ("Billing address"); CSS text-transform renders the visible titles.
      await expect(checkoutPage.stepTitles).toHaveText([...CHECKOUT_STEP_TITLES], { useInnerText: true });
      await expect(checkoutPage.billingField('First name:')).not.toHaveValue('');
      await expect(checkoutPage.billingField('Last name:')).not.toHaveValue('');
      expect(await checkoutPage.billingEmailShows(existingUser.email), 'billing Email is prefilled with the existingUser email').toBe(true);
      await expect(checkoutPage.billingCountrySelected).toHaveText('Select country');
    }
  );
});
