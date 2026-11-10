import { expect, type Locator, type Page } from '@playwright/test';
import { API, STRONG_PASSWORD_RULE } from '../../test-data/demoqa-books.data';
import { DemoqaAlerts } from './alerts';
import { clickUntilInvalid, fillAndConfirm, READY_MS, waitForHydration } from './app-ready';
import { DemoqaLoginPage } from './login.page';

export interface RegisterForm {
  firstName: string;
  lastName: string;
  userName: string;
  password: string;
}

/** /register. No method can create an account (R-07). */
export class DemoqaRegisterPage {
  readonly heading: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly userName: Locator;
  readonly password: Locator;
  readonly registerButton: Locator;
  readonly backToLoginButton: Locator;
  readonly errorMessage: Locator;
  readonly invalidInputs: Locator;
  readonly inputs: readonly Locator[];
  private readonly captchaToken: Locator;

  constructor(private readonly page: Page) {
    DemoqaAlerts.for(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Register' });
    // Labels are not associated with the inputs (discovery 3.4); placeholders are verified.
    this.firstName = page.getByPlaceholder('First Name', { exact: true });
    this.lastName = page.getByPlaceholder('Last Name', { exact: true });
    this.userName = page.getByPlaceholder('UserName', { exact: true });
    this.password = page.getByPlaceholder('Password', { exact: true });
    this.registerButton = page.getByRole('button', { name: 'Register', exact: true });
    this.backToLoginButton = page.getByRole('button', { name: 'Back to Login', exact: true });
    // The server message paragraph has no role; id "name" is the only stable hook (verified).
    this.errorMessage = page.locator('p#name');
    // The client marks fields with class is-invalid; no text message exists.
    this.invalidInputs = page.locator('input.is-invalid');
    this.inputs = [this.firstName, this.lastName, this.userName, this.password];
    // Hidden textarea written by the invisible reCAPTCHA v3 widget; no role, label or test id exists.
    this.captchaToken = page.locator('textarea[name="g-recaptcha-response"]');
  }

  async open(): Promise<this> {
    await this.page.goto('register', { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    return this;
  }

  /**
   * R-01: hydrated AND the invisible reCAPTCHA v3 token issued. Before the token a filled submit
   * shows "Please verify reCaptcha to register!" and sends nothing, and the token's arrival clears
   * all four fields and every is-invalid mark. Only a boolean leaves the page (never the token).
   */
  async waitForReady(): Promise<void> {
    await this.heading.waitFor({ timeout: READY_MS });
    await waitForHydration(this.registerButton);
    await expect
      .poll(() => this.captchaToken.evaluate((textarea) => (textarea as HTMLTextAreaElement).value.length > 0), {
        message: 'reCAPTCHA v3 token issued (form submittable)',
        timeout: READY_MS
      })
      .toBe(true);
  }

  async submitEmpty(): Promise<void> {
    await clickUntilInvalid(this.registerButton, this.invalidInputs);
  }

  /** Non-secret data only: static names, a fake user name and the weak value "abc". */
  async fillForm(form: RegisterForm): Promise<void> {
    await fillAndConfirm(this.firstName, form.firstName);
    await fillAndConfirm(this.lastName, form.lastName);
    await fillAndConfirm(this.userName, form.userName);
    await fillAndConfirm(this.password, form.password);
  }

  /**
   * Submits a form that the server must reject. Returns the status and the request body's JSON
   * keys only (DQB-041 records whether a captcha field is sent, R-26).
   */
  async submitExpectingRejection(): Promise<{ status: number; bodyKeys: string[] }> {
    // R-07 guard: never submit a value that satisfies the server rule (that could create an account).
    if (STRONG_PASSWORD_RULE.test(await this.password.inputValue())) {
      throw new Error('R-07: refusing to submit a password that satisfies the server rule');
    }
    // A late reCAPTCHA callback clears every field; prove the form is still filled right before the
    // click (a precondition, not an assertion: fillForm already confirmed every value).
    for (const input of this.inputs) {
      if ((await input.inputValue()) === '') {
        throw new Error('Register form was cleared before submit (late reCAPTCHA callback, R-01); not submitting');
      }
    }
    const [response] = await Promise.all([
      this.page.waitForResponse(API.createUser, { timeout: READY_MS }),
      this.registerButton.click()
    ]);
    const body: unknown = response.request().postDataJSON();
    const bodyKeys = body && typeof body === 'object' ? Object.keys(body) : [];
    return { status: response.status(), bodyKeys };
  }

  /** '' when p#name is absent or empty. */
  async errorText(): Promise<string> {
    if ((await this.errorMessage.count()) === 0) {
      return '';
    }
    return ((await this.errorMessage.textContent()) ?? '').trim();
  }

  async backToLogin(): Promise<DemoqaLoginPage> {
    const login = new DemoqaLoginPage(this.page);
    await Promise.all([
      this.page.waitForURL(/\/login$/, { waitUntil: 'domcontentloaded' }),
      this.backToLoginButton.click()
    ]);
    await login.waitForReady();
    return login;
  }
}
