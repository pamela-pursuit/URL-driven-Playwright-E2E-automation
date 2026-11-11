import type { Locator, Page } from '@playwright/test';
import { DemoWebShopHeader } from './header.page';
import { navigateBy } from './navigation';
import { DemoWebShopNotificationBar } from './notification-bar.page';
import { DemoWebShopProductPage } from './product.page';

export class DemoWebShopHomePage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = page.getByRole('heading', { level: 1 });
  }

  /** Exact title-link name, so "Build your own computer" does not match "Build your own cheap computer". */
  productItem(name: string): Locator {
    return this.page.locator('.product-item').filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  productItemAddToCart(name: string): Locator {
    return this.productItem(name).getByRole('button', { name: 'Add to cart' });
  }

  async open(): Promise<this> {
    await this.page.goto('./', { waitUntil: 'domcontentloaded' });
    await this.header.searchInput.waitFor();
    return this;
  }

  /** TC-35: the home "Add to cart" of a configurable product navigates to its page. */
  async openProductViaAddToCart(name: string): Promise<DemoWebShopProductPage> {
    await navigateBy(this.page, () => this.productItemAddToCart(name).click(), /\/[^/]+$/);
    const product = new DemoWebShopProductPage(this.page);
    await product.heading.waitFor();
    return product;
  }

  /** document.documentElement.scrollWidth, for the no-horizontal-scroll check (TC-67). */
  async documentScrollWidth(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth);
  }
}
