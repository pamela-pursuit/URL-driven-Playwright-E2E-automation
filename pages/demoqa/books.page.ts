import type { Locator, Page } from '@playwright/test';
import { DemoqaBookDetailPage } from './book-detail.page';

export class DemoqaBooksPage {
  readonly table: Locator;
  // Rows that hold a title link; this leaves out the header row.
  readonly bookRows: Locator;
  readonly bookLinks: Locator;
  readonly searchBox: Locator;
  readonly pager: Locator;

  constructor(private readonly page: Page) {
    this.table = page.getByRole('table');
    this.bookLinks = this.table.getByRole('link');
    this.bookRows = this.table.getByRole('row').filter({ has: page.getByRole('link') });
    this.searchBox = page.getByPlaceholder('Type to search');
    this.pager = page.getByText(/Page \d+ of \d+/);
  }

  columnHeader(name: string): Locator {
    return this.table.getByRole('columnheader', { name, exact: true });
  }

  bookLink(title: string): Locator {
    return this.table.getByRole('link', { name: title, exact: true });
  }

  async open(): Promise<this> {
    await this.page.goto('books', { waitUntil: 'domcontentloaded' });
    await this.waitForBooks();
    return this;
  }

  /** The rows load about 2 s after the page (R-02): wait for the first title link. */
  async waitForBooks(): Promise<void> {
    await this.bookLinks.first().waitFor({ state: 'visible' });
  }

  /** The table filters live while typing; specs check the result with web-first assertions. */
  async search(text: string): Promise<void> {
    await this.searchBox.fill(text);
  }

  async clearSearch(): Promise<void> {
    await this.searchBox.clear();
  }

  async bookTitles(): Promise<string[]> {
    return (await this.bookLinks.allInnerTexts()).map((title) => title.trim());
  }

  async openBook(title: string): Promise<DemoqaBookDetailPage> {
    await this.bookLink(title).click();
    const detail = new DemoqaBookDetailPage(this.page);
    await detail.waitForLoaded();
    return detail;
  }
}
