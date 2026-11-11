# Architecture: demo-web-shop

Implementation blueprint for the Playwright TypeScript suite covering
`test-plans/demo-web-shop/scenarios.json` (TC-01 to TC-70).

> **Update 2026-11-10 (user decision D6):** accessibility is out of scope. TC-68 to TC-70,
> `accessibility.spec.ts`, `reportOnly`, the keyboard sign-in mode (`tabToEmail`, `focusEmail`,
> `signInWithKeyboardFromEmail`, `MAX_TABS_TO_EMAIL`) and the home-page `newsletterEmail` and
> `htmlRoot` locators were removed. Their entries below are kept for history and marked *(removed)*.

Inputs: `discovery.md` (section 4 for exact texts and synchronisation, section 5 for
verified locators), `scenarios.json`, `requirements.md` section 8, `intake.md` D1 to D5,
`.claude/skills/qa-playwright/{pom,locators,credentials,reporting}.md`,
`playwright.config.ts`, `lib/credentials-store.d.cts`, `lib/artifact-reporter.ts`.

Labels used below:

- **Verified**: the locator or behaviour is in discovery.md section 4 or 5.
- **Probe**: the locator or behaviour was not observed. The implementer confirms it in a
  probe (section 9) before relying on it.

## 0. Key design decisions

| # | Decision | Choice | Why |
| --- | --- | --- | --- |
| K1 | Login strategy | **Sign in through the UI once per test**, in a test-scoped `signedIn` fixture. No `storageState` reuse. A run-scoped circuit breaker stops further login attempts after one rejection. | The lockout risk (R-04) comes from *failed* logins, not successful ones. Successful UI logins take about 1 to 2 s, and a full run makes about 40 of them. Several tests end or change the session (logout in TC-08, 009 and 050, cookie clearing in TC-10, guest-to-account merge in TC-51), so a shared worker session would be invalidated or polluted by test order. A `storageState` file would also write a live session token to disk. The circuit breaker covers the real risk: if the stored credential is wrong, at most **one** rejected attempt is made per run, not 40. |
| K2 | Chromium-only scenarios | `chromiumOnly()` helper, which calls `test.skip(({ browserName }) => browserName !== 'chromium', reason)` inside the scenario's `test.describe`. Informational tags (`@chromium-only`, `@mutates-account`, `@places-order`) go in the test details. **`playwright.config.ts` stays unchanged.** | Self-contained in the spec, so it works with `scripts/run-e2e.ps1`, which always passes all three `--project` flags. The skip happens before hooks and fixtures run, so no login, cleanup or order is attempted on Firefox or WebKit. Skipped rows still appear in `summary.md`, which keeps traceability per browser. A config-level `grepInvert` would hide the decision from the spec reader and change a file shared by every app. |
| K3 | Retries | `test.describe.configure({ retries: 0 })` in the describe block that holds **TC-02** (auth.spec.ts) and at file level in **checkout-cod.spec.ts** (TC-61). | CI uses `retries: 2`. A retry would repeat a wrong-password attempt (R-04) or place a second permanent order (R-06). Never run these with `--repeat-each`. |
| K4 | Cleanup | `accountCartCleaner` fixture. On setup it purges **only** reserved test products ("Health Book", "Computing and Internet") from the account cart and wishlist, then records the baseline counts. On teardown it purges them again, including after a failure. Rows are matched by an exact product-link name. A guard throws if any other row (for example "14.1-inch Laptop") changes. | D1 and R-16. The purge is idempotent (it does nothing when no reserved row exists), so an interrupted run is repaired by the next run's setup. Assertions are relative to the baseline (N+1 and back to N). |
| K5 | addthis | An **auto fixture** on the context fulfils `**/s7.addthis.com/**` with an empty 200 JavaScript response. In addition, **every page-object navigation uses `waitUntil: 'domcontentloaded'`** and then waits for a page-specific ready locator. Nothing waits on `load`. | R-03. Blocking removes the stall at its source for every page, popup and browser. `domcontentloaded` is a second safeguard in case another third-party host stalls later. |
| K6 | Network failure | `cartNetwork` fixture that wraps `page.route` on the add-to-cart AJAX URL, with `abortNext()` and `failNextWith(500)` (`times: 1`). | TC-37 and TC-38. The URL pattern must be confirmed by probe P1 first. |
| K7 | Spec file names | The `specFile` values already in `scenarios.json` are used (for example `listing.spec.ts`, `resilience.spec.ts`, `checkout-cod.spec.ts`) rather than renamed groups such as `catalog`, `network` or `order`. | The workbook sync and the catalogue already point at these paths. Renaming would break traceability for no gain. |

## 1. File plan

All files are **new**. There are no existing demo-web-shop page objects, specs, fixtures or data
(only `.gitkeep` files). Nothing is forked. `playwright.config.ts`, `lib/*` and
`scripts/*` are **not modified**.

```
pages/demo-web-shop/
  header.page.ts              DemoWebShopHeader            (component, every page)
  notification-bar.page.ts    DemoWebShopNotificationBar   (component, #bar-notification)
  home.page.ts                DemoWebShopHomePage
  login.page.ts               DemoWebShopLoginPage         (also /login/checkoutasguest)
  register.page.ts            DemoWebShopRegisterPage
  search.page.ts              DemoWebShopSearchPage
  category.page.ts            DemoWebShopCategoryPage
  product.page.ts             DemoWebShopProductPage
  cart.page.ts                DemoWebShopCartPage
  wishlist.page.ts            DemoWebShopWishlistPage
  checkout.page.ts            DemoWebShopCheckoutPage      (one-page checkout, all six steps)
  order-completed.page.ts     DemoWebShopOrderCompletedPage
  order.page.ts               DemoWebShopOrderPage         (/orderdetails/<id>)
  account.page.ts             DemoWebShopAccountPage       (/customer/*)
fixtures/
  demo-web-shop.fixture.ts    test/expect export, page-object fixtures, existingUser, signedIn,
                              signInAsExistingUser, accountCartCleaner, uniqueGuest, cartNetwork,
                              third-party blocker (auto), chromiumOnly(), recordObservation()
test-data/
  demo-web-shop.data.ts       products, reserved/protected names, exact messages, inputs,
                              guest address, URL patterns, unique generators
tests/demo-web-shop/
  auth.spec.ts                TC-01..006
  session.spec.ts             TC-07..011
  authorization.spec.ts       TC-12..014
  register.spec.ts            TC-16..020
  search.spec.ts              TC-21..026
  listing.spec.ts             TC-27..031
  product.spec.ts             TC-32..036, 039
  resilience.spec.ts          TC-37, 038
  cart-guest.spec.ts          TC-40..048
  cart-signed-in.spec.ts      TC-49..051
  checkout-signed-in.spec.ts  TC-52
  wishlist.spec.ts            TC-53..057
  checkout-guest.spec.ts      TC-15, 058..060, 062
  checkout-cod.spec.ts        TC-61
  account.spec.ts             TC-63..065   (TC-66 Blocked: no test)
  responsive.spec.ts          TC-67
  accessibility.spec.ts       (removed 2026-11-10, D6)
```

Import rules:

- Specs import `{ test, expect }` only from `../../fixtures/demo-web-shop.fixture`, and
  constants from `../../test-data/demo-web-shop.data`.
- Specs **never** call `page.locator`, `getByRole` or other locator factories. Every locator
  comes from a page-object property or method.
- The fixture imports `getAccount` and `type Account` from `'../lib/credentials-store.cjs'`.

## 2. Conventions shared by all page objects

- **Navigation.** Each page has `open()` that calls
  `page.goto('<relative path>', { waitUntil: 'domcontentloaded' })` and then waits for its
  ready locator (usually the h1). Use relative paths only: `'./'`, `'login'`, `'cart'`,
  `'health'`, `` `search?q=${encodeURIComponent(term)}` ``. Never use an absolute URL or a
  leading `/`.
- **Navigation inside the app.** For a click that navigates, use
  `await Promise.all([page.waitForURL(re, { waitUntil: 'domcontentloaded' }), locator.click()])`
  and then wait for the target's ready locator. `page.reload()` and `page.goBack()` always pass
  `{ waitUntil: 'domcontentloaded' }`. **No call may rely on the default `load` event.**
- **No sleeps.** `waitForTimeout` is banned. Wait for a locator state, a URL or a response.
- **State checks.** Page objects expose locators (for example `cartPage.emptyMessage`) and value
  readers (for example `header.cartCount(): Promise<number>`). Specs make the business assertion
  (`await expect(cartPage.emptyMessage).toHaveText(MESSAGES.cartEmpty)`). Page objects may wait
  on a locator for synchronisation, but they do not assert business outcomes. The guards in
  section 3.12 throw on safety violations; those are not assertions.
- **Composition.** Every page class has `readonly header: DemoWebShopHeader` and
  `readonly notification: DemoWebShopNotificationBar`, built in the constructor. There is no
  inheritance chain beyond this.
- **Locator priority** follows `locators.md`: role, then label, then placeholder, then test-id
  (none exist), then a stable id or name. Each CSS or id locator has a one-line comment that
  gives the reason (no accessible name, ambiguity, or a container scope).
- **Secret-safe assertions.** Never use `toHaveText(existingUser.email)`, because a failure would
  print the email. Use `header.accountLinkShows(email): Promise<boolean>` and
  `expect(result, 'header account link shows the existingUser email').toBe(true)`.
  The same rule applies to the billing Email prefill in TC-52 and the customer-info Email in
  TC-63.

## 3. Page objects

### 3.1 `DemoWebShopHeader` (`header.page.ts`)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `registerLink` | `getByRole('link', { name: 'Register' })` | Verified (1). |
| `loginLink` | `getByRole('link', { name: 'Log in' })` | Verified (1). |
| `logoutLink` | `getByRole('link', { name: 'Log out' })` | Verified. |
| `accountLink` | `locator('.header-links .account')` | Its accessible name is the account email (data), so a role+name locator would put data in the locator. |
| `cartLink` | `getByRole('link', { name: /^Shopping cart\s*\(\d+\)$/ })` | Verified (1). |
| `wishlistLink` | `getByRole('link', { name: /^Wishlist\s*\(\d+\)$/ })` | Verified (1). |
| `cartQty` / `wishlistQty` | `locator('.header-links .cart-qty')`, `.wishlist-qty` | Count text "(n)" has no own role. Used only by `cartCount()` and `wishlistCount()`. |
| `searchInput` | `locator('#small-searchterms')` | No label, placeholder or aria-label. Role+name resolves to 0 (discovery 4.10). |
| `searchButton` | `locator('.search-box').getByRole('button', { name: 'Search' })` | Scoped: there are 2 "Search" buttons on `/search`. |
| `autocompleteItems` | `locator('ul.ui-autocomplete li')` | **Probe P7.** jQuery UI menu without a verified role. |
| `topMenuLink(name)` | `locator('.top-menu').getByRole('link', { name, exact: true })` | Scoped: an unscoped name gives 2 (top menu and side block). |
| `mobileMenuToggle` | `locator('#mob-menu-button')` | A `div` containing an `<a href="">`. `getByRole('button', /menu/)` resolves to 0. |
| `mobileMenu`, `mobileMenuLink(name)` | `locator('.mob-top-menu')`, then `.getByRole('link', { name, exact: true })` | Verified visible after the toggle. |
| `topMenu` | `locator('.top-menu')` | For the hidden-on-mobile check. |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `search(term)` | `DemoWebShopSearchPage` | Fill, then click and wait for the URL `/search\?q=`. Then wait for the search h1. |
| `searchExpectingAlert(term?: string)` | `Promise<string>` (dialog message) | If `term` is undefined, the default "Search store" value is left untouched. Arms `page.waitForEvent('dialog')` **before** the click, accepts the dialog and returns `message()`. Equivalent to `page.once('dialog')`, but awaited, so a missing dialog fails with a timeout. |
| `searchAndObserve(term)` | `Promise<{ kind: 'alert'; message: string } \| { kind: 'navigated'; url: string }>` | TC-26: races the dialog event against `waitForURL(/\/search/)`. |
| `typeSearchPrefix(prefix)` | `void` | `pressSequentially` (jQuery autocomplete listens for key events), then waits for `autocompleteItems.first()` to be visible. |
| `openCategory(name)` | `DemoWebShopCategoryPage` | Click the top-menu link, wait for the URL change, then wait for the category h1. |
| `openCart()` / `openWishlist()` / `openAccount()` | page objects | Click, wait for the URL, then wait for the target h1. |
| `logOut()` | `DemoWebShopHomePage` | Click "Log out", wait for the URL `/`, then wait for `loginLink` to be visible. |
| `isSignedIn()` | `Promise<boolean>` | `logoutLink.isVisible()` (an instant check; callers wait first). |
| `cartCount()` / `wishlistCount()` | `Promise<number>` | Parses `(n)` from the qty text. Throws if the text cannot be parsed. |
| `accountLinkShows(email)` | `Promise<boolean>` | Compares trimmed text and never prints the value. |
| `openMobileMenu()` | `void` | Click the toggle, then wait for `mobileMenu` to be visible. |

### 3.2 `DemoWebShopNotificationBar` (`notification-bar.page.ts`)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `root` | `locator('#bar-notification')` | No role=status or alert was observed, so an id is used. |
| `success` / `error` | `locator('#bar-notification.success')`, `'#bar-notification.error'` | The class carries the outcome. |
| `closeButton` | `locator('#bar-notification .close')` | Icon without a name. |
| `link(name)` | `root.getByRole('link', { name })` | "shopping cart", "wishlist". |

Methods:

- `dismissIfVisible()`: if `root` is visible, click `closeButton` and wait for `root` to be hidden.
- `waitForShown()`: waits for `root` to be visible.

**Synchronisation rule (probe P2).** nopCommerce fades the bar out after a timeout. Any action
that produces a bar must call `dismissIfVisible()` **before** clicking, so a stale bar from an
earlier action cannot satisfy the wait. Specs assert the bar text straight after the action
returns, before the bar fades.

### 3.3 `DemoWebShopHomePage` (`home.page.ts`)

| Locator | Strategy |
| --- | --- |
| `heading` | `getByRole('heading', { level: 1 })` (expected count 0 on home: an a11y gap, TC-69) |
| `productItem(name)` | `locator('.product-item', { hasText: name })` (verified pattern) |
| `productItemAddToCart(name)` | `productItem(name).getByRole('button', { name: 'Add to cart' })` |
| `newsletterEmail` | `locator('#newsletter-email')` (no accessible name; used only by TC-69) |
| `htmlRoot` | `locator('html')` (lang check, TC-69) |

Methods:

- `open()`: goes to `'./'` and waits for `header.searchInput`.
- `openProductViaAddToCart(name)`: returns `DemoWebShopProductPage`. Clicks the item's "Add to
  cart", then waits for a URL that is not `/` and for the product h1 (TC-35; the button
  navigates for configurable products).

### 3.4 `DemoWebShopLoginPage` (`login.page.ts`)

This one class covers both `/login` and `/login/checkoutasguest` (same template, same h1); it is
extended, not forked.

| Locator | Strategy | Notes |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Welcome, Please Sign In!' })` | |
| `emailInput` | `getByLabel('Email:')` | Verified (1). |
| `passwordInput` | `getByLabel('Password:')` | Verified (1) on /login. |
| `rememberMe` | `getByLabel('Remember me?')` | |
| `loginButton` | `getByRole('button', { name: 'Log in' })` | |
| `forgotPasswordLink` | `getByRole('link', { name: 'Forgot password?' })` | Never followed. |
| `errorSummary` | `locator('.validation-summary-errors')` | No role. |
| `emailFieldError` | `locator('.field-validation-error[data-valmsg-for="Email"]')` | No association with the input. |
| `checkoutAsGuestButton` | `getByRole('button', { name: 'Checkout as Guest' })` | Verified on the checkout sign-in step. |
| `registerButton` | `getByRole('button', { name: 'Register' })` | The new-customer panel. |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open()` | `this` | `goto('login')`, then the heading. |
| `signIn(email, password)` | `Promise<'signed-in' \| 'rejected' \| 'invalid-field'>` | Fill and click, then `header.logoutLink.or(errorSummary).or(emailFieldError).first().waitFor()`. The outcome comes from whichever locator is visible. Never logs the arguments. |
| `signInExpectingSuccess(account)` | `DemoWebShopHomePage` | Calls `signIn`. If the outcome is not `'signed-in'`, throws `Error('existingUser sign-in was rejected. Check the credential with: node scripts/credentials.mjs check --app demo-web-shop')`, with no values. When the start URL had a `ReturnUrl`, use `signIn` and let the spec assert the landing page (TC-13). |
| `submitEmpty()` | `void` | Click "Log in", then `errorSummary.waitFor()`. |
| `enterEmailAndBlur(value)` | `void` | Fill, press Tab, then wait for `emailFieldError`. |
| `signInWithKeyboard(email, password)` | `Promise<{ tabsToEmail: number }>` | TC-68: presses Tab from the page start until `emailInput` is focused (maximum 30 presses, otherwise throws), types the email, presses Tab, types the password and presses Enter. Then waits as in `signIn`. |
| `checkoutAsGuest()` | `DemoWebShopCheckoutPage` | Click, wait for `/onepagecheckout`, then wait for `#opc-billing.active`. |

### 3.5 `DemoWebShopRegisterPage` (`register.page.ts`)

| Locator | Strategy |
| --- | --- |
| `male`, `female` | `getByLabel('Male', { exact: true })`, `getByLabel('Female', { exact: true })` (exact: "Male" is a substring of "Female") |
| `firstName`, `lastName` | `getByLabel('First name:')`, `getByLabel('Last name:')` |
| `email` | `getByLabel('Email:', { exact: true })` |
| `password` | `getByLabel('Password:', { exact: true })` (exact: "Confirm password:" also contains "Password:") |
| `confirmPassword` | `getByLabel('Confirm password:')` |
| `registerButton` | `getByRole('button', { name: 'Register' })` (verified 1 on /register; `#register-button` is the fallback) |
| `fieldError(field: 'FirstName' \| 'LastName' \| 'Email' \| 'Password' \| 'ConfirmPassword')` | `locator(`.field-validation-error[data-valmsg-for="${field}"]`)` (no association with the input) |
| `errorSummary` | `locator('.validation-summary-errors')` |

Methods:

- `open()`.
- `submitEmpty()`: click, then wait for `fieldError('FirstName')`.
- `enterPasswordAndBlur(v)` / `enterConfirmPasswordAndBlur(v)` / `enterEmailAndBlur(v)`: fill and
  press Tab. These do **not** wait for an error, because TC-18 also checks that *no* message
  appears for "abcdef". The spec uses web-first assertions (`toBeVisible` / `toBeHidden`).
- `attemptDuplicateRegistration({ firstName, lastName, email, password })`: fill and click, then
  wait for `errorSummary`.

There is deliberately **no** generic `register()` method, and no generator of registrable emails
(intake: never create accounts).

### 3.6 `DemoWebShopSearchPage` (`search.page.ts`)

| Locator | Strategy |
| --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Search' })` |
| `keywordInput` | `getByLabel('Search keyword:')` |
| `advancedSearch` | `getByLabel('Advanced search')` |
| `pageSearchButton` | `locator('.search-input').getByRole('button', { name: 'Search' })` (2 "Search" buttons on the page) |
| `results` | `locator('.search-results')` (container for the messages "No products were found…" and "Search term minimum length…") |
| `productItems` | `results.locator('.product-item')` |
| `productTitles` | `productItems.locator('.product-title')` (**probe P4**) |

Methods:

- `open(term?)`: `goto(`search?q=${encodeURIComponent(term)}`)` (TC-23 direct URL), then the heading.
- `productNames(): Promise<string[]>`.

Header search actions live in the header (section 3.1).

### 3.7 `DemoWebShopCategoryPage` (`category.page.ts`)

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1 })` | |
| `sortSelect` | `locator('#products-orderby')` | No accessible name; `getByRole('combobox')` gives 3. |
| `pageSizeSelect` | `locator('#products-pagesize')` | Same reason. |
| `viewModeSelect` | `locator('#products-viewmode')` | Same reason. |
| `priceFilterLink(label)` | `getByRole('link', { name: label })` | "Under 25.00", verified. |
| `removeFilterLink` | `getByRole('link', { name: 'Remove Filter' })` | |
| `pagerLink(name)` | `locator('.pager').getByRole('link', { name, exact: true })` | "Next", "Previous", "2". |
| `productItems` | `locator('.product-item')` | |
| `productGrid` / `productList` | `locator('.product-grid')` / `locator('.product-list')` | View-mode state check. |
| `productItem(name)` | `locator('.product-item', { hasText: name })` | |
| `itemAddToCart(name)` | `productItem(name).getByRole('button', { name: 'Add to cart' })` | |
| `itemPrices` | `productItems.locator('.actual-price')` | **Probe P5.** Old prices also render. |

Methods:

- `open(slug)`.
- `sortBy(label)`, `setPageSize(n)`, `viewAs('Grid' | 'List')`: each is
  `Promise.all([waitForURL(/orderby=|pagesize=|viewmode=/, dcl), select.selectOption({ label })])`,
  because `onchange` triggers a full navigation.
- `filterByPrice(label)`, `removePriceFilter()`, `goToPage('Next' | 'Previous' | string)`: click
  and wait for the URL.
- `productNames(): Promise<string[]>`, `productPrices(): Promise<number[]>`.
- `addFirstAvailableProductToCart(): Promise<string>`: finds the first `.product-item` that has an
  "Add to cart" button, records its title, calls `notification.dismissIfVisible()`, clicks, waits
  for the add-to-cart response (P1, catalog pattern) and then `notification.waitForShown()`.
  Returns the product name.

### 3.8 `DemoWebShopProductPage` (`product.page.ts`)

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1 })` | |
| `overview` | `locator('.overview')` | Scope: 6 "Add to cart" buttons per page. |
| `quantityInput` | `getByLabel('Qty:')` | The id is product-specific (`#addtocart_13_EnteredQuantity`). |
| `addToCartButton` | `overview.getByRole('button', { name: 'Add to cart' })` | Verified (1). |
| `addToWishlistButton` | `getByRole('button', { name: 'Add to wishlist' })` | Verified (1 on /health). Prefer `overview.` scoping if P4 confirms it. |
| `price` | `overview.locator('.product-price')` | **Probe P4.** Only the observed text "Price: 10.00" is known. |

Methods:

| Method | Synchronisation |
| --- | --- |
| `open(slug)` | `goto(slug, dcl)`, then the heading. Relies on the addthis block (K5). |
| `setQuantity(value: string)` | `fill`. A string, so "abc", "0" and "-1" are possible. |
| `addToCart()` | `notification.dismissIfVisible()`. Arms `page.waitForResponse(ADD_TO_CART_DETAILS_CART)` (P1), clicks, awaits the response, then `notification.waitForShown()`. The bar can be success or error; the spec asserts which. |
| `addToWishlist()` | The same, with the wishlist response pattern (P1). |
| `clickAddToCart()` | A raw click with no response wait. Used only by TC-37, TC-38 and TC-39 together with `cartNetwork` or with its own waits. |
| `doubleClickAddToCart()` | `addToCartButton.dblclick()`, then waits for the bar. The spec then reads `/cart`. |

### 3.9 `DemoWebShopCartPage` (`cart.page.ts`)

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Shopping cart' })` | **Probe P4** for the exact h1 text. Fallback: wait for `content`. |
| `content` | `locator('.order-summary-content')` | Container that holds the empty message "Your Shopping Cart is empty!" (**P4**). |
| `productColumnHeader` | `getByRole('columnheader', { name: 'Product(s)' })` | Verified (1). |
| `rows` | `locator('table.cart tbody tr')` | `getByRole('table')` gives 2. |
| `row(name)` | `rows.filter({ has: page.getByRole('link', { name, exact: true }) })` | `exact` prevents "Computing and Internet" from matching "Copy of Computing and Internet EX". |
| `rowRemoveCheckbox(name)` | `row(name).locator('input[name=removefromcart]')` | No accessible name. |
| `rowQuantityInput(name)` | `row(name).locator('input.qty-input')` | No name; the `name` attribute is dynamic. |
| `rowTotal(name)` | `row(name).locator('.product-subtotal')` | **P4.** |
| `updateCartButton` | `getByRole('button', { name: 'Update shopping cart' })` | |
| `continueShoppingButton` | `getByRole('button', { name: 'Continue shopping' })` | |
| `termsCheckbox` | `locator('#termsofservice')` | No label; `getByRole('checkbox')` gives 2. |
| `checkoutButton` | `getByRole('button', { name: 'Checkout' })` | |
| `termsDialog` | `getByRole('dialog', { name: 'Terms of service' })` | Verified jQuery UI dialog. |
| `couponInput` / `giftCardInput` | `locator('input[name=discountcouponcode]')` / `'input[name=giftcardcouponcode]'` | No label. |
| `applyCouponButton` / `addGiftCardButton` | `getByRole('button', { name: 'Apply coupon' \| 'Add gift card' })` | |
| `couponMessage` / `giftCardMessage` | `locator('.coupon-box .message')` / `'.giftcard-box .message'` | **P4.** Fallback: `locator('.cart-footer')` with `toContainText`. |
| `country` / `state` / `zip` | `getByLabel('Country:')`, `getByLabel('State / province:')`, `getByLabel('Zip / postal code:')` | Verified (1 each on the cart). |
| `estimateShippingButton` | `getByRole('button', { name: 'Estimate shipping' })` | |
| `shippingOptions` | `locator('.shipping-results')` | **P4.** |
| `totals` | `locator('.cart-total')` | Text container for Sub-Total, Shipping, Tax and Total (**P4**). |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open()` | `this` | `goto('cart')`, then `content`. |
| `productNames()` | `string[]` | |
| `rowQuantity(name)` | `number` | Reads `inputValue()`. |
| `setQuantity(name, qty: string)` then `updateCart()` | `void` | `updateCart` = click and wait for the form POST navigation (`waitForURL(/\/cart/, dcl)` plus `content` visible). |
| `removeProduct(name)` | `void` | Tick that row only, then `updateCart()`. |
| `removeReservedRows(names: readonly string[])` | `{ removed: string[] }` | Cleaner primitive; see section 4.4 for the protected-row guard. Clicks Update only if a box was ticked. |
| `attemptCheckoutWithoutTerms()` | `void` | Asserts nothing. Ensures the box is unticked, clicks Checkout, then waits for `termsDialog` to be visible. |
| `closeTermsDialog()` | `void` | Presses `Escape` (jQuery UI `closeOnEscape` default; **probe P6**), then waits for `termsDialog` to be hidden. |
| `acceptTermsAndCheckoutAsGuest()` | `DemoWebShopLoginPage` | Check the terms, click Checkout, wait for `/login/checkoutasguest`, then the heading. |
| `acceptTermsAndCheckoutSignedIn()` | `DemoWebShopCheckoutPage` | Check the terms, click Checkout, wait for `/onepagecheckout`, then `#opc-billing.active`. |
| `applyCoupon(code)` / `applyGiftCard(code)` | `void` | Fill, click and wait for the POST navigation, then the message locator. |
| `estimateShipping({ country, zip })` | `void` | `selectOption({ label: country })`, then wait for the state options to load (AJAX), fill the zip, click and wait for `shippingOptions`. |

### 3.10 `DemoWebShopWishlistPage` (`wishlist.page.ts`)

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Wishlist' })` | Verified signed in. |
| `content` | `locator('.wishlist-content')` | **P4.** Holds "The wishlist is empty!". |
| `rows`, `row(name)` | Same pattern as the cart (`table.cart tbody tr`, exact link name) | **P4** for the table class. |
| `rowRemoveCheckbox(name)` | `row(name).locator('input[name=removefromcart]')` | No name. |
| `rowAddToCartCheckbox(name)` | `row(name).locator('input[name=addtocart]')` | No name; **P4**. |
| `updateWishlistButton` | `getByRole('button', { name: 'Update wishlist' })` | |
| `addToCartButton` | `getByRole('button', { name: 'Add to cart' })` | Verified (1 with one item). |
| `shareInfo` | `locator('.share-info')` | **P4.** Holds "Your wishlist URL for sharing:" and the URL. |

Methods:

- `open()`.
- `productNames()`.
- `removeProduct(name)`: tick, click Update, wait for the POST navigation.
- `moveToCart(name)`: tick the add-to-cart box, click "Add to cart", then wait for navigation (to
  `/cart` or `/wishlist`; **R-27**, so the spec records which).
- `removeReservedRows(names)`: same guard as the cart.
- `shareUrl(): Promise<string>`: extracts `/wishlist/<guid>` with a regex.

### 3.11 `DemoWebShopCheckoutPage` (`checkout.page.ts`)

Step ids: `billing`, `shipping`, `shipping_method`, `payment_method`, `payment_info`, `confirm_order`.
Button containers: `billing`, `shipping`, `shipping-method`, `payment-method`, `payment-info`,
`confirm-order` (note the hyphen and underscore difference between ids and containers).

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Checkout' })` | |
| `step(id)` | `locator(`#opc-${id}`)` | No landmark or role. |
| `activeStep(id)` | `locator(`#opc-${id}.active`)` | Verified class transition. |
| `stepTitles` | `locator('.step-title h2')` | For the six step names. |
| `billingForm` | `locator('#billing-new-address-form')` | Scope: the labels repeat in other steps. |
| `billingField(label)` | `billingForm.getByLabel(label, { exact: true })` | Verified for First name, Last name, Email, Country, City, Address 1, Zip and Phone. |
| `billingState` | `billingForm.getByLabel('State / province:')` | |
| `billingFieldErrors` | `billingForm.locator('.field-validation-error')` | No association with the inputs. |
| `continueButton(container)` | `locator(`#${container}-buttons-container`).getByRole('button', { name: 'Continue' })` | Unscoped "Continue" is ambiguous. |
| `backLink(stepId)` | `step(stepId).getByRole('link', { name: 'Back' })` | **R-28 / P4.** |
| `shippingAddressSelect` | `getByLabel('Select a shipping address from your address book or enter a new address.')` | `#shipping-address-select` is the fallback. |
| `inStorePickup` | `getByLabel('In-Store Pickup')` | |
| `shippingOption(name)` | `step('shipping_method').getByLabel(new RegExp(`^${name} \\(`))` | Verified with the exact form `'Ground (10.00)'`. The regex tolerates price changes (**P11**). |
| `codRadio` | `step('payment_method').getByLabel(/Cash On Delivery/)` | Verified (1). Two labels per radio. |
| `checkedPaymentMethod` | `locator('input[name=paymentmethod]:checked')` | Read for its `value`. |
| `paymentInfo` | `step('payment_info')` | Text "You will pay by COD". |
| `confirmButton` | `locator('#confirm-order-buttons-container').getByRole('button', { name: 'Confirm' })` | |
| `summaryBilling`, `summaryShipping`, `summaryPaymentMethod`, `summaryShippingMethod`, `summaryCart`, `summaryTotals` | `#opc-confirm_order .billing-info`, `.shipping-info`, `.payment-method-info`, `.shipping-method-info`, `.cart`, `.cart-total` | No roles. `.payment-method-info` and `.shipping-method-info` are **P4**. |

Methods (each `continue*` waits for the **next** step's `#opc-<next>.active` and then for its
buttons container to be visible; never a sleep):

| Method | Returns |
| --- | --- |
| `fillBillingAddress(guest: GuestCustomer)` | `void`. Fills the fields. `selectOption({ label: 'United States' })` on Country, then waits for `billingState.locator('option', { hasText: guest.state })` to be attached (the state list loads by AJAX), then selects the state. |
| `continueBilling()` | `void`. **Guard:** throws `Error('D5: signed-in checkout must stop at Billing')` if `header.logoutLink` is visible. Clicks Continue and waits for `#opc-shipping.active`. |
| `continueBillingExpectingErrors()` | `void`. Click, then wait for `billingFieldErrors.first()` (TC-59). `#opc-billing.active` stays. |
| `continueShippingAddress()` | Waits for `#opc-shipping_method.active`. |
| `chooseShippingMethod('Ground')`, `continueShippingMethod()` | Waits for `#opc-payment_method.active`. |
| `selectCashOnDelivery()` | `codRadio.check()`, then `assertCashOnDelivery()`. |
| `continuePaymentMethod()` | Calls `assertCashOnDelivery()` **before** clicking. Waits for `#opc-payment_info.active`. |
| `continuePaymentInfo()` | Waits for `#opc-confirm_order.active`. |
| `proceedToConfirmAsGuest(guest)` | Composite of the six steps above. Used as Arrange in TC-60 and TC-61. |
| `confirmCashOnDeliveryOrder()` | `DemoWebShopOrderCompletedPage`. Calls `assertCashOnDelivery()` and checks that `summaryPaymentMethod` text contains "Cash On Delivery (COD)" (throws otherwise). Clicks Confirm **once** and waits for `/checkout\/completed/` (dcl) and the "Thank you" h1. It never clicks again. |
| `goBackFrom(stepId)` | `void`. Clicks Back, then waits for the previous step to be `.active`. |

### 3.12 Safety guards (they throw; they are not assertions)

`assertCashOnDelivery()` (private, in the checkout page) reads `checkedPaymentMethod`'s `value`.
If it is not `'Payments.CashOnDelivery'`, it throws
`Error('Refusing to continue: payment method is "<value>", only Payments.CashOnDelivery is allowed')`.
The value is a method id, not a secret.

There is **no** public method that selects any other payment method, enters card data, saves a
customer profile or address, or changes a password. `continueBilling()` refuses to run when
signed in (D5).

### 3.13 `DemoWebShopOrderCompletedPage` (`order-completed.page.ts`)

| Locator | Strategy |
| --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Thank you' })` |
| `details` | `locator('.order-completed')` (text "Your order has been successfully processed!" and "Order number: n"; **P4**) |
| `orderDetailsLink` | `getByRole('link', { name: 'Click here for order details.' })` |
| `continueButton` | `getByRole('button', { name: 'Continue' })` |

Methods:

- `orderNumber(): Promise<string>`: `/Order number:\s*(\d+)/`; throws if absent.
- `openOrderDetails(): DemoWebShopOrderPage`: click, wait for `/orderdetails\/\d+/`, then the h1.

### 3.14 `DemoWebShopOrderPage` (`order.page.ts`, `/orderdetails/<id>`)

This keeps the catalogue's `pageObject` name for TC-61.

| Locator | Strategy |
| --- | --- |
| `heading` | `getByRole('heading', { level: 1, name: 'Order information' })` |
| `overview` | `locator('.order-overview')` (Order #, Date, Status and Total text; **P4**) |
| `billingInfo`, `shippingInfo`, `paymentMethodInfo`, `shippingMethodInfo` | `.billing-info`, `.shipping-info`, `.payment-method-info`, `.shipping-method-info` (**P4**) |
| `productRow(name)` | `locator('.products tbody tr', { hasText: name })` (**P4**) |
| `totals` | `locator('.total-info')` (**P4**) |

Fallback for every **P4** container on this page: `locator('.page-body')` with `toContainText`.
The page is read-only.

### 3.15 `DemoWebShopAccountPage` (`account.page.ts`)

`type AccountSection = 'info' | 'addresses' | 'orders' | 'changepassword' | 'downloadableproducts' | 'rewardpoints' | 'backinstocksubscriptions'`.

| Locator | Strategy | Reason |
| --- | --- | --- |
| `heading` | `getByRole('heading', { level: 1 })` | |
| `navigation` | `locator('.block-account-navigation')` | Scope: "Addresses" and "Orders" repeat in the footer. |
| `navLink(name)` | `navigation.getByRole('link', { name, exact: true })` | |
| `pageBody` | `locator('.page-body')` | Text container for the "No addresses", "No orders" and reward-points texts (**P4**). |
| `gender(name)` | `getByLabel(name, { exact: true })` | |
| `firstName`, `lastName`, `email` | `getByLabel('First name:', { exact: true })`, … | |
| `saveButton` | `getByRole('button', { name: 'Save' })` | Visibility only, **never clicked**. |
| `addNewAddressButton` | `getByRole('button', { name: 'Add new' })` | Visibility only. |
| `oldPassword`, `newPassword`, `confirmNewPassword` | `getByLabel('Old password:')`, `getByLabel('New password:')`, `getByLabel('Confirm password:')` | |
| `changePasswordButton` | `getByRole('button', { name: 'Change password' })` | Visibility only. |

Methods:

- `goto(section)`: raw navigation `customer/<section>` (dcl) with no ready wait. Used by TC-12
  and TC-10, where a redirect to login is expected.
- `open(section)`: `goto`, then wait for the h1.
- `openSection(linkName)`: click a nav link, wait for the URL, then the h1.
- `emailFieldShows(email): Promise<boolean>`: secret-safe comparison.

There are **no** submit methods (requirements section 6).

## 4. Fixtures (`fixtures/demo-web-shop.fixture.ts`)

### 4.1 Types and skeleton

```ts
import { test as base, expect, type Page } from '@playwright/test';
import { getAccount, type Account } from '../lib/credentials-store.cjs';

type GuestCustomer = typeof GUEST_ADDRESS & { email: string };
interface AccountBaseline { cartCount: number; wishlistCount: number }
interface AccountCartCleaner { baseline: AccountBaseline; purge(): Promise<void> }
interface CartNetwork {
  abortNext(kind?: 'details' | 'catalog'): Promise<void>;          // resolves when the route fired
  failNextWith(status: number, kind?: 'details' | 'catalog'): Promise<void>;
  hits(): number;
}

type Fixtures = {
  header: DemoWebShopHeader; notification: DemoWebShopNotificationBar;
  homePage: DemoWebShopHomePage; loginPage: DemoWebShopLoginPage; registerPage: DemoWebShopRegisterPage;
  searchPage: DemoWebShopSearchPage; categoryPage: DemoWebShopCategoryPage; productPage: DemoWebShopProductPage;
  cartPage: DemoWebShopCartPage; wishlistPage: DemoWebShopWishlistPage; checkoutPage: DemoWebShopCheckoutPage;
  orderCompletedPage: DemoWebShopOrderCompletedPage; orderPage: DemoWebShopOrderPage; accountPage: DemoWebShopAccountPage;
  signInAsExistingUser: () => Promise<void>;
  signedIn: { header: DemoWebShopHeader };
  accountCartCleaner: AccountCartCleaner;
  uniqueGuest: GuestCustomer;
  cartNetwork: CartNetwork;
  blockThirdPartyScripts: void;   // auto
};
type WorkerFixtures = { existingUser: Account };

export const test = base.extend<Fixtures, WorkerFixtures>({ /* see 4.2 */ });
export { expect };
export function chromiumOnly(reason = 'Chromium only (D2): mutates the shared account or places an order'): void {
  test.skip(({ browserName }) => browserName !== 'chromium', reason);
}
export function recordObservation(type: string, description: string): void {
  test.info().annotations.push({ type, description });
}
```

### 4.2 Fixture definitions

| Fixture | Scope | Depends on | Behaviour |
| --- | --- | --- | --- |
| `blockThirdPartyScripts` | test, **auto** | `context` | `context.route(THIRD_PARTY_BLOCKLIST, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))`. The blocklist is `['**/s7.addthis.com/**']` in data. Context-level, so it covers popups too. A test that creates its own context must call the exported `blockThirdParty(context)`; the plan has none. |
| page objects (14) | test | `page` | `new DemoWebShopXxxPage(page)`. Lazy: built only when requested. |
| `existingUser` | **worker** | none | `await use(await getAccount('demo-web-shop', 'existingUser', { required: ['email', 'password'] }))`. If the role or a field is missing, `getAccount` throws a descriptive error with no values, and **the test fails** (it is not skipped). Guest-only tests never request this fixture, so they run without credentials. No scenario is credential-optional, so `test.skip` is never used for credentials. |
| `signInAsExistingUser` | test | `existingUser`, `loginPage`, `page` | Returns an async function: (1) circuit breaker: if `<runDir>/.existing-user-login-rejected` exists, throw `Error('Skipping sign-in: existingUser was rejected earlier in this run (lockout protection, R-04)')` without attempting; (2) `loginPage.open()`, then `signIn(email, password)`; (3) if `'rejected'`, write the marker file (no contents) and throw the section 3.4 error; (4) wait for `header.logoutLink`. `runDir` = `artifacts/${TEST_SUITE ?? 'default'}/runs/${E2E_RUN_ID}`, the same formula as `playwright.config.ts`. It is git-ignored and survives worker restarts. |
| `signedIn` | test | `signInAsExistingUser`, `header` | Calls `signInAsExistingUser()` once, then `use({ header })`. There is no logout on teardown: the context is discarded, and the account cart persists server-side by design. |
| `accountCartCleaner` | test, `{ timeout: 60_000 }` | `signedIn`, `cartPage`, `wishlistPage`, `header`, `signInAsExistingUser` | **Setup:** `purge()`, then `baseline = { cartCount: await header.cartCount(), wishlistCount: await header.wishlistCount() }`. **Teardown (always, also after failure):** if `!(await header.isSignedIn())`, call `signInAsExistingUser()` (an extra login only on the logout paths of TC-50 and TC-51), then `purge()`. `purge()` = `cartPage.open()`, `removeReservedRows(RESERVED_TEST_PRODUCTS)`, then `wishlistPage.open()`, `removeReservedRows(RESERVED_TEST_PRODUCTS)`. |
| `uniqueGuest` | test | none | `{ ...GUEST_ADDRESS, email: uniqueGuestEmail() }`. |
| `cartNetwork` | test | `page` | Registers `page.route(ADD_TO_CART_URL[kind], handler, { times: 1 })` with a handler that aborts (`route.abort('failed')`) or fulfils `{ status, body: '' }`, then resolves a deferred so the spec can `await` that the route fired. **Teardown:** `page.unrouteAll({ behavior: 'ignoreErrors' })`. The URL pattern comes from P1. |

### 4.3 Helpers (exported functions, not fixtures)

- `chromiumOnly(reason?)`: called as the first statement inside a `test.describe`. Applies to
  TC-02, 049, 050, 051, 052, 057 and 061.
- `recordObservation(type, description)`: annotations for "record on first run" items (R-17 and
  R-20 to R-28), the order number in TC-61, the tab order in TC-68 and accessibility gaps in
  TC-69. Never pass account values.
- `reportOnly(description, check: () => Promise<void>)`: runs `check`. If it throws, the failure
  is recorded with `recordObservation('a11y-gap', description)` and swallowed. Used only in
  `accessibility.spec.ts` (report-only per D4 and R-31).

### 4.4 Cleaner guard (`removeReservedRows`, shared logic in the cart and wishlist pages)

1. Read all row names (exact link text) and quantities, giving a snapshot `before`.
2. `targets = before ∩ RESERVED_TEST_PRODUCTS`. If a name in `PROTECTED_ACCOUNT_ITEMS`
   ("14.1-inch Laptop") is also in `targets`, throw. This should be impossible, but it is checked.
3. If `targets` is empty, return `{ removed: [] }` (idempotent, and no POST is made).
4. Tick only `rowRemoveCheckbox(name)` for each target. Then confirm that the number of ticked
   remove boxes equals `targets.length`; throw otherwise.
5. Click Update and wait for navigation.
6. Read `after`. Every non-target row in `before` must still exist with the same quantity.
   Otherwise throw `Error('Cleanup changed a row it does not own: <product name>')`; product names
   are not secrets. Every target must be gone.

## 5. Test data (`test-data/demo-web-shop.data.ts`)

| Export | Content |
| --- | --- |
| `PRODUCTS` | `computingAndInternet: { name: 'Computing and Internet', path: 'computing-and-internet', price: 10 }`, `healthBook: { name: 'Health Book', path: 'health', price: 10 }`, `buildYourOwnComputer: { name: 'Build your own computer', path: 'build-your-own-computer' }`, `science: { name: 'Science' }` (filter check) |
| `RESERVED_TEST_PRODUCTS` | `['Health Book', 'Computing and Internet'] as const` (D1, R-16) |
| `PROTECTED_ACCOUNT_ITEMS` | `['14.1-inch Laptop'] as const` (never touched) |
| `MESSAGES` | Every exact text from discovery section 4, for example `loginFailed`, `credentialsIncorrect`, `noCustomerAccount`, `invalidEmailLogin` ("Please enter a valid email address."), register messages, `searchNoResults`, `searchMinLength`, `searchAlert`, `addedToCart`, `addedToWishlist`, `quantityPositive`, `cartEmpty`, `wishlistEmpty`, `termsRequired`, `couponInvalid`, `emailExists`, billing errors (the last four have **no trailing period**), `orderSuccess`, `orderThankYou`, `payByCod`. |
| `SEARCH` | `{ match: 'computer', noMatch: 'zzqxnotfound', tooShortHeader: 'ab', tooShortUrl: 'a', autocompletePrefix: 'comp', whitespace: '   ' }` |
| `INVALID` | `{ loginEmail: 'abc', email: 'not-an-email', qty: ['0', 'abc'], negativeQty: '-1', coupon: 'INVALIDCOUPON', giftCard: 'INVALIDGIFT', shortPasswords: ['abc', 'abcde'], minPassword: 'abcdef', mismatchConfirm: 'abcdeg' }` |
| `GUEST_ADDRESS` | `{ firstName: 'QA', lastName: 'Automation', country: 'United States', state: 'New York', city: 'Testville', address1: '1 Test Street', zip: '10001', phone: '5550100' }` (D5) |
| `ACCOUNT_SECTIONS_PROTECTED` | `['info', 'orders', 'addresses', 'changepassword', 'downloadableproducts', 'rewardpoints']` (TC-12) |
| `CHECKOUT_STEP_TITLES` | The six step names in order. |
| `MOBILE_VIEWPORT` | `{ width: 375, height: 812 }` |
| `THIRD_PARTY_BLOCKLIST` | `['**/s7.addthis.com/**']` |
| `ADD_TO_CART_URL` | `{ details: /\/addproducttocart\/details\/\d+\/1(\b\|\/\|$)/, wishlist: /\/addproducttocart\/details\/\d+\/2/, catalog: /\/addproducttocart\/catalog\/\d+\/1/ }`. **Assumed nopCommerce routes; replace with the P1 result before use.** |
| Generators | `uniqueSuffix()` = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; `uniqueGuestEmail()` = `qa.guest+${uniqueSuffix()}@example.test`; `unknownEmail()` = `qa.unknown+${…}@example.test`; `wrongLoginValue()` = `wrong-${…}`; `registerDummyPassword()` = `Qa-${…}` |

There are no secrets in this file. Account values come only from `existingUser`.

## 6. Data strategy and isolation

- **Execution model.** `workers: 1` and `fullyParallel: false` (unchanged). The three projects run
  one after another in one invocation. **Concurrent invocations against the same account
  (two machines, or CI shards) are unsupported**; document this in the run instructions.
- **Guest isolation.** Each test gets a fresh browser context (the Playwright default), so it gets
  a new nopCommerce guest cookie and therefore an independent guest cart and wishlist. Guest
  tests need no cleanup. TC-60 empties its guest cart in a best-effort teardown, because the
  scenario asks for it.
- **Guest cart setup.** Through the UI, using `productPage.open(...)` and then `addToCart()`
  (observed behaviour). Optional speed-up: once P1 confirms the endpoint and form fields, an
  `addToGuestCart(product)` helper may `page.request.post(...)` the same AJAX call. `page.request`
  shares the context cookies. This is not part of the baseline plan.
- **Account isolation (D1).** Only reserved products are added. The cleaner purges them before
  and after each mutating test. Assertions are relative (`baseline.cartCount + 1`). The guard in
  section 4.4 proves that foreign rows are unchanged.
- **Order isolation (D5).** Orders are placed only as a guest, with a unique email per test
  (`uniqueGuest`), on Chromium only, with retries disabled. Each run creates one permanent order,
  which the user accepted (R-06).
- **No API was observed.** nopCommerce exposes no public REST API here. There is no API cleanup.
  The cart and wishlist purge goes through the UI.
- **Shared catalogue (R-02).** Assert names, order, ranges and containment. Never assert totals
  across the whole catalogue. Cart totals are derived from `PRODUCTS.*.price`, so a price change
  is a single edit.

## 7. Spec mapping (all 70 scenarios)

Titles start with `[DWS-nnn]` (required by `lib/artifact-reporter.ts`'s ID pattern). Tags go in
the details argument (`{ tag: [...] }`), never in the title.

| ID | Spec file | Planned test title | Fixtures / notes |
| --- | --- | --- | --- |
| TC-01 | auth.spec.ts | `[TC-01] Registered customer signs in with valid credentials` | existingUser, loginPage, header; secret-safe email check |
| TC-02 | auth.spec.ts | `[TC-02] Known email with a wrong password is rejected` | Own describe: `chromiumOnly()`, `configure({ retries: 0 })`; last test in the file; `wrongLoginValue()` |
| TC-03 | auth.spec.ts | `[TC-03] Unknown email is rejected` | `unknownEmail()` |
| TC-04 | auth.spec.ts | `[TC-04] Login with both fields empty shows the server summary` | |
| TC-05 | auth.spec.ts | `[TC-05] Malformed email is flagged client-side` | |
| TC-06 | auth.spec.ts | `[TC-06] Whitespace-only email does not sign the user in` | records the message (R-17) |
| TC-07 | session.spec.ts | `[TC-07] Signed-in session survives a page reload` | signedIn |
| TC-08 | session.spec.ts | `[TC-08] Logout restores the guest header` | signedIn |
| TC-09 | session.spec.ts | `[TC-09] Back navigation after logout shows no signed-in content` | signedIn; `goBack` dcl |
| TC-10 | session.spec.ts | `[TC-10] Cleared session cookies force login on account pages` | signedIn; `context.clearCookies()` |
| TC-11 | session.spec.ts | `[TC-11] Login page renders while already signed in` | signedIn (R-19) |
| TC-12 | authorization.spec.ts | `[TC-12] Guest is redirected to login from protected account pages` | loops over `ACCOUNT_SECTIONS_PROTECTED` with `test.step` per page; `accountPage.goto` |
| TC-13 | authorization.spec.ts | `[TC-13] Sign-in from a ReturnUrl redirect returns to the requested page` | existingUser; asserts the assumed landing page and records the actual URL (R-20) |
| TC-14 | authorization.spec.ts | `[TC-14] Back-in-stock subscriptions page is reachable by a guest` | possible defect R-21 annotation |
| TC-15 | checkout-guest.spec.ts | `[TC-15] Direct checkout with an empty guest cart redirects to the cart` | |
| TC-16 | register.spec.ts | `[TC-16] Empty registration form shows required messages` | |
| TC-17 | register.spec.ts | `[TC-17] Invalid email format is rejected` | |
| TC-18 | register.spec.ts | `[TC-18] Password length boundary 5 vs 6 characters` | |
| TC-19 | register.spec.ts | `[TC-19] Confirm password mismatch is rejected` | |
| TC-20 | register.spec.ts | `[TC-20] Duplicate email registration is rejected without creating an account` | existingUser (email only used); `registerDummyPassword()` |
| TC-21 | search.spec.ts | `[TC-21] Header search returns matching products` | |
| TC-22 | search.spec.ts | `[TC-22] Search with no matches shows the empty message` | |
| TC-23 | search.spec.ts | `[TC-23] Search term below the minimum length is rejected` | header and direct URL |
| TC-24 | search.spec.ts | `[TC-24] Empty or default search term triggers an alert` | `searchExpectingAlert` twice (reload dcl between) |
| TC-25 | search.spec.ts | `[TC-25] Header search autocomplete suggests products` | P7 |
| TC-26 | search.spec.ts | `[TC-26] Whitespace-only search lists no products` | `searchAndObserve`; records (R-22) |
| TC-27 | listing.spec.ts | `[TC-27] Books from the top menu sorted by price low to high` | |
| TC-28 | listing.spec.ts | `[TC-28] Books sorted by name Z to A` | |
| TC-29 | listing.spec.ts | `[TC-29] Page size 4 paginates to page 2` | |
| TC-30 | listing.spec.ts | `[TC-30] List view replaces the grid` | |
| TC-31 | listing.spec.ts | `[TC-31] Under 25.00 price filter applies and is removed` | P5 |
| TC-32 | product.spec.ts | `[TC-32] Guest adds a product to the cart from its page` | |
| TC-33 | product.spec.ts | `[TC-33] Quantity 0 and non-numeric quantity are rejected` | |
| TC-34 | product.spec.ts | `[TC-34] Negative quantity on the product page adds nothing` | records bar text (R-23) |
| TC-35 | product.spec.ts | `[TC-35] Home Add to cart on a configurable product opens its page` | homePage |
| TC-36 | product.spec.ts | `[TC-36] Add to cart from the category listing` | `addFirstAvailableProductToCart` |
| TC-37 | resilience.spec.ts | `[TC-37] Aborted add-to-cart request leaves the cart empty` | cartNetwork.abortNext; dialog capture |
| TC-38 | resilience.spec.ts | `[TC-38] Add to cart succeeds on retry after a simulated 500` | cartNetwork.failNextWith(500) |
| TC-39 | product.spec.ts | `[TC-39] Double-click on Add to cart keeps header and cart consistent` | records count (R-25) |
| TC-40 | cart-guest.spec.ts | `[TC-40] Updating quantity recalculates cart totals` | Arrange: add Computing and Internet |
| TC-41 | cart-guest.spec.ts | `[TC-41] Removing the only item empties the cart` | |
| TC-42 | cart-guest.spec.ts | `[TC-42] Quantity 0 or -1 on update silently removes the row` | R-11 annotation |
| TC-43 | cart-guest.spec.ts | `[TC-43] Checkout is blocked until terms of service are accepted` | |
| TC-44 | cart-guest.spec.ts | `[TC-44] Invalid coupon code is rejected` | |
| TC-45 | cart-guest.spec.ts | `[TC-45] Invalid gift card code shows the coupon message` | R-12 annotation |
| TC-46 | cart-guest.spec.ts | `[TC-46] New guest sees the empty cart state` | |
| TC-47 | cart-guest.spec.ts | `[TC-47] Estimate shipping lists shipping options` | R-13 annotation |
| TC-48 | cart-guest.spec.ts | `[TC-48] Guest cart persists after a page refresh` | |
| TC-49 | cart-signed-in.spec.ts | `[TC-49] Signed-in customer adds an own item without touching existing items` | describe: `chromiumOnly()`; accountCartCleaner; tags `@mutates-account` |
| TC-50 | cart-signed-in.spec.ts | `[TC-50] Account cart persists across logout and login` | + `signInAsExistingUser` for the second login |
| TC-51 | cart-signed-in.spec.ts | `[TC-51] Guest cart merges into the account cart on login` | cleaner (baseline N), then `header.logOut()`, guest add, `signInAsExistingUser()` |
| TC-52 | checkout-signed-in.spec.ts | `[TC-52] Signed-in checkout reaches Billing with prefilled details` | `chromiumOnly()`; accountCartCleaner; **never** Continue (guarded) |
| TC-53 | wishlist.spec.ts | `[TC-53] New guest sees the empty wishlist state` | |
| TC-54 | wishlist.spec.ts | `[TC-54] Guest adds a product to the wishlist` | |
| TC-55 | wishlist.spec.ts | `[TC-55] Guest wishlist shows the share URL and removes the item` | R-15: assert the path only |
| TC-56 | wishlist.spec.ts | `[TC-56] Wishlist item moves to the cart` | records wishlist state (R-27) |
| TC-57 | wishlist.spec.ts | `[TC-57] Signed-in customer adds and removes an own wishlist item` | own describe: `chromiumOnly()`; accountCartCleaner (wishlistCount W) |
| TC-58 | checkout-guest.spec.ts | `[TC-58] Guest reaches checkout via Checkout as Guest` | |
| TC-59 | checkout-guest.spec.ts | `[TC-59] Billing step enforces required fields and email format` | |
| TC-60 | checkout-guest.spec.ts | `[TC-60] Guest checkout reaches the Confirm Order summary without placing an order` | uniqueGuest; `test.slow()`; no Confirm |
| TC-61 | checkout-cod.spec.ts | `[TC-61] Guest places a Cash On Delivery order end to end` | file: `chromiumOnly()`, `configure({ retries: 0 })`, `test.slow()`; uniqueGuest; tag `@places-order`; records the order number |
| TC-62 | checkout-guest.spec.ts | `[TC-62] Back on the Shipping Address step returns to Billing` | uniqueGuest; R-28 |
| TC-63 | account.spec.ts | `[TC-63] Customer info and account navigation are shown read-only` | signedIn |
| TC-64 | account.spec.ts | `[TC-64] Addresses, Orders and Reward points show empty states` | signedIn; on mismatch annotate "ASSUMPTION-01 broken" and fail with that message |
| TC-65 | account.spec.ts | `[TC-65] Change password form fields are present` | signedIn; never submitted |
| TC-66 | (none) | No test. **Blocked** (R-05): the page never renders. A comment in account.spec.ts references it. | |
| TC-67 | responsive.spec.ts | `[TC-67] Mobile layout shows the category menu at 375x812` | `test.use` viewport and `hasTouch`; `isMobile` false on Firefox (P8) |
| TC-68 *(removed, D6)* | accessibility.spec.ts | `[TC-68] Keyboard-only sign-in` | existingUser; report-only; records `tabsToEmail` |
| TC-69 *(removed, D6)* | accessibility.spec.ts | `[TC-69] Known accessibility gaps are reported` | `reportOnly` checks (html lang, home h1, unnamed controls via `toHaveAccessibleName`) |
| TC-70 *(removed, D6)* | (none) | No test. **Manual**: `@axe-core/playwright` is not installed (R-32). | |

Totals: **68 automated tests** and 2 not automated. Chromium-only: TC-02, 049, 050, 051, 052,
057 and 061. All others run on all three browsers.

Spec structure rules:

- One `test.describe('<Area>')` per file.
- Chromium-only tests sit in a nested `test.describe` that starts with `chromiumOnly()`.
- Arrange steps call page objects inside `test.step('Arrange: …')`. Assertions use `expect`
  (web-first) in the spec.
- Count-relative example:
  `await expect(header.cartLink).toHaveText(`Shopping cart (${cleaner.baseline.cartCount + 1})`)`.

## 8. Network and failure simulation

| Scenario | Mechanism | Assertions |
| --- | --- | --- |
| All tests | Auto `context.route('**/s7.addthis.com/**')` fulfilled with an empty script (K5) | n/a |
| TC-37 | `const fired = cartNetwork.abortNext('details')`; `productPage.clickAddToCart()`; `await fired`. Also `page.once('dialog')` captures any `alert` (nopCommerce's `AjaxCart` failure handler may raise one; Playwright auto-dismisses dialogs without a listener). The message is recorded, not asserted. | `notification.success` not visible; header "Shopping cart (0)"; `/cart` empty message (R-24) |
| TC-38 | `cartNetwork.failNextWith(500, 'details')` (`times: 1` auto-unroutes); click, `await fired`, record any UI; then `productPage.addToCart()` (real request) | Success bar, header "(1)", `/cart` row qty 1 (exactly one unit) |
| TC-24, 026 | `page.waitForEvent('dialog')` armed before the click (inside the header page object) | Dialog message text |
| TC-43, 052 | jQuery UI dialog, not a native dialog: `cartPage.termsDialog` | Dialog text, URL `/cart` |
| TC-10 | `context.clearCookies()` (session expiry simulation) | Redirect to the login ReturnUrl |

`page.route` registrations are always made **before** the action that triggers the request.
`cartNetwork` removes its routes on teardown. No other scenario intercepts application traffic.

## 9. Risks and probes for the implementer (do these first)

Run each probe as a throwaway script under `artifacts/demo-web-shop/discovery/probes/` (it is
git-ignored). Probes run as a **guest only**, except P9 and P13, which use the normal suite on
Chromium.

| # | Verify | Why / fallback |
| --- | --- | --- |
| P1 | Exact add-to-cart AJAX request: URL, method and form fields for the product page cart (`/addproducttocart/details/13/1`?), the product page wishlist (`.../2`?) and the listing (`/addproducttocart/catalog/<id>/1/1`?). Also the response JSON shape, and the UI behaviour when the request is aborted or returns 500 (alert text?). | `ADD_TO_CART_URL`, `addToCart()` response waits, TC-37 and TC-38. If the URLs differ, update the data only. |
| P2 | Notification bar auto-hide timing and whether `.close` works; that `dismissIfVisible()` and then a new action shows a fresh bar. | Stale-bar synchronisation. If the bar fades in under about 2 s, assert straight after `waitForShown()`. |
| P3 | With the addthis route fulfilled, `goto('computing-and-internet')` reaches `load` quickly; list any other failing third-party hosts. | Extend `THIRD_PARTY_BLOCKLIST` if needed. |
| P4 | Containers marked **P4**: `.order-summary-content`, `.product-subtotal`, `.coupon-box .message`, `.giftcard-box .message`, `.shipping-results`, `.cart-total`, the wishlist table class, `input[name=addtocart]`, `.share-info`, the cart h1 text, `.search-results .product-title`, `.product-price`, the checkout `.payment-method-info` and `.shipping-method-info`, the completed and order-details containers, and the account `.page-body`. | Use the `.page-body` plus `toContainText` fallback where a container differs. |
| P5 | Listing price element (`.actual-price`) excludes old prices. | TC-27 and TC-31 price ordering and filtering. |
| P6 | Terms dialog closes on `Escape` (or a titlebar close button name). | `closeTermsDialog()` for TC-52. |
| P7 | Autocomplete list selector and item text. | TC-25. |
| P8 | `isMobile` throws on Firefox; `hasTouch` support. | TC-67 `test.use` with a function override: `isMobile: async ({ browserName }, use) => use(browserName !== 'firefox')`. Confirm it type-checks. |
| P9 | **Secret exposure in reports.** Run TC-01 once and search the HTML report, the `results.json` step titles and a retained trace for the password. | If it appears: wrap the login fill in `test.step('Sign in as existingUser', …, { box: true })`; if it is still shown, set `test.use({ trace: 'off' })` in specs that sign in. Screenshots (`screenshot: 'on'`) show the email in the header; they are git-ignored local artifacts, but tell the user. |
| P10 | First-run recording for R-17, R-20, R-22, R-23, R-25, R-27 and R-28 (TC-06, 013, 026, 034, 039, 056, 062). | Turn the recorded observations into assertions after review, then update scenarios.json. |
| P11 | The shipping-method label regex `^Ground \(` resolves to 1. | TC-60 and TC-61. |
| P12 | After a rejected login the page is `/login` (POST re-render), and the `.or()` wait resolves for every outcome. Also the case of the ReturnUrl in the redirect (`%2f` lower case). | Use case-insensitive URL regexes. |
| P13 | First signed-in cleanup run: the guard confirms that the "14.1-inch Laptop" row and its quantity are unchanged after "Update shopping cart". | If the Update POST changes foreign rows, stop and escalate; do not weaken the guard. |

Other risks:

- **Lockout (R-04).** TC-02 is the only deliberate wrong-password attempt against
  existingUser. The circuit breaker limits accidental rejections to one per run. Never add
  `--repeat-each` or retries to auth.spec.ts.
- **Shared public demo (R-02).** Outages show up as navigation timeouts. Classify them as
  environment failures, not product defects.
- **Firefox and WebKit unverified (R-09).** Treat their first run as exploratory.
- **TC-64 depends on account state (R-29).** It fails with an explicit "ASSUMPTION-01 broken"
  message rather than a generic text mismatch.
- **TypeScript.** Run `npx tsc --noEmit` before the first execution (strict mode; the `.cjs`
  import resolves through `lib/credentials-store.d.cts`).

## 10. Implementation probes (2026-11-05, guest only except P9 and P13)

Scripts and outputs: `artifacts/demo-web-shop/discovery/probes/i1-impl-guest.mjs` … `i4-tab-order.mjs`
(`i1-out.json`, `i2-out.json`), `p9-secret-scan.mjs`.

| # | Finding | Effect on the suite |
| --- | --- | --- |
| P1 | Product page Add to cart: `POST /addproducttocart/details/13/1` (form `addtocart_13.EnteredQuantity=1`); wishlist: `POST /addproducttocart/details/22/2`; listing: `POST /addproducttocart/catalog/13/1/1` (empty body). Response JSON `{ success, message, updatetopcartsectionhtml: "(1)", … }`. On **abort** and on **HTTP 500** the AjaxCart failure handler raises a native alert "Failed to add the product to the cart. Please refresh the page and try one more time."; no bar, header stays "(0)", button stays enabled; a retry adds exactly 1. | `ADD_TO_CART_URL` confirmed. TC-37/038 wait for the alert as the sync point and record its text (R-24 is now observed; it can be promoted to an assertion after review). A `click()` only resolves after the alert is handled, so the page objects await the dialog before awaiting the click. |
| P2 | Bar auto-hides about 4.3 s after it is shown; `.close` hides it in about 0.8 s (`display: none`). The message is in `#bar-notification .content`. | Assert the bar straight after the action. `dismissIfVisible()` uses `dispatchEvent('click')` so a bar already fading cannot make the click wait for a hidden target. |
| P3 | With the addthis route fulfilled, `/computing-and-internet` reaches `load` in about 5 s; no other failing hosts. | Blocklist unchanged. |
| P4 | Verified: cart h1 "Shopping cart"; `.order-summary-content`; `.product-subtotal`; `.cart-total` rows with `.cart-total-right` values; `.coupon-box .message` and `.giftcard-box .message`; `.shipping-results .option-name`; wishlist `.wishlist-content table.cart`, `input[name=addtocart]`, `.share-info`; `.search-results .product-title`; `.overview .product-price`. Row product link is `td.product a` (class `product-name` only in the cart). **Not present:** `#opc-confirm_order .payment-method-info` / `.shipping-method-info`; the summary uses `.billing-info .payment-method` and `.shipping-info .shipping-method`. Billing email error is `[data-valmsg-for="BillingNewAddress.Email"]`. Completion and order-details pages use the `.page-body` fallback. | Locators set accordingly. A same-URL form POST (cart update, coupon, login rejection) is not detected by `waitForURL`; `navigateBy()` waits for the main-frame `framenavigated` event and then `domcontentloaded`. |
| P5 | `.actual-price` excludes old prices (old prices are in `.old-price`). | `productPrices()` uses `.actual-price`. |
| P6 | **Escape closes** the Terms of service dialog (titlebar button "close" also exists). | `closeTermsDialog()` presses Escape. |
| P7 | Autocomplete items are `ul.ui-autocomplete li` (`role="presentation"`, no option/menuitem role); items as in discovery 4.3. | `autocompleteItem(name)` filters by exact text. |
| P8 | Playwright 1.64 Firefox **accepts** `isMobile: true` in `newContext` (no throw); layout at 375 px is correct (scrollWidth 375, toggle visible, top menu hidden) on Firefox and WebKit. | TC-67 keeps the override `isMobile: browserName !== 'firefox'` (documented as unsupported on Firefox); it type-checks. |
| P9 | `locator.fill(value)` / `keyboard.type(value)` put the value into HTML report step titles (`Fill "<value>"`); a boxed `test.step` does **not** hide nested steps. | Account values are filled with `fillAccountValue()` (`evaluate`, reported as "Evaluate" without arguments). `trace: 'off'` at file level in the 9 specs that use account values (trace is worker-scoped and cannot be set per describe; a trace records evaluate arguments and signed-in DOM snapshots). Re-check after mitigation: neither value found in `results.json`, `report/` or `summary.md`. Screenshots (and failure videos) of signed-in pages still show the email in the header. |
| P11 | `getByLabel(/^Ground \(/)` resolves to 1 and is checked by default. **Ground costs 0.00 for Computing and Internet but 10.00 for Health Book.** | Checkout scenarios use Health Book (TC-60/061/062, totals 27.00). |
| P12 | Rejected login (unknown email) re-renders `/login`; ReturnUrl is `%2fcustomer%2finfo` (lower case). Checkout-as-guest URL `returnUrl=%2Fcart` (upper case). | URL regexes are case-insensitive. |
| P13 | TC-49 on Chromium: the cleaner guard confirmed "14.1-inch Laptop" qty 1 unchanged at setup, after the Health Book removal POST, and at teardown (annotation `cleanup-guard`). | Guard kept as designed. |
| R-17 | Email of three spaces: server summary "Login was unsuccessful…" / "No customer account found", URL `/login`. | Recorded by TC-06. |
| R-22 | Whitespace search navigates to `/search?q=+++` and shows "Search term minimum length is 3 characters" (no alert). | Recorded by TC-26. |
| R-23 | Qty -1 on the product page: error bar "Quantity should be positive", nothing added. | Recorded by TC-34. |
| R-25 | Double-click adds one unit (header and cart agree). | Recorded by TC-39. |
| R-27 | Wishlist "Add to cart" lands on `/cart` and the item leaves the wishlist. | Recorded by TC-56. |
| R-28 | Shipping "Back" (`<a onclick="Checkout.back()">`) re-activates `#opc-billing` with the entered values kept. | TC-62 asserts billing active. |
| R-30 | Tab presses from page start to the login Email field: Chromium 54, WebKit 10, Firefox not reached within 150. | `MAX_TABS_TO_EMAIL = 100`; when not reached, TC-68 records an a11y gap and focuses Email programmatically. |
| Run | Guest sanity run on Chromium (49 guest tests, no account use, no order): 48 passed at first; TC-58 failed because the step-title DOM text is "Billing address" and CSS `text-transform` renders "Billing Address" (the text discovery recorded via innerText). | Step-title assertions use `useInnerText: true` (TC-52, TC-58); TC-58 then passed. |
