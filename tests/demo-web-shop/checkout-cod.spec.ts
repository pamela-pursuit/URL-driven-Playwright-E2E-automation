import { expect, recordObservation, test } from '../../fixtures/demo-web-shop.fixture';
import { HEALTH_BOOK_COD_ORDER, MESSAGES, PRODUCTS } from '../../test-data/demo-web-shop.data';

// D5 / D7 / R-06: places ONE permanent Cash On Delivery order per browser per run (3 per full run),
// as a guest with fictional data. Never retried (a retry would place an extra order); never --repeat-each.
// The checkout page object refuses to continue or confirm unless Payments.CashOnDelivery is selected.
test.describe.configure({ retries: 0 });

test.describe('Cash On Delivery order', () => {
  test(
    '[TC-61] Guest places a Cash On Delivery order end to end',
    { tag: ['@places-order'] },
    async ({ productPage, cartPage, uniqueGuest, page }) => {
      // D5 / R-06: one permanent order per run; --repeat-each would place more.
      if (test.info().repeatEachIndex > 0) {
        throw new Error('D5: TC-61 must not be repeated');
      }
      test.slow();
      const checkoutPage = await test.step('Arrange: Health Book in a guest cart, through to Confirm Order', async () => {
        await productPage.open(PRODUCTS.healthBook.path);
        await productPage.addToCart();
        await cartPage.open();
        const checkout = await (await cartPage.acceptTermsAndCheckoutAsGuest()).checkoutAsGuest();
        await checkout.proceedToConfirmAsGuest(uniqueGuest);
        return checkout;
      });
      await expect(checkoutPage.checkedPaymentMethod).toHaveAttribute('value', 'Payments.CashOnDelivery');

      const completedPage = await test.step('Confirm once', async () => checkoutPage.confirmCashOnDeliveryOrder());

      await expect(page).toHaveURL(/\/checkout\/completed\/?$/);
      await expect(completedPage.heading).toHaveText(MESSAGES.orderThankYou);
      await expect(completedPage.details).toContainText(MESSAGES.orderSuccess);
      await expect(completedPage.details).toContainText(/Order number:\s*\d+/);
      await expect(completedPage.orderDetailsLink).toBeVisible();
      const orderNumber = await completedPage.orderNumber();
      recordObservation('order-number', orderNumber);

      const orderPage = await completedPage.openOrderDetails();
      await expect(page).toHaveURL(new RegExp(`/orderdetails/${orderNumber}$`));
      await expect(orderPage.heading).toHaveText(MESSAGES.orderInformation);
      await expect(orderPage.pageBody).toContainText(`Order #${orderNumber}`, { useInnerText: true });
      for (const text of HEALTH_BOOK_COD_ORDER.orderDetailsTexts) {
        await expect(orderPage.pageBody, text).toContainText(text, { useInnerText: true });
      }
      const { row } = HEALTH_BOOK_COD_ORDER;
      await expect(orderPage.productRow(row.name)).toContainText([row.name, row.price, row.qty, row.total].join(' '), { useInnerText: true });

      await cartPage.open();
      await expect(cartPage.content).toHaveText(MESSAGES.cartEmpty);
    }
  );
});
