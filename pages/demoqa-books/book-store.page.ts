import type { Locator, Page } from '@playwright/test';

export class DemoQaBookStorePage {
  readonly addToCollection: Locator;

  constructor(private readonly page: Page) {
    this.addToCollection = page.getByRole('button', { name: 'Add To Your Collection' });
  }

  async open(): Promise<void> {
    await this.page.goto('books', { waitUntil: 'domcontentloaded' });
  }

  async openBook(title: string): Promise<void> {
    await this.page.getByRole('link', { name: title }).click();
    await this.page.waitForURL(/[?&]search=/);
    await this.addToCollection.waitFor();
  }

  /** Clicks "Add To Your Collection" and returns the text of the browser alert that follows. */
  async addOpenBookToCollection(): Promise<string> {
    const alert = this.page.waitForEvent('dialog');
    await this.addToCollection.click();
    const dialog = await alert;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}
