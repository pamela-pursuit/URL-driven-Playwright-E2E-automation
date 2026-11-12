import type { Locator, Page } from '@playwright/test';

export class DemoQaProfilePage {
  readonly userNameValue: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.userNameValue = page.locator('#userName-value'); // no accessible name; shows the signed-in user
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
  }

  async open(): Promise<void> {
    const accountLoaded = this.page.waitForResponse(
      (r) => /\/Account\/v1\/User\//.test(r.url()) && r.request().method() === 'GET'
    );
    await this.page.goto('profile', { waitUntil: 'domcontentloaded' });
    await accountLoaded;
    await this.userNameValue.waitFor();
  }

  bookLink(title: string): Locator {
    return this.page.getByRole('link', { name: title, exact: true });
  }

  /** Removes one book from the collection and returns the browser alert text ("" if the book is not listed). */
  async removeBook(title: string): Promise<string> {
    const link = this.bookLink(title);
    if (!(await link.count())) return '';
    await this.page.getByRole('row').filter({ has: link }).getByTitle('Delete').click();
    const confirm = this.page.getByRole('dialog').filter({ hasText: 'Delete Book' });
    const alert = this.page.waitForEvent('dialog');
    await confirm.getByRole('button', { name: 'OK' }).click();
    const dialog = await alert;
    const message = dialog.message();
    await dialog.accept();
    await link.waitFor({ state: 'detached' });
    return message;
  }

  async logOut(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL(/\/login/);
  }
}
