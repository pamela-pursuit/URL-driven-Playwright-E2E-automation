import type { Locator, Page } from '@playwright/test';
import { setHiddenValue } from './account-input';
import { DemoqaProfilePage } from './profile.page';

export class DemoqaLoginPage {
  readonly heading: Locator;
  // Labels are not linked to the inputs, so the placeholder hints are used (never #userName).
  readonly userNameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Login', level: 1 });
    this.userNameInput = page.getByPlaceholder('UserName');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
  }

  async open(): Promise<this> {
    await this.page.goto('login', { waitUntil: 'domcontentloaded' });
    await this.loginButton.waitFor({ state: 'visible' });
    return this;
  }

  async typeUserName(userName: string): Promise<void> {
    await setHiddenValue(this.userNameInput, userName);
  }

  async typePassword(password: string): Promise<void> {
    await setHiddenValue(this.passwordInput, password);
  }

  /** Clicks Login and waits for the Profile URL and the account response. */
  async submit(): Promise<DemoqaProfilePage> {
    const accountLoaded = this.page.waitForResponse(
      (r) => r.url().includes('/Account/v1/User/') && r.request().method() === 'GET' && r.ok()
    );
    const profileOpened = this.page.waitForURL(/\/profile/);
    await this.loginButton.click();
    await Promise.all([accountLoaded, profileOpened]);
    const profile = new DemoqaProfilePage(this.page);
    await profile.waitForSignedIn();
    return profile;
  }

  async logIn(userName: string, password: string): Promise<DemoqaProfilePage> {
    await this.typeUserName(userName);
    await this.typePassword(password);
    return this.submit();
  }

  /** Used after logging out. */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForURL(/\/login/);
    await this.loginButton.waitFor({ state: 'visible' });
  }
}
