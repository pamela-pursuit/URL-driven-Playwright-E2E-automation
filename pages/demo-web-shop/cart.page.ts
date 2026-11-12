import type { Locator, Page } from '@playwright/test';
import { escapeRegExp, MESSAGES } from '../../test-data/demo-web-shop.data';
import { DemoWebShopCheckoutPage } from './checkout.page';
import { DemoWebShopHeader } from './header.page';
import { DemoWebShopLoginPage } from './login.page';
import { navigateBy, waitForImagesComplete, waitForReadyOrServerError } from './navigation';
import { cartContent } from './ready-locators';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { removeReservedRows, snapshotRows, type PurgeResult, type RowSnapshot } from './reserved-rows';

export class DemoWebShopCartPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;
  // Container holding the table or the empty message "Your Shopping Cart is empty!" (probe P4).
  readonly content: Locator;
  readonly productColumnHeader: Locator;
  // getByRole('table') gives 2 on this page; the cart table has class "cart".
  readonly rows: Locator;
  readonly updateCartButton: Locator;
  readonly continueShoppingButton: Locator;
  // No label; getByRole('checkbox') gives 2 with one item.
  readonly termsCheckbox: Locator;
  readonly checkoutButton: Locator;
  readonly termsDialog: Locator;
  // No label on the coupon and gift card inputs.
  readonly couponInput: Locator;
  readonly giftCardInput: Locator;
  readonly applyCouponButton: Locator;
  readonly addGiftCardButton: Locator;
  // Message containers verified by probe P4 (implementation probes).
  readonly couponMessage: Locator;
  readonly giftCardMessage: Locator;
  readonly country: Locator;
  readonly state: Locator;
  readonly zip: Locator;
  readonly estimateShippingButton: Locator;
  // Estimate-shipping results container and option names (probe P4).
  readonly shippingOptions: Locator;
  readonly shippingOptionNames: Locator;
  // Totals table (Sub-Total, Shipping, Tax, Total) without roles.
  readonly totals: Locator;
  // The site's generic error page (environment failure on a cart form POST).
  readonly serverError: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Shopping cart' });
    this.content = cartContent(page);
    this.productColumnHeader = page.getByRole('columnheader', { name: 'Product(s)' });
    this.rows = page.locator('table.cart tbody tr');
    this.updateCartButton = page.getByRole('button', { name: 'Update shopping cart' });
    this.continueShoppingButton = page.getByRole('button', { name: 'Continue shopping' });
    this.termsCheckbox = page.locator('#termsofservice');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
    this.termsDialog = page.getByRole('dialog', { name: 'Terms of service' });
    this.couponInput = page.locator('input[name=discountcouponcode]');
    this.giftCardInput = page.locator('input[name=giftcardcouponcode]');
    this.applyCouponButton = page.getByRole('button', { name: 'Apply coupon' });
    this.addGiftCardButton = page.getByRole('button', { name: 'Add gift card' });
    this.couponMessage = page.locator('.coupon-box .message');
    this.giftCardMessage = page.locator('.giftcard-box .message');
    this.country = page.getByLabel('Country:');
    this.state = page.getByLabel('State / province:');
    this.zip = page.getByLabel('Zip / postal code:');
    this.estimateShippingButton = page.getByRole('button', { name: 'Estimate shipping' });
    this.shippingOptions = page.locator('.shipping-results');
    this.shippingOptionNames = this.shippingOptions.locator('.option-name');
    this.totals = page.locator('.cart-total');
    this.serverError = page.getByText(MESSAGES.serverError);
  }

  /** exact: "Computing and Internet" must not match "Copy of Computing and Internet EX". */
  row(name: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  // No accessible name on the row checkbox, quantity input or total cell.
  rowRemoveCheckbox(name: string): Locator {
    return this.row(name).locator('input[name=removefromcart]');
  }

  rowQuantityInput(name: string): Locator {
    return this.row(name).locator('input.qty-input');
  }

  /** DEF-007: the row thumbnail (decorative product image, so located by tag). */
  rowImage(name: string): Locator {
    return this.row(name).locator('img');
  }

  rowTotal(name: string): Locator {
    return this.row(name).locator('.product-subtotal');
  }

  /** Value cell of a totals row; the label is matched from the start ("Total:" is not "Sub-Total:"). */
  totalValue(label: string): Locator {
    return this.totals
      .locator('tr')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) })
      .locator('.cart-total-right');
  }

  async open(): Promise<this> {
    await this.page.goto('cart', { waitUntil: 'domcontentloaded' });
    await this.content.waitFor();
    await this.waitForRowImages();
    return this;
  }

  /** Browser reload (never waits for `load`), then the cart ready wait. */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.content.waitFor();
    await this.waitForRowImages();
  }

  async productNames(): Promise<string[]> {
    return (await snapshotRows(this.rows)).map((row) => row.name);
  }

  async snapshot(): Promise<RowSnapshot[]> {
    return snapshotRows(this.rows);
  }

  async rowQuantity(name: string): Promise<number> {
    return Number(await this.rowQuantityInput(name).inputValue());
  }

  async setQuantity(name: string, qty: string): Promise<void> {
    await this.rowQuantityInput(name).fill(qty);
  }

  /** Form POST back to /cart. */
  async updateCart(): Promise<void> {
    await navigateBy(this.page, () => this.updateCartButton.click(), /\/cart/);
    await waitForReadyOrServerError(this.content, this.serverError, 'Update shopping cart');
    await this.waitForRowImages();
  }

  /** Row thumbnails have no size; wait for them so controls do not shift under a click. */
  async waitForRowImages(): Promise<void> {
    await waitForImagesComplete(this.page, 'table.cart tbody tr img');
  }

  async removeProduct(name: string): Promise<void> {
    await this.rowRemoveCheckbox(name).check();
    await this.updateCart();
  }

  /** Cleaner primitive (D1): removes only reserved rows, guarded (architecture 4.4). */
  async removeReservedRows(names: readonly string[]): Promise<PurgeResult> {
    return removeReservedRows({
      rows: this.rows,
      names,
      removeCheckbox: (name) => this.rowRemoveCheckbox(name),
      submit: () => this.updateCart()
    });
  }

  /** Ensures terms are unticked, clicks Checkout and waits for the jQuery UI dialog. */
  async attemptCheckoutWithoutTerms(): Promise<void> {
    await this.termsCheckbox.uncheck();
    await this.checkoutButton.click();
    await this.termsDialog.waitFor();
  }

  /** Escape closes the dialog (jQuery UI closeOnEscape, implementation probe P6). */
  async closeTermsDialog(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.termsDialog.waitFor({ state: 'hidden' });
  }

  async acceptTermsAndCheckoutAsGuest(): Promise<DemoWebShopLoginPage> {
    await this.termsCheckbox.check();
    await navigateBy(this.page, () => this.checkoutButton.click(), /\/login\/checkoutasguest/i);
    const login = new DemoWebShopLoginPage(this.page);
    await login.heading.waitFor();
    return login;
  }

  async acceptTermsAndCheckoutSignedIn(): Promise<DemoWebShopCheckoutPage> {
    await this.termsCheckbox.check();
    await navigateBy(this.page, () => this.checkoutButton.click(), /\/onepagecheckout/);
    const checkout = new DemoWebShopCheckoutPage(this.page);
    await checkout.activeStep('billing').waitFor();
    return checkout;
  }

  async applyCoupon(code: string): Promise<void> {
    await this.couponInput.fill(code);
    await navigateBy(this.page, () => this.applyCouponButton.click(), /\/cart/);
    await waitForReadyOrServerError(this.content, this.serverError, 'Apply coupon');
    await this.couponMessage.waitFor();
  }

  async applyGiftCard(code: string): Promise<void> {
    await this.giftCardInput.fill(code);
    await navigateBy(this.page, () => this.addGiftCardButton.click(), /\/cart/);
    await waitForReadyOrServerError(this.content, this.serverError, 'Add gift card');
    await this.giftCardMessage.waitFor();
  }

  /** The state list loads by AJAX after the country is chosen. */
  async estimateShipping(options: { country: string; state?: string; zip: string }): Promise<void> {
    await this.country.selectOption({ label: options.country });
    if (options.state) {
      await this.state.locator('option', { hasText: options.state }).waitFor({ state: 'attached' });
      await this.state.selectOption({ label: options.state });
    }
    await this.zip.fill(options.zip);
    await navigateBy(this.page, () => this.estimateShippingButton.click(), /\/cart/);
    await waitForReadyOrServerError(this.content, this.serverError, 'Estimate shipping');
    await this.shippingOptions.waitFor();
  }
}
