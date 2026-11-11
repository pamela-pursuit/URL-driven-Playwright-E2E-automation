import type { Locator, Page } from '@playwright/test';
import { ADD_TO_CART_URL } from '../../test-data/demo-web-shop.data';
import { DemoWebShopHeader } from './header.page';
import { DemoWebShopNotificationBar } from './notification-bar.page';

export class DemoWebShopProductPage {
  readonly header: DemoWebShopHeader;
  readonly notification: DemoWebShopNotificationBar;
  readonly heading: Locator;
  // Scope: a product page has 6 "Add to cart" buttons (related products), 1 inside .overview.
  readonly overview: Locator;
  readonly quantityInput: Locator;
  readonly addToCartButton: Locator;
  readonly addToWishlistButton: Locator;
  // No role or label on the price text "Price: 10.00" (probe P4).
  readonly price: Locator;

  constructor(private readonly page: Page) {
    this.header = new DemoWebShopHeader(page);
    this.notification = new DemoWebShopNotificationBar(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.overview = page.locator('.overview');
    this.quantityInput = page.getByLabel('Qty:');
    this.addToCartButton = this.overview.getByRole('button', { name: 'Add to cart' });
    this.addToWishlistButton = this.overview.getByRole('button', { name: 'Add to wishlist' });
    this.price = this.overview.locator('.product-price');
  }

  /** Relies on the addthis block (K5); never waits for `load`. */
  async open(slug: string): Promise<this> {
    await this.page.goto(slug, { waitUntil: 'domcontentloaded' });
    await this.heading.waitFor();
    return this;
  }

  async setQuantity(value: string): Promise<void> {
    await this.quantityInput.fill(value);
  }

  /** Clicks "Add to cart", waits for the AJAX response and the (success or error) bar. */
  async addToCart(): Promise<void> {
    await this.notification.dismissIfVisible();
    await Promise.all([
      this.page.waitForResponse((response) => ADD_TO_CART_URL.details.test(response.url())),
      this.addToCartButton.click()
    ]);
    await this.notification.waitForShown();
  }

  async addToWishlist(): Promise<void> {
    await this.notification.dismissIfVisible();
    await Promise.all([
      this.page.waitForResponse((response) => ADD_TO_CART_URL.wishlist.test(response.url())),
      this.addToWishlistButton.click()
    ]);
    await this.notification.waitForShown();
  }

  /**
   * TC-37 / TC-38: clicks "Add to cart" while the request is made to fail (cartNetwork)
   * and returns the native alert the AjaxCart failure handler raises (probe P1). The click
   * completes only after the alert is handled, so the dialog is accepted first.
   */
  async clickAddToCartExpectingAlert(): Promise<string> {
    await this.notification.dismissIfVisible();
    const dialogPromise = this.page.waitForEvent('dialog');
    const click = this.addToCartButton.click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    await click;
    return message;
  }

  /** TC-39: double-click, then wait for the bar. The spec then reads /cart. */
  async doubleClickAddToCart(): Promise<void> {
    await this.notification.dismissIfVisible();
    await Promise.all([
      this.page.waitForResponse((response) => ADD_TO_CART_URL.details.test(response.url())),
      this.addToCartButton.dblclick()
    ]);
    await this.notification.waitForShown();
  }
}
