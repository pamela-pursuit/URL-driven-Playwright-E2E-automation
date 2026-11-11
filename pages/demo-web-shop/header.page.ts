import type { Locator, Page } from '@playwright/test';
import { escapeRegExp } from '../../test-data/demo-web-shop.data';
import { navigateBy } from './navigation';
import { cartContent, searchHeading, wishlistHeading } from './ready-locators';

export type SearchObservation = { kind: 'alert'; message: string } | { kind: 'navigated'; url: string };

/** Header component shared by every page (links, counts, search, menus). */
export class DemoWebShopHeader {
  readonly registerLink: Locator;
  readonly loginLink: Locator;
  readonly logoutLink: Locator;
  // Its accessible name is the account email (data), so a role+name locator would put data in the locator.
  readonly accountLink: Locator;
  readonly cartLink: Locator;
  readonly wishlistLink: Locator;
  // Count text "(n)" has no role of its own.
  readonly cartQty: Locator;
  readonly wishlistQty: Locator;
  // No label, placeholder or aria-label (discovery 4.10); role+name resolves to 0.
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  // jQuery UI autocomplete: li elements have role=presentation, no option/menuitem role (probe P7).
  readonly autocompleteItems: Locator;
  // Container scope: the desktop top menu (names repeat in the side block).
  readonly topMenu: Locator;
  // A div that wraps <a href="">; getByRole('button', /menu/) resolves to 0 (discovery 4.9).
  readonly mobileMenuToggle: Locator;
  readonly mobileMenu: Locator;

  constructor(private readonly page: Page) {
    this.registerLink = page.getByRole('link', { name: 'Register' });
    this.loginLink = page.getByRole('link', { name: 'Log in' });
    this.logoutLink = page.getByRole('link', { name: 'Log out' });
    this.accountLink = page.locator('.header-links .account');
    this.cartLink = page.getByRole('link', { name: /^Shopping cart\s*\(\d+\)$/ });
    this.wishlistLink = page.getByRole('link', { name: /^Wishlist\s*\(\d+\)$/ });
    this.cartQty = page.locator('.header-links .cart-qty');
    this.wishlistQty = page.locator('.header-links .wishlist-qty');
    this.searchInput = page.locator('#small-searchterms');
    // Scoped: /search has a second "Search" button in the page form.
    this.searchButton = page.locator('.search-box').getByRole('button', { name: 'Search' });
    this.autocompleteItems = page.locator('ul.ui-autocomplete li');
    this.topMenu = page.locator('.top-menu');
    this.mobileMenuToggle = page.locator('#mob-menu-button');
    this.mobileMenu = page.locator('.mob-top-menu');
  }

  topMenuLink(name: string): Locator {
    return this.topMenu.getByRole('link', { name, exact: true });
  }

  /** The mobile menu renders names in upper case (BOOKS); matched case-insensitively. */
  mobileMenuLink(name: string): Locator {
    return this.mobileMenu.getByRole('link', { name: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, 'i') });
  }

  autocompleteItem(name: string): Locator {
    return this.autocompleteItems.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`) });
  }

  /** Fills the header search and waits for the search results page. */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await navigateBy(this.page, () => this.searchButton.click(), /\/search\?q=/);
    await searchHeading(this.page).waitFor();
  }

  /**
   * Clicks Search and returns the native alert text. With `term` undefined the default
   * "Search store" value is left untouched. The click only completes after the alert is
   * handled, so the dialog is awaited and accepted before the click is awaited.
   */
  async searchExpectingAlert(term?: string): Promise<string> {
    if (term !== undefined) {
      await this.searchInput.fill(term);
    }
    const dialogPromise = this.page.waitForEvent('dialog');
    const click = this.searchButton.click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    await click;
    return message;
  }

  /** TC-26: reports whether the search raised an alert or navigated. */
  async searchAndObserve(term: string): Promise<SearchObservation> {
    await this.searchInput.fill(term);
    const outcome = Promise.race([
      this.page.waitForEvent('dialog').then(async (dialog): Promise<SearchObservation> => {
        const message = dialog.message();
        await dialog.accept();
        return { kind: 'alert', message };
      }),
      this.page
        .waitForURL(/\/search\?/, { waitUntil: 'domcontentloaded' })
        .then((): SearchObservation => ({ kind: 'navigated', url: this.page.url() }))
    ]);
    const click = this.searchButton.click();
    const result = await outcome;
    await click;
    return result;
  }

  /** jQuery autocomplete listens for key events, so the prefix is typed key by key. */
  async typeSearchPrefix(prefix: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.fill('');
    await this.searchInput.pressSequentially(prefix);
    await this.autocompleteItems.first().waitFor();
  }

  async openCategory(name: string): Promise<void> {
    await navigateBy(this.page, () => this.topMenuLink(name).click());
    await this.page.getByRole('heading', { level: 1 }).waitFor();
  }

  async openCart(): Promise<void> {
    await navigateBy(this.page, () => this.cartLink.click(), /\/cart/);
    await cartContent(this.page).waitFor();
  }

  async openWishlist(): Promise<void> {
    await navigateBy(this.page, () => this.wishlistLink.click(), /\/wishlist/);
    await wishlistHeading(this.page).waitFor();
  }

  async openAccount(): Promise<void> {
    await navigateBy(this.page, () => this.accountLink.click(), /\/customer\/info/);
    await this.page.getByRole('heading', { level: 1 }).waitFor();
  }

  async logOut(): Promise<void> {
    await navigateBy(this.page, () => this.logoutLink.click());
    await this.loginLink.waitFor();
  }

  /** Instant check; callers wait for a page state first. */
  async isSignedIn(): Promise<boolean> {
    return this.logoutLink.isVisible();
  }

  async cartCount(): Promise<number> {
    return parseCount(await this.cartQty.innerText(), 'cart');
  }

  async wishlistCount(): Promise<number> {
    return parseCount(await this.wishlistQty.innerText(), 'wishlist');
  }

  /** Secret-safe comparison: returns a boolean and never prints the value. */
  async accountLinkShows(email: string): Promise<boolean> {
    await this.accountLink.waitFor();
    return (await this.accountLink.innerText()).trim() === email;
  }

  async openMobileMenu(): Promise<void> {
    await this.mobileMenuToggle.click();
    await this.mobileMenu.waitFor();
  }

  /** Browser reload that never waits for `load` (R-03). */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  /** Browser Back. Returns false when there is no earlier history entry. */
  async goBack(): Promise<boolean> {
    const response = await this.page.goBack({ waitUntil: 'domcontentloaded' });
    return response !== null;
  }
}

function parseCount(text: string, what: string): number {
  const match = text.match(/\((\d+)\)/);
  if (!match) {
    throw new Error(`Could not read the header ${what} count from "${text}"`);
  }
  return Number(match[1]);
}
