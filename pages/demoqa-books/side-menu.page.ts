import type { Locator, Page } from '@playwright/test';
import { READY_MS } from './app-ready';

export type BookStoreMenuItem = 'Login' | 'Book Store' | 'Profile';

const TARGET_URL: Record<BookStoreMenuItem, RegExp> = {
  Login: /\/login$/,
  'Book Store': /\/books$/,
  Profile: /\/profile$/
};

/** The "Book Store Application" group of the left menu. */
export class DemoqaSideMenu {
  readonly group: Locator;

  constructor(private readonly page: Page) {
    // Menu ids item-N repeat in other groups, so the group is found by its header text (probe P7:
    // one .element-group with span.group-header "Book Store Application", 4 list items).
    this.group = page
      .locator('.element-group')
      .filter({ has: page.locator('span.group-header', { hasText: 'Book Store Application' }) });
  }

  /** `exact` separates "Book Store" from "Book Store API". */
  link(name: BookStoreMenuItem): Locator {
    return this.group.getByRole('link', { name, exact: true });
  }

  /** The list item holds class "active" (verified on the li). */
  item(name: BookStoreMenuItem): Locator {
    return this.group.getByRole('listitem').filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  /**
   * Clicks a menu link and waits for the target page to be ready. The fixed footer covers the
   * lower menu at 1280x900 (R-13), so the link is scrolled to the centre first; no force clicks.
   */
  async open(name: BookStoreMenuItem): Promise<void> {
    const link = this.link(name);
    await link.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await Promise.all([this.page.waitForURL(TARGET_URL[name], { waitUntil: 'domcontentloaded' }), link.click()]);
    await this.targetReady(name).waitFor({ timeout: READY_MS });
  }

  private targetReady(name: BookStoreMenuItem): Locator {
    switch (name) {
      case 'Login':
        return this.page.getByRole('heading', { level: 1, name: 'Login' });
      case 'Book Store':
        return this.page.getByRole('table').getByRole('link').first();
      case 'Profile':
        return this.page
          .getByText(/^Currently you are not logged into the Book Store application/)
          .or(this.page.getByText('Books :', { exact: true }))
          .first();
    }
  }
}
