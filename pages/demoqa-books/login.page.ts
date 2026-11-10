import { expect, type Locator, type Page } from '@playwright/test';
import { DemoqaAlerts } from './alerts';
import { clickUntilInvalid, documentScrollWidth, fillAndConfirm, LOGIN_REDIRECT_MS, READY_MS, waitForHydration } from './app-ready';
import { DemoqaRegisterPage } from './register.page';
import { DemoqaSideMenu } from './side-menu.page';
import { fillSecretValue, inputHasValue } from './secret-input';

export type SignInOutcome = 'signed-in' | 'rejected' | 'invalid-field';
type PendingOutcome = SignInOutcome | 'pending';

/** /login */
export class DemoqaLoginPage {
  readonly menu: DemoqaSideMenu;
  readonly heading: Locator;
  readonly form: Locator;
  readonly userNameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly newUserButton: Locator;
  readonly errorMessage: Locator;
  readonly invalidInputs: Locator;

  constructor(private readonly page: Page) {
    DemoqaAlerts.for(page);
    this.menu = new DemoqaSideMenu(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Login' });
    // Form scope: the left menu also has a "Login" entry (a link) and #userName is reused on /register.
    this.form = page.locator('#userForm');
    // Labels are not associated with the inputs (discovery 3.3); placeholders are verified.
    this.userNameInput = this.form.getByPlaceholder('UserName', { exact: true });
    this.passwordInput = this.form.getByPlaceholder('Password', { exact: true });
    this.loginButton = this.form.getByRole('button', { name: 'Login', exact: true });
    this.newUserButton = this.form.getByRole('button', { name: 'New User', exact: true });
    // The error paragraph has no role; id "name" is the only stable hook (verified).
    this.errorMessage = page.locator('p#name');
    // The client marks fields with class is-invalid; no text message exists.
    this.invalidInputs = this.form.locator('input.is-invalid');
  }

  async open(): Promise<this> {
    await this.page.goto('login', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    return this;
  }

  async documentScrollWidth(): Promise<number> {
    return documentScrollWidth(this.page);
  }

  async waitForReady(): Promise<void> {
    await this.heading.waitFor({ timeout: READY_MS });
    await waitForHydration(this.loginButton);
  }

  /**
   * Fills both fields without putting the values in report steps (K6) and submits. Never logs the
   * arguments. An 'invalid-field' outcome sends no request (probe P6), so one refill and resubmit
   * is safe; a rejection is returned to the caller and never retried.
   */
  async signIn(userName: string, password: string): Promise<SignInOutcome> {
    let outcome = await this.fillAndSubmit(userName, password);
    if (outcome === 'invalid-field') {
      outcome = await this.fillAndSubmit(userName, password);
    }
    return outcome;
  }

  async submitEmpty(): Promise<void> {
    await clickUntilInvalid(this.loginButton, this.invalidInputs);
  }

  /** Non-secret (fake) user names only. */
  async submitWithUserNameOnly(userName: string): Promise<void> {
    await fillAndConfirm(this.userNameInput, userName);
    await clickUntilInvalid(this.loginButton, this.invalidInputs);
  }

  /** '' when p#name is absent or empty. */
  async errorText(): Promise<string> {
    if ((await this.errorMessage.count()) === 0) {
      return '';
    }
    return ((await this.errorMessage.textContent()) ?? '').trim();
  }

  async openRegister(): Promise<DemoqaRegisterPage> {
    const register = new DemoqaRegisterPage(this.page);
    await Promise.all([
      this.page.waitForURL(/\/register$/, { waitUntil: 'domcontentloaded' }),
      this.newUserButton.click()
    ]);
    await register.waitForReady();
    return register;
  }

  private async fillAndSubmit(userName: string, password: string): Promise<SignInOutcome> {
    await fillSecretValue(this.userNameInput, userName);
    await fillSecretValue(this.passwordInput, password);
    // A value lost to a re-render right after load (R-01) is filled once more before submitting.
    if (!(await inputHasValue(this.userNameInput, userName))) {
      await fillSecretValue(this.userNameInput, userName);
    }
    if (!(await inputHasValue(this.passwordInput, password))) {
      await fillSecretValue(this.passwordInput, password);
    }
    await this.loginButton.click();
    let outcome = 'pending' as PendingOutcome;
    await expect
      .poll(
        async () => {
          outcome = await this.currentOutcome();
          return outcome;
        },
        { message: 'Login reaches /profile or shows an error (R-12)', timeout: LOGIN_REDIRECT_MS }
      )
      .not.toBe('pending');
    return outcome as SignInOutcome;
  }

  private async currentOutcome(): Promise<PendingOutcome> {
    if (/\/profile$/.test(new URL(this.page.url()).pathname)) {
      return 'signed-in';
    }
    if ((await this.errorMessage.isVisible()) && (await this.errorText()) !== '') {
      return 'rejected';
    }
    if ((await this.invalidInputs.count()) > 0) {
      return 'invalid-field';
    }
    return 'pending';
  }
}
