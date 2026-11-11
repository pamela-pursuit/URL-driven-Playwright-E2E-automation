import type { Locator, Page, Response } from '@playwright/test';
import { API } from '../../test-data/demoqa-books.data';
import { DemoqaAlerts } from './alerts';
import { documentScrollWidth, fillAndConfirm, responseAfterNavigation, waitForHydration } from './app-ready';
import { DemoqaBookDetailPage } from './book-detail.page';
import { DemoqaBooksTable } from './books-table.page';
import { DemoqaSessionBar } from './session-bar.page';
import { DemoqaSideMenu } from './side-menu.page';

/** /books: the public book list. */
export class DemoqaBooksPage {
  readonly table: DemoqaBooksTable;
  readonly session: DemoqaSessionBar;
  readonly menu: DemoqaSideMenu;
  readonly searchBox: Locator;

  constructor(private readonly page: Page) {
    DemoqaAlerts.for(page);
    this.table = new DemoqaBooksTable(page);
    this.session = new DemoqaSessionBar(page);
    this.menu = new DemoqaSideMenu(page);
    // Verified placeholder; the input has no label or aria-label.
    this.searchBox = page.getByPlaceholder('Type to search');
  }

  /** Returns the document response (TC-01 asserts status and no redirect). */
  async open(): Promise<Response> {
    const navigation: { document: Response | null } = { document: null };
    await responseAfterNavigation(
      this.page,
      API.booksList,
      async () => {
        navigation.document = await this.page.goto('books', { waitUntil: 'domcontentloaded' });
      },
      () => undefined
    );
    await this.waitForReady();
    if (!navigation.document) {
      throw new Error('Navigation to /books returned no response');
    }
    return navigation.document;
  }

  /**
   * TC-21: the list request is routed to fail, so no row or search-box wait here (the spec
   * asserts what is shown; the app currently crashes to a blank page, DEF-001).
   */
  async openExpectingNoRows(): Promise<void> {
    await this.page.goto('books', { waitUntil: 'domcontentloaded' });
  }

  async search(term: string): Promise<void> {
    await fillAndConfirm(this.searchBox, term);
  }

  async clearSearch(): Promise<void> {
    await fillAndConfirm(this.searchBox, '');
  }

  async reload(): Promise<void> {
    await responseAfterNavigation(
      this.page,
      API.booksList,
      () => this.page.reload({ waitUntil: 'domcontentloaded' }),
      () => undefined
    );
    await this.waitForReady();
  }

  async openBook(title: string): Promise<DemoqaBookDetailPage> {
    const detail = new DemoqaBookDetailPage(this.page);
    await Promise.all([
      this.page.waitForURL(/\/books\?search=\d+$/, { waitUntil: 'domcontentloaded' }),
      this.table.titleLink(title).click()
    ]);
    await detail.waitForBook();
    return detail;
  }

  async documentScrollWidth(): Promise<number> {
    return documentScrollWidth(this.page);
  }

  async waitForReady(): Promise<void> {
    await this.table.waitForRows();
    await waitForHydration(this.searchBox);
  }
}
