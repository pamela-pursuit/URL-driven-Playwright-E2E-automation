import type { Locator, Page } from '@playwright/test';
import { escapeRegExp } from '../../test-data/demoqa-books.data';
import { READY_MS } from './app-ready';

export type BookColumn = 'Image' | 'Title' | 'Author' | 'Publisher' | 'Action';

/** Verified column order (discovery 3.1 and 3.5). */
const COLUMN_INDEX: Record<BookColumn, number> = { Image: 0, Title: 1, Author: 2, Publisher: 3, Action: 4 };

/** The book table on /books and the collection table on /profile (same plain <table> markup). */
export class DemoqaBooksTable {
  readonly table: Locator;
  readonly bookRows: Locator;
  readonly titleLinks: Locator;
  readonly anySortIndicator: Locator;
  readonly pageInfo: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;

  constructor(private readonly page: Page) {
    this.table = page.getByRole('table');
    // Data rows only: the header row holds columnheader cells. Probe P5: 8 data rows, no padding rows.
    this.bookRows = this.table.getByRole('row').filter({ has: page.getByRole('cell') });
    // Probe P5: thumbnails are not wrapped in links (8 links, 0 image links); the filter keeps it that way.
    this.titleLinks = this.table.getByRole('link').filter({ hasNot: page.getByRole('img') });
    this.anySortIndicator = this.table.getByLabel(/^sorted-(asc|desc)$/);
    // Probe P5: "Page 1 of 1" is a single <span> between the two buttons.
    this.pageInfo = page.getByText(/^Page \d+ of \d+$/);
    this.previousButton = page.getByRole('button', { name: 'Previous', exact: true });
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
  }

  /** R-10: the accessible name gains the arrow after sorting, so the name is matched by prefix. */
  columnHeader(name: BookColumn): Locator {
    return this.table.getByRole('columnheader', { name: new RegExp(`^${escapeRegExp(name)}`) });
  }

  /** Verified `aria-label` on a span inside the header (no `aria-sort`). */
  sortIndicator(column: BookColumn, direction: 'asc' | 'desc'): Locator {
    return this.columnHeader(column).getByLabel(`sorted-${direction}`, { exact: true });
  }

  row(title: string): Locator {
    return this.bookRows.filter({ has: this.page.getByRole('link', { name: title, exact: true }) });
  }

  titleLink(title: string): Locator {
    return this.table.getByRole('link', { name: title, exact: true });
  }

  cell(title: string, column: BookColumn): Locator {
    return this.row(title).getByRole('cell').nth(COLUMN_INDEX[column]);
  }

  /** No role-based way to select one column across rows; used for order checks only. */
  columnCells(column: BookColumn): Locator {
    return this.table.locator(`tbody tr td:nth-child(${COLUMN_INDEX[column] + 1})`);
  }

  async waitForRows(): Promise<void> {
    await this.titleLinks.first().waitFor({ timeout: READY_MS });
  }

  /** Sorting is synchronous client-side; specs use web-first assertions afterwards. */
  async sortBy(column: BookColumn): Promise<void> {
    await this.columnHeader(column).click();
  }

  /** For annotations and guards only; assertions use toHaveText([...]). */
  async titles(): Promise<string[]> {
    return (await this.titleLinks.allInnerTexts()).map((title) => title.trim());
  }
}
