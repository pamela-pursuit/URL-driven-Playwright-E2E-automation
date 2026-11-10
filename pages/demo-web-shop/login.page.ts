import type { Locator, Page } from '@playwright/test';
import { DemoWebShopCheckoutPage } from './checkout.page';
import { DemoWebShopHeader } from './header.page';
import { navigateBy } from './navigation';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { fillAccountValue } from './secret-input';

export type SignInOutcome = 'signed-in' | 'rejected' | 'invalid-field';

/** Covers /login and /login/checkoutasguest (same template and h1). */
export class DemoWebShopLoginPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly rememberMe: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  // Server validation summary has no role.
  readonly errorSummary: Locator;
  // Client-side field message, not associated with the input.
  readonly emailFieldError: Locator;
  readonly checkoutAsGuestButton: Locator;
  readonly registerButton: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Welcome, Please Sign In!' });
    this.emailInput = page.getByLabel('Email:');
    this.passwordInput = page.getByLabel('Password:');
    this.rememberMe = page.getByLabel('Remember me?');
    this.loginButton = page.getByRole('button', { name: 'Log in' });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    this.errorSummary = page.locator('.validation-summary-errors');
    this.emailFieldError = page.locator('.field-validation-error[data-valmsg-for="Email"]');
    this.checkoutAsGuestButton = page.getByRole('button', { name: 'Checkout as Guest' });
    this.registerButton = page.getByRole('button', { name: 'Register' });
  }

  async open(): Promise<this> {
    await this.page.goto('login', { waitUntil: 'domcontentloaded' });
    await this.heading.waitFor();
    return this;
  }

  /**
   * Fills and submits. The values never appear in report step titles (fillAccountValue, P9).
   * The outcome comes from the visible state.
   */
  async signIn(email: string, password: string): Promise<SignInOutcome> {
    await fillAccountValue(this.emailInput, email);
    await fillAccountValue(this.passwordInput, password);
    await this.loginButton.click();
    return this.waitForOutcome();
  }

  async submitEmpty(): Promise<void> {
    await navigateBy(this.page, () => this.loginButton.click());
    await this.errorSummary.waitFor();
  }

  async enterEmailAndBlur(value: string): Promise<void> {
    await this.emailInput.fill(value);
    await this.emailInput.press('Tab');
    await this.emailFieldError.waitFor();
  }

  async checkoutAsGuest(): Promise<DemoWebShopCheckoutPage> {
    await navigateBy(this.page, () => this.checkoutAsGuestButton.click(), /\/onepagecheckout/);
    const checkout = new DemoWebShopCheckoutPage(this.page);
    await checkout.activeStep('billing').waitFor();
    return checkout;
  }

  private async waitForOutcome(): Promise<SignInOutcome> {
    await this.header.logoutLink.or(this.errorSummary).or(this.emailFieldError).first().waitFor();
    if (await this.header.logoutLink.isVisible()) {
      return 'signed-in';
    }
    if (await this.errorSummary.isVisible()) {
      return 'rejected';
    }
    return 'invalid-field';
  }
}
