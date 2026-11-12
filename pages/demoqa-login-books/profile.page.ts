import type { Locator, Page } from '@playwright/test';
import { DemoqaLoginPage } from './login.page';

export const NOT_LOGGED_IN_NOTICE =
  'Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself.';

export class DemoqaProfilePage {
  readonly userNameValue: Locator;
  readonly logoutButton: Locator;
  readonly notLoggedInNotice: Locator;

  constructor(private readonly page: Page) {
    this.userNameValue = page.locator('#userName-value'); // no role or accessible name; narrow id
    // Exact name "Logout"; the id #submit is shared with other buttons, so it is never used.
    this.logoutButton = page.getByRole('button', { name: 'Logout', exact: true });
    this.notLoggedInNotice = page.getByText('Currently you are not logged into the Book Store application', {
      exact: false
    });
  }

  async open(): Promise<this> {
    await this.page.goto('profile', { waitUntil: 'domcontentloaded' });
    await this.userNameValue.or(this.notLoggedInNotice).first().waitFor({ state: 'visible' });
    return this;
  }

  async waitForSignedIn(): Promise<void> {
    await this.userNameValue.waitFor({ state: 'visible' });
  }

  async logOut(): Promise<DemoqaLoginPage> {
    await this.logoutButton.click();
    await this.page.waitForURL(/\/login/);
    const login = new DemoqaLoginPage(this.page);
    await login.waitForLoaded();
    return login;
  }
}
