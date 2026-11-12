import type { Locator, Page } from '@playwright/test';
import { fillAccountValue } from './account-input';

export class DemoQaLoginPage {
  readonly heading: Locator;
  readonly userName: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Login', level: 1 });
    this.userName = page.getByPlaceholder('UserName');
    this.password = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }

  async open(): Promise<void> {
    await this.page.goto('login', { waitUntil: 'domcontentloaded' });
    await this.loginButton.waitFor();
  }

  /** Logs in and waits until the account and its collection have loaded on the Profile page. */
  async logIn(userName: string, password: string): Promise<void> {
    await fillAccountValue(this.userName, userName);
    await fillAccountValue(this.password, password);
    const accountLoaded = this.page.waitForResponse(
      (r) => /\/Account\/v1\/User\//.test(r.url()) && r.request().method() === 'GET'
    );
    await this.loginButton.click();
    await this.page.waitForURL(/\/profile/);
    await accountLoaded;
  }
}
