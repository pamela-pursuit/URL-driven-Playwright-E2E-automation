import { expect, type Locator, type Page } from '@playwright/test';
import { API } from '../../test-data/demoqa-books.data';
import { DemoqaAlerts } from './alerts';
import { READY_MS, responseAfterNavigation, waitForHydration } from './app-ready';
import { DemoqaBooksPage } from './books.page';
import { DemoqaSessionBar } from './session-bar.page';

export type BookField = 'isbn' | 'title' | 'subtitle' | 'author' | 'publisher' | 'pages' | 'description' | 'website';

/** Verified stable wrapper ids (discovery 3.2); labels are not associated with values. */
const WRAPPER_ID: Record<BookField, string> = {
  isbn: 'ISBN-wrapper',
  title: 'title-wrapper',
  subtitle: 'subtitle-wrapper',
  author: 'author-wrapper',
  publisher: 'publisher-wrapper',
  pages: 'pages-wrapper',
  description: 'description-wrapper',
  website: 'website-wrapper'
};

/** /books?search=<ISBN>: one book's details. */
export class DemoqaBookDetailPage {
  readonly session: DemoqaSessionBar;
  readonly backButton: Locator;
  readonly addToCollectionButton: Locator;
  readonly alertRegion: Locator;
  private readonly alerts: DemoqaAlerts;

  constructor(private readonly page: Page) {
    this.alerts = DemoqaAlerts.for(page);
    this.session = new DemoqaSessionBar(page);
    // Both buttons share id addNewRecordButton (R-08), so role + exact name only.
    this.backButton = page.getByRole('button', { name: 'Back To Book Store', exact: true });
    this.addToCollectionButton = page.getByRole('button', { name: 'Add To Your Collection', exact: true });
    this.alertRegion = page.getByRole('alert');
  }

  wrapper(field: BookField): Locator {
    return this.page.locator(`#${WRAPPER_ID[field]}`);
  }

  /**
   * Probe P4b: each field wrapper holds one value element with id "userName-value" (the id is
   * reused across fields, so it is always scoped to the field's wrapper).
   */
  fieldValue(field: BookField): Locator {
    return this.wrapper(field).locator('#userName-value');
  }

  async open(isbn: string): Promise<void> {
    await responseAfterNavigation(
      this.page,
      API.bookByIsbn(isbn),
      () => this.page.goto(`books?search=${isbn}`, { waitUntil: 'domcontentloaded' }),
      () => undefined
    );
    await this.waitForBook();
  }

  /** DQB-020: returns the status of the book request; values stay empty, so no value wait. */
  async openUnknown(isbn: string): Promise<number> {
    const status = await responseAfterNavigation(
      this.page,
      API.bookByIsbn(isbn),
      () => this.page.goto(`books?search=${isbn}`, { waitUntil: 'domcontentloaded' }),
      (response) => response.status()
    );
    await this.wrapper('title').waitFor();
    await this.backButton.waitFor();
    return status;
  }

  /** Ready when the Title value has text and the back button is hydrated. */
  async waitForBook(): Promise<void> {
    await expect
      .poll(async () => ((await this.fieldValue('title').textContent()) ?? '').trim(), {
        message: 'Book detail Title value is rendered',
        timeout: READY_MS
      })
      .not.toBe('');
    await waitForHydration(this.backButton);
  }

  /** Clicks "Add To Your Collection" and returns the native alert text and the API status. */
  async addToCollection(): Promise<{ message: string; status: number }> {
    const [response, message] = await Promise.all([
      this.page.waitForResponse(API.addBooks, { timeout: READY_MS }),
      this.alerts.acceptNext('Add To Your Collection', () => this.addToCollectionButton.click())
    ]);
    return { message, status: response.status() };
  }

  async backToBookStore(): Promise<DemoqaBooksPage> {
    const list = new DemoqaBooksPage(this.page);
    await Promise.all([
      this.page.waitForURL(/\/books$/, { waitUntil: 'domcontentloaded' }),
      this.backButton.click()
    ]);
    await list.waitForReady();
    return list;
  }
}
