import type { Locator, Page } from '@playwright/test';
import { escapeRegExp, type GuestCustomer } from '../../test-data/demo-web-shop.data';
import { DemoWebShopHeader } from './header.page';
import { navigateBy } from './navigation';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { DemoWebShopOrderCompletedPage } from './order-completed.page';

export type CheckoutStep = 'billing' | 'shipping' | 'shipping_method' | 'payment_method' | 'payment_info' | 'confirm_order';
type ButtonContainer = 'billing' | 'shipping' | 'shipping-method' | 'payment-method' | 'payment-info' | 'confirm-order';

const COD_VALUE = 'Payments.CashOnDelivery';

/**
 * One-page checkout (/onepagecheckout), all six steps.
 *
 * Safety (D5, architecture 3.12): there is no method that selects another payment method,
 * enters card data or saves anything for a signed-in user. continueBilling() refuses to
 * run while signed in, and every COD step re-checks that Cash On Delivery is selected.
 */
export class DemoWebShopCheckoutPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;
  // Step headings are h2 inside .step-title; the steps have no landmark or role.
  readonly stepTitles: Locator;
  // Scope: the address labels repeat in other steps.
  readonly billingForm: Locator;
  readonly billingState: Locator;
  // The selected option of the Country select (its visible text).
  readonly billingCountrySelected: Locator;
  // Field messages are not associated with the inputs.
  readonly billingFieldErrors: Locator;
  readonly billingEmailError: Locator;
  readonly shippingAddressSelect: Locator;
  readonly inStorePickup: Locator;
  readonly codRadio: Locator;
  // Read only for its value attribute.
  readonly checkedPaymentMethod: Locator;
  readonly paymentInfo: Locator;
  // Private (D5): Confirm is reachable only through confirmCashOnDeliveryOrder().
  readonly #confirmButton: Locator;
  // Confirm Order summary blocks have no roles; class names from the c3 probe.
  readonly summaryBilling: Locator;
  readonly summaryShipping: Locator;
  readonly summaryPaymentMethod: Locator;
  readonly summaryShippingMethod: Locator;
  readonly summaryCartRows: Locator;
  readonly summaryTotals: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Checkout' });
    this.stepTitles = page.locator('.step-title h2');
    this.billingForm = page.locator('#billing-new-address-form');
    this.billingState = this.billingForm.getByLabel('State / province:');
    this.billingCountrySelected = this.billingForm.getByLabel('Country:', { exact: true }).locator('option:checked');
    this.billingFieldErrors = this.billingForm.locator('.field-validation-error');
    this.billingEmailError = this.billingForm.locator('.field-validation-error[data-valmsg-for="BillingNewAddress.Email"]');
    this.shippingAddressSelect = page.getByLabel('Select a shipping address from your address book or enter a new address.');
    this.inStorePickup = page.getByLabel('In-Store Pickup');
    // Two labels per payment radio (logo and text); the regex resolves to exactly 1.
    this.codRadio = this.step('payment_method').getByLabel(/Cash On Delivery/);
    this.checkedPaymentMethod = page.locator('input[name=paymentmethod]:checked');
    this.paymentInfo = this.step('payment_info');
    this.#confirmButton = this.buttonsContainer('confirm-order').getByRole('button', { name: 'Confirm' });
    const confirm = this.step('confirm_order');
    this.summaryBilling = confirm.locator('.billing-info');
    this.summaryShipping = confirm.locator('.shipping-info');
    this.summaryPaymentMethod = confirm.locator('.billing-info .payment-method');
    this.summaryShippingMethod = confirm.locator('.shipping-info .shipping-method');
    this.summaryCartRows = confirm.locator('table.cart tbody tr');
    this.summaryTotals = confirm.locator('.cart-total');
  }

  step(id: CheckoutStep): Locator {
    return this.page.locator(`#opc-${id}`);
  }

  activeStep(id: CheckoutStep): Locator {
    return this.page.locator(`#opc-${id}.active`);
  }

  billingField(label: string): Locator {
    return this.billingForm.getByLabel(label, { exact: true });
  }

  /** Instant state read for specs; the button itself is private (D5). */
  async confirmButtonVisible(): Promise<boolean> {
    return this.#confirmButton.isVisible();
  }

  /**
   * Unscoped "Continue" is ambiguous once several steps are rendered. Private (D5): Billing
   * Continue is reachable only through the signed-in-guarded continueBilling* methods.
   */
  #continueButton(container: Exclude<ButtonContainer, 'confirm-order'>): Locator {
    return this.buttonsContainer(container).getByRole('button', { name: 'Continue' });
  }

  backLink(stepId: CheckoutStep): Locator {
    return this.step(stepId).getByRole('link', { name: 'Back' });
  }

  shippingOption(name: string): Locator {
    return this.step('shipping_method').getByLabel(new RegExp(`^${escapeRegExp(name)} \\(`));
  }

  summaryCartRow(name: string): Locator {
    return this.summaryCartRows.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  summaryTotalValue(label: string): Locator {
    return this.summaryTotals
      .locator('tr')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) })
      .locator('.cart-total-right');
  }

  /** Secret-safe comparison of the prefilled billing Email (TC-52). */
  async billingEmailShows(email: string): Promise<boolean> {
    return (await this.billingField('Email:').inputValue()).trim() === email;
  }

  /** Raw navigation with no ready wait (TC-15 expects a redirect to /cart). */
  async goto(): Promise<void> {
    await this.page.goto('onepagecheckout', { waitUntil: 'domcontentloaded' });
  }

  async fillBillingAddress(guest: GuestCustomer): Promise<void> {
    await this.billingField('First name:').fill(guest.firstName);
    await this.billingField('Last name:').fill(guest.lastName);
    await this.billingField('Email:').fill(guest.email);
    await this.billingField('Country:').selectOption({ label: guest.country });
    // The state list loads by AJAX after the country is chosen.
    await this.billingState.locator('option', { hasText: guest.state }).waitFor({ state: 'attached' });
    await this.billingState.selectOption({ label: guest.state });
    await this.billingField('City:').fill(guest.city);
    await this.billingField('Address 1:').fill(guest.address1);
    await this.billingField('Zip / postal code:').fill(guest.zip);
    await this.billingField('Phone number:').fill(guest.phone);
  }

  async continueBilling(): Promise<void> {
    await this.refuseWhenSignedIn();
    await this.#continueButton('billing').click();
    await this.waitForStep('shipping', 'shipping');
  }

  /** TC-59: client-side validation keeps the billing step open. */
  async continueBillingExpectingErrors(): Promise<void> {
    await this.refuseWhenSignedIn();
    await this.#continueButton('billing').click();
    await this.billingFieldErrors.first().waitFor();
  }

  async continueShippingAddress(): Promise<void> {
    await this.#continueButton('shipping').click();
    await this.waitForStep('shipping_method', 'shipping-method');
  }

  async chooseShippingMethod(name: string): Promise<void> {
    await this.shippingOption(name).check();
  }

  async continueShippingMethod(): Promise<void> {
    await this.#continueButton('shipping-method').click();
    await this.waitForStep('payment_method', 'payment-method');
  }

  async selectCashOnDelivery(): Promise<void> {
    await this.codRadio.check();
    await this.assertCashOnDelivery();
  }

  async continuePaymentMethod(): Promise<void> {
    await this.assertCashOnDelivery();
    await this.#continueButton('payment-method').click();
    await this.waitForStep('payment_info', 'payment-info');
  }

  async continuePaymentInfo(): Promise<void> {
    await this.#continueButton('payment-info').click();
    await this.waitForStep('confirm_order', 'confirm-order');
  }

  /** Arrange composite for TC-60 / TC-61: billing to the Confirm Order summary (guest only). */
  async proceedToConfirmAsGuest(guest: GuestCustomer): Promise<void> {
    await this.fillBillingAddress(guest);
    await this.continueBilling();
    await this.continueShippingAddress();
    await this.chooseShippingMethod('Ground');
    await this.continueShippingMethod();
    await this.selectCashOnDelivery();
    await this.continuePaymentMethod();
    await this.continuePaymentInfo();
  }

  /**
   * TC-61 only. Re-checks COD on the radio and in the summary, clicks Confirm once and
   * waits for the completion page. It never clicks again.
   */
  async confirmCashOnDeliveryOrder(): Promise<DemoWebShopOrderCompletedPage> {
    if (await this.header.logoutLink.isVisible()) {
      throw new Error('D5: orders are placed only as a guest');
    }
    await this.assertCashOnDelivery();
    const summaryMethod = (await this.summaryPaymentMethod.innerText()).trim();
    if (!summaryMethod.includes('Cash On Delivery (COD)')) {
      throw new Error(`Refusing to confirm: summary payment method is "${summaryMethod}"`);
    }
    await navigateBy(this.page, () => this.#confirmButton.click(), /\/checkout\/completed/);
    const completed = new DemoWebShopOrderCompletedPage(this.page);
    await completed.heading.waitFor();
    return completed;
  }

  /** Clicks Back on a step and waits for the previous step to become active. */
  async goBackFrom(stepId: CheckoutStep): Promise<void> {
    const order: CheckoutStep[] = ['billing', 'shipping', 'shipping_method', 'payment_method', 'payment_info', 'confirm_order'];
    const index = order.indexOf(stepId);
    if (index < 1) {
      throw new Error(`There is no step before ${stepId}`);
    }
    await this.backLink(stepId).click();
    await this.activeStep(order[index - 1]).waitFor();
  }

  /** D5 guard: signed-in checkout must never leave the Billing step. */
  private async refuseWhenSignedIn(): Promise<void> {
    if (await this.header.logoutLink.isVisible()) {
      throw new Error('D5: signed-in checkout must stop at Billing');
    }
  }

  private buttonsContainer(container: ButtonContainer): Locator {
    return this.page.locator(`#${container}-buttons-container`);
  }

  private async waitForStep(stepId: CheckoutStep, container: ButtonContainer): Promise<void> {
    await this.activeStep(stepId).waitFor();
    await this.buttonsContainer(container).waitFor();
  }

  /** Safety guard (architecture 3.12): throws unless Cash On Delivery is the checked method. */
  private async assertCashOnDelivery(): Promise<void> {
    const value = await this.checkedPaymentMethod.getAttribute('value');
    if (value !== COD_VALUE) {
      throw new Error(`Refusing to continue: payment method is "${value}", only ${COD_VALUE} is allowed`);
    }
  }
}
