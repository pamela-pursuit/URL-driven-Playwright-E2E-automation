import type { Locator, Page } from '@playwright/test';
import { DemoqaBooksPage } from '../demoqa/books.page';
import { DemoqaLoginPage } from './login.page';

/** The guest Book Store page plus the header parts shown while signed in. */
export class DemoqaSignedInBooksPage extends DemoqaBooksPage {
  readonly userNameValue: Locator;
  readonly logOutButton: Locator;
  readonly loginButton: Locator;
  private readonly signedInPage: Page;

  constructor(page: Page) {
    super(page);
    this.signedInPage = page;
    this.userNameValue = page.locator('#userName-value'); // no role or accessible name; narrow id
    // Exact name "Log out"; the id #submit is shared with other buttons, so it is never used.
    this.logOutButton = page.getByRole('button', { name: 'Log out', exact: true });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
  }

  async logOut(): Promise<DemoqaLoginPage> {
    await this.logOutButton.click();
    await this.signedInPage.waitForURL(/\/login/);
    const login = new DemoqaLoginPage(this.signedInPage);
    await login.waitForLoaded();
    return login;
  }
}
