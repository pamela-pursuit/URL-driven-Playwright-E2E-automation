import type { Locator, Page } from '@playwright/test';

/** "User Name :", "Log out" and "Login" controls on /books and the book detail page. */
export class DemoqaSessionBar {
  readonly userNameLabel: Locator;
  readonly userNameValue: Locator;
  readonly logoutButton: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.userNameLabel = page.getByText('User Name :', { exact: true });
    // Probe P4b: every detail field value reuses id "userName-value" (9 on a signed-in detail page).
    // The session value is the sibling of the unique #userName-label; no role or association exists.
    this.userNameValue = page.locator('#userName-label ~ #userName-value');
    // "Log out" here, "Logout" on /profile (R-24). #submit is never used (duplicate id, R-08).
    this.logoutButton = page.getByRole('button', { name: /^Log ?out$/ });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
  }

  /** Secret-safe: compares inside the method and returns a boolean only. */
  async userNameMatches(expected: string): Promise<boolean> {
    await this.userNameValue.waitFor();
    return ((await this.userNameValue.textContent()) ?? '').trim() === expected;
  }

  /** DQB-033: returns the URL reached after "Log out" so the spec can record it (R-28). */
  async logOut(): Promise<string> {
    await this.logoutButton.click();
    await this.logoutButton.waitFor({ state: 'hidden' });
    await this.loginButton.waitFor();
    return this.page.url();
  }
}
