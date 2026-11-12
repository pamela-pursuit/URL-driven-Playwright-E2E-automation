import type { Locator, Page } from '@playwright/test';
import { DemoqaBooksPage } from './books.page';

export class DemoqaBookDetailPage {
  readonly titleValue: Locator;
  readonly authorValue: Locator;
  readonly publisherValue: Locator;
  readonly backButton: Locator;

  constructor(private readonly page: Page) {
    this.titleValue = this.field('Title :');
    this.authorValue = this.field('Author :');
    this.publisherValue = this.field('Publisher :');
    this.backButton = page.getByRole('button', { name: 'Back To Book Store' });
  }

  /**
   * Value of one label / value row, scoped by the row's own label text.
   * CSS is needed: the rows have no roles, and every value element shares the id
   * "userName-value", so the value is only unique inside its "*-wrapper" row (probe confirmed).
   */
  field(label: string): Locator {
    return this.page
      .locator('[id$="-wrapper"]')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('#userName-value');
  }

  async waitForLoaded(): Promise<void> {
    await this.backButton.waitFor({ state: 'visible' });
  }

  async backToBookStore(): Promise<DemoqaBooksPage> {
    await this.backButton.click();
    const books = new DemoqaBooksPage(this.page);
    await books.waitForBooks();
    return books;
  }
}
