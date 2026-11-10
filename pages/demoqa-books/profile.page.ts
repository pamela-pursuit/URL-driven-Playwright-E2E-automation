import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { API, MESSAGES, OWN_BOOK_ISBNS, type OwnBook } from '../../test-data/demoqa-books.data';
import { DemoqaAlerts } from './alerts';
import { LOGIN_REDIRECT_MS, READY_MS, waitForHydration } from './app-ready';
import { DemoqaBooksTable } from './books-table.page';
import { DemoqaLoginPage } from './login.page';
import { DemoqaRegisterPage } from './register.page';

/**
 * /profile. "Delete Account" and "Delete All Books" are exposed for visibility checks only; no
 * method clicks them and no locator uses the shared id #submit (R-08, section 3.10).
 */
export class DemoqaProfilePage {
  readonly table: DemoqaBooksTable;
  readonly booksHeading: Locator;
  readonly userNameValue: Locator;
  readonly logoutButton: Locator;
  readonly goToStoreButton: Locator;
  readonly deleteAccountButton: Locator;
  readonly deleteAllBooksButton: Locator;
  readonly searchBox: Locator;
  readonly signedOutMessage: Locator;
  readonly deleteDialog: Locator;
  readonly deleteDialogTitle: Locator;
  readonly deleteDialogBody: Locator;
  readonly dialogOk: Locator;
  readonly dialogCancel: Locator;
  private readonly alerts: DemoqaAlerts;

  constructor(private readonly page: Page) {
    this.alerts = DemoqaAlerts.for(page);
    this.table = new DemoqaBooksTable(page);
    // Verified text; not exposed as a heading.
    this.booksHeading = page.getByText('Books :', { exact: true });
    // Verified label#userName-value (no role, no association); probe P4b: exactly one on /profile.
    this.userNameValue = page.locator('#userName-value');
    // "Logout" here, "Log out" on /books (R-24).
    this.logoutButton = page.getByRole('button', { name: /^Log ?out$/ });
    this.goToStoreButton = page.getByRole('button', { name: 'Go To Book Store', exact: true });
    this.deleteAccountButton = page.getByRole('button', { name: 'Delete Account', exact: true });
    // A hidden duplicate was seen in discovery; probe P16 resolves exactly one visible button.
    this.deleteAllBooksButton = page.getByRole('button', { name: 'Delete All Books', exact: true }).filter({ visible: true });
    this.searchBox = page.getByPlaceholder('Type to search');
    this.signedOutMessage = page.getByText(/^Currently you are not logged into the Book Store application/);
    this.deleteDialog = page.getByRole('dialog');
    this.deleteDialogTitle = this.deleteDialog.getByText(MESSAGES.deleteDialogTitle, { exact: true });
    this.deleteDialogBody = this.deleteDialog.getByText(MESSAGES.deleteDialogBody, { exact: true });
    this.dialogOk = this.deleteDialog.getByRole('button', { name: 'OK', exact: true });
    this.dialogCancel = this.deleteDialog.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** Scoped to the message so the left-menu "Login" link never matches. */
  signedOutLink(name: 'login' | 'register'): Locator {
    return this.signedOutMessage.getByRole('link', { name, exact: true });
  }

  /** Verified span with title="Delete" and no button role (R-09). */
  deleteIcon(isbn: string): Locator {
    return this.page.locator(`#delete-record-${isbn}`);
  }

  /** Raw navigation for guest checks and session detection; waits for either profile state. */
  async goto(): Promise<Response> {
    const response = await this.page.goto('profile', { waitUntil: 'domcontentloaded' });
    await this.signedOutMessage.or(this.logoutButton).first().waitFor({ timeout: READY_MS });
    if (!response) {
      throw new Error('Navigation to /profile returned no response');
    }
    return response;
  }

  /** Call after goto(): true when the signed-in profile is shown. */
  async isSignedIn(): Promise<boolean> {
    return this.logoutButton.isVisible();
  }

  /** Signed-in profile with its collection rows final (they come from GET /Account/v1/User/<id>). */
  async openSignedIn(): Promise<this> {
    const userLoaded = this.page.waitForResponse(API.accountUser, { timeout: LOGIN_REDIRECT_MS });
    await this.page.goto('profile', { waitUntil: 'domcontentloaded' });
    await this.waitForCollection(await userLoaded);
    return this;
  }

  async reload(): Promise<void> {
    const userLoaded = this.page.waitForResponse(API.accountUser, { timeout: LOGIN_REDIRECT_MS });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForCollection(await userLoaded);
  }

  /** After an in-app login redirect: the signed-in state without another navigation. */
  async waitForSignedIn(): Promise<void> {
    await this.booksHeading.waitFor({ timeout: LOGIN_REDIRECT_MS });
    await this.userNameValue.waitFor({ timeout: LOGIN_REDIRECT_MS });
    await waitForHydration(this.logoutButton);
  }

  /** Secret-safe: compares inside the method and returns a boolean only. */
  async userNameMatches(expected: string): Promise<boolean> {
    await this.userNameValue.waitFor();
    return ((await this.userNameValue.textContent()) ?? '').trim() === expected;
  }

  async openDeleteDialog(isbn: string): Promise<void> {
    await this.deleteIcon(isbn).click();
    await this.deleteDialog.waitFor();
  }

  async cancelDelete(): Promise<void> {
    await this.dialogCancel.click();
    await this.deleteDialog.waitFor({ state: 'hidden' });
  }

  /** Clicks OK in "Delete Book"; returns the native alert text and the DELETE status. */
  async confirmDelete(title: string): Promise<{ message: string; status: number }> {
    const [response, message] = await Promise.all([
      this.page.waitForResponse(API.deleteBook, { timeout: READY_MS }),
      this.alerts.acceptNext('OK in the Delete Book dialog', () => this.dialogOk.click())
    ]);
    await this.table.row(title).waitFor({ state: 'hidden' });
    return { message, status: response.status() };
  }

  /**
   * Cleanup primitive used only by the ownedBooks fixture (section 4.4). Removes one of the suite's
   * own books if present and throws if any other row disappears. Idempotent.
   */
  async removeOwnBook(book: OwnBook): Promise<{ removed: boolean }> {
    if (!OWN_BOOK_ISBNS.includes(book.isbn)) {
      throw new Error(`Refusing to remove "${book.title}": it is not one of the suite's own books`);
    }
    const before = await this.table.titles();
    if (!before.includes(book.title)) {
      return { removed: false };
    }
    await this.openDeleteDialog(book.isbn);
    const result = await this.confirmDelete(book.title);
    if (result.message !== MESSAGES.bookDeleted || result.status !== 204) {
      throw new Error(`Cleanup of "${book.title}" failed: alert "${result.message}", status ${result.status}`);
    }
    const after = await this.table.titles();
    for (const title of before) {
      if (title !== book.title && !after.includes(title)) {
        throw new Error(`Cleanup changed a row it does not own: ${title}`);
      }
    }
    return { removed: true };
  }

  async logOut(): Promise<DemoqaLoginPage> {
    const login = new DemoqaLoginPage(this.page);
    await Promise.all([this.page.waitForURL(/\/login$/, { waitUntil: 'domcontentloaded' }), this.logoutButton.click()]);
    await login.waitForReady();
    return login;
  }

  /** DQB-046: returns the URL reached so the spec can record it (R-29). */
  async goToBookStore(): Promise<string> {
    await Promise.all([
      this.page.waitForURL((url) => !url.pathname.endsWith('/profile'), { waitUntil: 'domcontentloaded' }),
      this.goToStoreButton.click()
    ]);
    const url = this.page.url();
    if (/\/books$/.test(new URL(url).pathname)) {
      await this.table.waitForRows();
    }
    return url;
  }

  async openSignedOutLink(name: 'login'): Promise<DemoqaLoginPage>;
  async openSignedOutLink(name: 'register'): Promise<DemoqaRegisterPage>;
  async openSignedOutLink(name: 'login' | 'register'): Promise<DemoqaLoginPage | DemoqaRegisterPage> {
    const target = name === 'login' ? new DemoqaLoginPage(this.page) : new DemoqaRegisterPage(this.page);
    await Promise.all([
      this.page.waitForURL(name === 'login' ? /\/login$/ : /\/register$/, { waitUntil: 'domcontentloaded' }),
      this.signedOutLink(name).click()
    ]);
    await target.waitForReady();
    return target;
  }

  /** Waits until the rendered rows match the collection in the user response. */
  private async waitForCollection(userResponse: Response): Promise<void> {
    await this.booksHeading.waitFor({ timeout: READY_MS });
    await this.userNameValue.waitFor({ timeout: READY_MS });
    await waitForHydration(this.logoutButton);
    const body: unknown = await userResponse.json();
    const books = body && typeof body === 'object' ? (body as { books?: unknown }).books : undefined;
    if (Array.isArray(books)) {
      await expect
        .poll(() => this.table.bookRows.count(), { message: 'Profile rows match the collection', timeout: READY_MS })
        .toBe(books.length);
    }
  }
}
