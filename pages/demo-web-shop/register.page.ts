import type { Locator, Page } from '@playwright/test';
import { DemoWebShopHeader } from './header.page';
import { navigateBy } from './navigation';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { fillAccountValue } from './secret-input';

export type RegisterField = 'FirstName' | 'LastName' | 'Email' | 'Password' | 'ConfirmPassword';

/**
 * Registration form. There is deliberately no register() method and no generator of
 * registrable emails: the suite must never create accounts (intake decision).
 */
export class DemoWebShopRegisterPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly male: Locator;
  readonly female: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly registerButton: Locator;
  // Server validation summary has no role.
  readonly errorSummary: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    // exact: "Male" is a substring of "Female".
    this.male = page.getByLabel('Male', { exact: true });
    this.female = page.getByLabel('Female', { exact: true });
    this.firstName = page.getByLabel('First name:');
    this.lastName = page.getByLabel('Last name:');
    this.email = page.getByLabel('Email:', { exact: true });
    // exact: "Confirm password:" also contains "Password:".
    this.password = page.getByLabel('Password:', { exact: true });
    this.confirmPassword = page.getByLabel('Confirm password:');
    this.registerButton = page.getByRole('button', { name: 'Register' });
    this.errorSummary = page.locator('.validation-summary-errors');
  }

  /** Field message element; it is not associated with its input, so data-valmsg-for is used. */
  fieldError(field: RegisterField): Locator {
    return this.page.locator(`.field-validation-error[data-valmsg-for="${field}"]`);
  }

  async open(): Promise<this> {
    await this.page.goto('register', { waitUntil: 'domcontentloaded' });
    await this.registerButton.waitFor();
    return this;
  }

  /** Client-side validation blocks the submit, so no navigation happens. */
  async submitEmpty(): Promise<void> {
    await this.registerButton.click();
    await this.fieldError('FirstName').waitFor();
  }

  async enterEmailAndBlur(value: string): Promise<void> {
    await this.email.fill(value);
    await this.email.press('Tab');
  }

  async enterPasswordAndBlur(value: string): Promise<void> {
    await this.password.fill(value);
    await this.password.press('Tab');
  }

  async enterConfirmPasswordAndBlur(value: string): Promise<void> {
    await this.confirmPassword.fill(value);
    await this.confirmPassword.press('Tab');
  }

  /** TC-20: valid form with an email that already exists. No account can be created. */
  async attemptDuplicateRegistration(data: { firstName: string; lastName: string; email: string; password: string }): Promise<void> {
    await this.firstName.fill(data.firstName);
    await this.lastName.fill(data.lastName);
    // The email is an account value (existingUser): keep it out of report step titles (P9).
    await fillAccountValue(this.email, data.email);
    await this.password.fill(data.password);
    await this.confirmPassword.fill(data.password);
    await navigateBy(this.page, () => this.registerButton.click());
    await this.errorSummary.waitFor();
  }
}
