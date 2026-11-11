import type { Locator, Page } from '@playwright/test';
import { escapeRegExp } from '../../test-data/demo-web-shop.data';
import { DemoWebShopHeader } from './header.page';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { searchHeading } from './ready-locators';

export class DemoWebShopSearchPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;
  readonly keywordInput: Locator;
  readonly advancedSearch: Locator;
  readonly pageSearchButton: Locator;
  // Container for the result items and the "No products…" / "minimum length" messages (probe P4).
  readonly results: Locator;
  readonly productItems: Locator;
  readonly productTitles: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = searchHeading(page);
    this.keywordInput = page.getByLabel('Search keyword:');
    this.advancedSearch = page.getByLabel('Advanced search');
    // Scoped: the page has 2 "Search" buttons (header and page form).
    this.pageSearchButton = page.locator('.search-input').getByRole('button', { name: 'Search' });
    this.results = page.locator('.search-results');
    this.productItems = this.results.locator('.product-item');
    this.productTitles = this.productItems.locator('.product-title');
  }

  productItem(name: string): Locator {
    return this.productTitles.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`) });
  }

  /** Direct URL /search?q=<term> (TC-23). */
  async open(term: string): Promise<this> {
    await this.page.goto(`search?q=${encodeURIComponent(term)}`, { waitUntil: 'domcontentloaded' });
    await this.heading.waitFor();
    return this;
  }

  async productNames(): Promise<string[]> {
    return (await this.productTitles.allInnerTexts()).map((name) => name.trim());
  }
}
