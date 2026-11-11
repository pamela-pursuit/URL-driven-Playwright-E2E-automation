# Architecture: demoqa-books

Implementation blueprint for the Playwright TypeScript suite covering
`test-plans/demoqa-books/scenarios.json` (TC-01 to TC-48, 48 approved scenarios, all on
Chromium, Firefox and WebKit).

Inputs: `discovery.md` (exact texts in sections 3 and 4, API calls in section 6, locator candidates
in section 7, stability in section 8), `scenarios.json`, `requirements.md` (R-01 to R-33, user
answers), `intake.md` (I1 to I3), `.claude/skills/qa-playwright/{pom,locators,credentials,reporting}.md`,
`.claude/skills/e2e-agent/scenario-schema.md`, `playwright.config.ts`, `lib/credentials-store.d.cts`,
`lib/artifact-reporter.ts`, and the delivered demo-web-shop suite (patterns only).

Labels used below:

- **Verified**: the locator, text or behaviour is in discovery.md.
- **Probe**: not observed, or observed on Chromium only where it matters. The implementer confirms
  it in a probe (section 9) before relying on it. Probes run as a guest unless stated.
- **Derived**: computed from verified data (for example a sorted list of the 8 verified titles).

## 0. Key design decisions

| # | Decision | Choice | Why |
| --- | --- | --- | --- |
| K1 | Accounts | One account per browser (I2). A **worker-scoped `browserAccount`** maps the project name to the role (`chromium` to `existingUser`, `firefox` to `firefoxUser`, `webkit` to `webkitUser`) and calls `getAccount('demoqa-books', role, { required: ['userName', 'password'] })` for **that role only**. | A missing role fails only the browser that needs it. Values never leave the fixture except through secret-safe helpers (K6). |
| K2 | Login strategy | **One UI login per worker, kept in memory.** A lazy worker fixture `accountSession` signs in through `/login` in its own context, captures the four demoqa.com session cookies, closes that context, and keeps the cookies in memory only (never written to disk). The test-scoped `signedIn` fixture adds those cookies to the test's context, opens `/profile` and checks the signed-in state; if the session is no longer valid it signs in again once (self-healing). | Limits logins (redirect takes 3.9 to 5.1 s, R-12, and the lockout policy is unknown, R-06). Session state is cookies only; localStorage holds no session data (discovery 3.3), so cookies are a complete storageState. No disk `storageState` file, no setup project and no `playwright.config.ts` change. Tests that must exercise the real login (TC-25, 032, 033, 036) use `freshLogin` instead and never touch the cached cookies. |
| K3 | Serialisation | Every test that uses an account is **tagged `@account`**. Run plan: guest pass `--grep-invert @account --workers=3`; account pass `--grep @account --workers=1`. A single invocation with the config default (`workers: 1`) is also correct. In addition, a **per-role cross-process mutex** (`accountLock`, a lock file in the run folder) makes every `@account` test wait until no other worker uses the same browser's account. | `workers: 1` in the account pass is the primary guarantee. The mutex is defence in depth: if someone runs the account tests with more workers, tests on the same account wait instead of colliding; tests on different accounts may overlap safely. |
| K4 | Wrong-password budget | TC-26 is the **only** test that sends a real user name with a wrong value. It runs in its own `describe` with `retries: 0`, is the **last test** in `auth.spec.ts` (after TC-25 has shown the stored credential works), checks the per-role login circuit breaker first, and writes a per-role run marker `.demoqa-books-<role>-wrong-password-used`. If the marker already exists, it throws instead of trying again (protects against `--repeat-each` and against re-running the test in the same run). All other negative logins use `fakeUserName()`. | R-06 and Q-NB1: one attempt per account per run. |
| K5 | Collection cleanup | `ownedBooks` fixture. `claim(book)` checks the book is in `OWN_BOOKS` (the five scenario books), removes it if left over (single-row delete, `OK`, alert "Book deleted."), and registers it for teardown removal (which also runs after a failure). A guard snapshots all rows before each removal and throws if any other row disappears. There is no code path for "Delete All Books" or "Delete Account", and a network guard aborts any `DELETE` except `DELETE /BookStore/v1/Book`. | Q-NB4, Q-NB5, R-05, R-08. UI removal because the request shape of `DELETE /BookStore/v1/Book` was not captured (Q-NB4 allows API cleanup only after that). |
| K6 | Secrets in artifacts | (a) Account values are typed with a **React-safe `fillSecretValue()`** (evaluate with the native value setter; no `Fill "<value>"` step titles). (b) `trace: 'off'` at file level in the three files that use accounts (`auth`, `collection`, `navigation`). (c) Account tests inject a **CSS mask** (black box) over the signed-in user name and the login UserName input, so the automatic screenshots (`screenshot: 'on'`) and failure videos do not show the user name. (d) Comparisons return booleans (`userNameMatches()`); no `toHaveText(userName)`. | Mirrors demo-web-shop P9, with one change: demo-web-shop's `fillAccountValue` sets `element.value` directly, which **React ignores** (the value tracker sees no change), so it cannot be reused on demoqa. Config-level screenshots cannot be given a `mask`, so the mask is applied in the page through CSS. Artifacts stay git-ignored in any case. |
| K7 | Readiness (R-01) | No sleeps. Every `open()` waits for its page's data response (where one exists) and a ready locator, **plus a hydration check**: the anchor control has React's internal props attached (`__reactProps$*` or `__reactEventHandlers$*` key on the DOM node; probe P1). Inputs are filled with `fillAndConfirm()` (fill, then poll `inputValue()` and refill if the value was lost, bounded by `toPass`). Empty-submit clicks are retried with `toPass` only while no `is-invalid` class appears (the client sends no request on an empty submit, so a repeat click is harmless). `/register` additionally waits for the invisible reCAPTCHA v3 token (see 10.1, R-01). Response waits tied to a navigation are armed only after the main frame commits, so a response of the previous page is never taken. | Discovery 8: input typed or the first click right after load was lost in 2 runs. |
| K8 | Third-party traffic | Auto fixture `blockThirdParty` on the context: requests whose host matches `THIRD_PARTY_BLOCKLIST` (suffix match) are fulfilled with an empty 200. **reCAPTCHA (`www.google.com`, `www.gstatic.com`) is allowed**, and demoqa.com is never matched. | R-03. Blocking the captcha could change the client behaviour that TC-41 asserts (the request is sent without a token) and requirements section 6 forbids disabling it. |
| K9 | Native alerts | `DemoqaAlerts` broker: one `page.on('dialog')` listener per page. Page objects arm an expectation **before** the click (`acceptNext(action)`) and get the message back; any dialog that arrives without an armed expectation is accepted and recorded as "unexpected". | R-02. Avoids the double-accept error that happens when a `waitForEvent('dialog')` and a separate listener both handle the same dialog. |
| K10 | Spec file names | The `specFile` values in scenarios.json are used unchanged (`books`, `auth`, `collection`, `register`, `navigation`, `responsive`). | Workbook traceability (same as demo-web-shop K7). |
| K11 | Viewport | Desktop specs set `test.use({ viewport: DESKTOP_VIEWPORT })` (1280x900, Q-NB8). The config's device defaults are 1280x720. `responsive.spec.ts` sets 375x812. | Discovery was made at 1280x900; the fixed-footer overlap (R-13) depends on height. |

## 1. File plan

All files are **new**. Nothing exists for this app yet. `playwright.config.ts`, `lib/*`, `scripts/*`
and every demo-web-shop file are **not modified**.

```
pages/demoqa-books/
  app-ready.ts            waitForHydration(), fillAndConfirm(), documentScrollWidth()
  secret-input.ts         fillSecretValue(), inputHasValue()          (React-safe, no values in reports)
  alerts.ts               DemoqaAlerts                                (native dialog broker)
  books-table.page.ts     DemoqaBooksTable                            (component: list on /books and collection on /profile)
  session-bar.page.ts     DemoqaSessionBar                            (component: "User Name :", "Log out", "Login" on /books and detail)
  side-menu.page.ts       DemoqaSideMenu                              (component: "Book Store Application" menu group)
  books.page.ts           DemoqaBooksPage
  book-detail.page.ts     DemoqaBookDetailPage
  login.page.ts           DemoqaLoginPage
  register.page.ts        DemoqaRegisterPage
  profile.page.ts         DemoqaProfilePage
fixtures/
  demoqa-books.fixture.ts test/expect, page objects, blockThirdParty (auto), accountGuard (auto in account tests),
                          browserAccount (worker), accountSession (worker), accountLock, account, signedIn,
                          freshLogin, loginCircuitBreaker, ownedBooks, alerts, apiLog, booksApi, pageErrors;
                          helpers recordObservation(), sessionCookieNames()
test-data/
  demoqa-books.data.ts    BOOKS, OWN_BOOKS, catalogue orders, MESSAGES, SEARCH, viewports, ROLE_BY_PROJECT,
                          SESSION_COOKIES, API matchers, THIRD_PARTY_BLOCKLIST, ACCOUNT_TAG, generators
tests/demoqa-books/
  books.spec.ts           TC-01..021                     guest
  auth.spec.ts            TC-22..033                     mixed (022, 023, 027, 028, 029 guest; 024, 025, 026, 030..033 @account)
  collection.spec.ts      TC-34..039                     @account
  register.spec.ts        TC-40, 041                     guest
  navigation.spec.ts      TC-42..046                     mixed (046 @account)
  responsive.spec.ts      TC-47, 048                     guest
```

Page object class names follow the `pageObject` values already in scenarios.json (`DemoqaBooksPage`,
`DemoqaBookDetailPage`, `DemoqaLoginPage`, `DemoqaProfilePage`, `DemoqaRegisterPage`); components use
the same `Demoqa` prefix.

**Reuse of demo-web-shop helpers.** None is imported. `navigation.ts` (`navigateBy`,
`waitForReadyOrServerError`, `waitForImagesComplete`) targets full-page nopCommerce form POSTs and
its error page; demoqa navigations are client-side route changes and URL waits are enough.
`ready-locators.ts` is demo-web-shop-specific. `secret-input.ts` is mirrored but **must not be reused
as is**: it sets `element.value` directly, which React ignores (K6). A later refactor could move a
React-safe secret fill and the third-party blocker into a shared `lib/` helper for both suites; that
is out of scope here because the demo-web-shop suite is delivered and validated.

Import rules:

- Specs import `{ test, expect, recordObservation, sessionCookieNames }` only from
  `../../fixtures/demoqa-books.fixture`, and constants from `../../test-data/demoqa-books.data`.
- Specs **never** call `page.locator`, `getBy*` or other locator factories. Every locator comes from
  a page-object property or method. Specs may call `page.reload`, `page.url()`, `expect(page).toHaveURL`
  and `page.context()` (for `sessionCookieNames`).
- The fixture imports `getAccount` from `'../lib/credentials-store.cjs'`.

## 2. Conventions shared by all page objects

- **Navigation.** `open()` calls `page.goto('<relative path>', { waitUntil: 'domcontentloaded' })`
  (`'books'`, `` `books?search=${isbn}` ``, `'login'`, `'register'`, `'profile'`) and then the page's
  ready wait. Never an absolute URL or a leading `/`; `BASE_URL` is `https://demoqa.com/`.
  Where a scenario asserts the HTTP status (TC-01, TC-23), `open()` returns the `Response`.
- **In-app navigation.** `Promise.all([page.waitForURL(re, { waitUntil: 'domcontentloaded' }), locator.click()])`,
  then the target page's ready wait, then return the target page object. `page.reload` always passes
  `{ waitUntil: 'domcontentloaded' }`. Nothing waits on `load` or `networkidle`.
- **No sleeps.** `waitForTimeout` is banned. Wait for a locator state, a URL, a response or a
  polled value.
- **Hydration (K7).** `waitForHydration(locator)` = `locator.waitFor()` then
  `expect.poll(() => locator.evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'))), { timeout: 15_000 }).toBe(true)`.
  Probe P1 confirms the key prefix; fallback in P1.
- **State checks.** Page objects expose locators and value readers. Specs make the business
  assertions. Page objects only wait for synchronisation, and the safety guards (section 3.10) throw;
  those are not assertions.
- **Locator priority** (locators.md): role, then label, then placeholder, then a stable id. demoqa has
  **no `data-testid`** and **no associated labels**, so `getByLabel` is used only for the
  `aria-label` sort indicators. Each id or CSS locator carries a one-line reason. Duplicate ids
  `#submit`, `#addNewRecordButton`, `#userName` (login and register) and `item-N` are never used.
- **Secret-safe comparisons.** `userNameMatches(expected): Promise<boolean>` reads `textContent`,
  trims and compares; it never returns or prints the value. Specs write
  `expect(await profile.userNameMatches(account.userName), "User Name shows the browser's account").toBe(true)`.

## 3. Page objects

Timeouts below: `LOGIN_REDIRECT_MS = 15_000` (R-12), `READY_MS = 15_000` for first data on a page
(rows visible after about 2.3 s, discovery 4 F1), `ALERT_MS = 15_000`.

### 3.1 Helpers

| File | Export | Behaviour |
| --- | --- | --- |
| `app-ready.ts` | `waitForHydration(anchor: Locator)` | Section 2. |
| | `fillAndConfirm(input: Locator, value: string)` | `expect(async () => { await input.fill(value); expect(await input.inputValue()).toBe(value); }).toPass({ timeout: 10_000 })`. Non-secret values only (search terms, fake user name, register data). |
| | `documentScrollWidth(page): Promise<number>` | `page.evaluate(() => document.documentElement.scrollWidth)`. |
| `secret-input.ts` | `fillSecretValue(input: Locator, value: string)` | `input.waitFor()`, then `evaluate`: focus, `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)`, dispatch `input` and `change` (bubbling), blur. Reported as "Evaluate" without the argument (demo-web-shop P9). Probe P2 confirms React accepts it on all three browsers. |
| | `inputHasValue(input: Locator, value: string): Promise<boolean>` | `evaluate` comparison; returns a boolean only. Used to detect a value lost to re-render before submitting. |
| `alerts.ts` | `class DemoqaAlerts` | `static for(page)` (one instance per page, `WeakMap`); installs a single `page.on('dialog')`. `acceptNext(action: () => Promise<unknown>, timeout = ALERT_MS): Promise<string>` arms an expectation, runs `action` and the dialog wait together (`Promise.all`: a click resolves only after the dialog is handled, demo-web-shop P1), accepts the dialog and returns `message()`. A dialog without an armed expectation is accepted and pushed to `unexpected(): string[]`. Throws `Error('Expected a native alert after <action name>, none appeared')` on timeout. |

### 3.2 `DemoqaBooksTable` (`books-table.page.ts`, component; root = the page)

Same markup on `/books` and `/profile` (plain `<table>`, discovery 3.1 and 3.5).

| Locator / method | Strategy | Notes |
| --- | --- | --- |
| `table` | `page.getByRole('table')` | Verified single table. |
| `columnHeader(name)` | `table.getByRole('columnheader', { name: new RegExp('^' + escapeRegExp(name)) })` | R-10: the accessible name gains the arrow after sorting, so an exact name stops matching (verified timeout). |
| `sortIndicator(column, 'asc' \| 'desc')` | `columnHeader(column).getByLabel('sorted-asc' \| 'sorted-desc')` | Verified `aria-label` on a span. `getByLabel` matches `aria-label`. |
| `anySortIndicator` | `table.getByLabel(/^sorted-(asc\|desc)$/)` | For "no indicator" checks (TC-15 click 3, TC-17). |
| `bookRows` | `table.getByRole('row').filter({ has: page.getByRole('cell') })` | Data rows only (the header row has `columnheader` cells). Probe P5: no empty padding rows. |
| `row(title)` | `bookRows.filter({ has: page.getByRole('link', { name: title, exact: true }) })` | Verified pattern (discovery 7). |
| `titleLink(title)` | `table.getByRole('link', { name: title, exact: true })` | Verified. |
| `titleLinks` | `table.getByRole('link').filter({ hasNot: page.getByRole('img') })` | All title links in display order; excludes an image link if the thumbnail is wrapped in one (probe P5). |
| `cell(title, column)` | `row(title).getByRole('cell').nth(COLUMN_INDEX[column])` | `COLUMN_INDEX = { Image: 0, Title: 1, Author: 2, Publisher: 3, Action: 4 }` (verified column order). |
| `columnCells(column)` | `table.locator(`tbody tr td:nth-child(${COLUMN_INDEX[column] + 1})`)` | No role-based way to select one column across rows. Used with `toHaveText([...])` for order checks. |
| `pageInfo` | `page.getByText(/^Page \d+ of \d+$/)` | Verified texts "Page 1 of 1" / "Page 1 of 0"; **probe P5** that the text is one text node (not an input inside the text). Fallback: the container that holds `Previous`/`Next`, with `toContainText`. |
| `previousButton` / `nextButton` | `page.getByRole('button', { name: 'Previous', exact: true })` / `'Next'` | Verified, both disabled. |
| `waitForRows()` | `titleLinks.first().waitFor({ timeout: READY_MS })` | |
| `sortBy(column)` | Click `columnHeader(column)`. No wait: sorting is synchronous client-side; specs use web-first assertions. | |
| `titles(): Promise<string[]>` | `titleLinks.allInnerTexts()` | For annotations only; assertions use `toHaveText([...])`. |

### 3.3 `DemoqaSessionBar` (`session-bar.page.ts`, component on `/books` and detail)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `userNameLabel` | `page.getByText('User Name :', { exact: true })` | Verified text. |
| `userNameValue` | `page.locator('#userName-value')` | Verified on `/profile` (`label#userName-value`). **Probe P4**: count is 1 on `/books` and on detail when signed in. If detail values reuse the same id, scope to the wrapper that contains `userNameLabel`. |
| `logoutButton` | `page.getByRole('button', { name: /^Log ?out$/ })` | Verified text "Log out" here, "Logout" on profile (R-24). `#submit` is never used. Specs assert the exact text with `toHaveText('Log out')`. |
| `loginButton` | `page.getByRole('button', { name: 'Login', exact: true })` | Verified `#login` on `/books` and detail (guest). Menu items are links, not buttons. |

Methods:

- `userNameMatches(expected): Promise<boolean>`: waits for `userNameValue` to be visible, then a
  secret-safe comparison.
- `logOut(): Promise<string>` (TC-33): click `logoutButton`, wait for `logoutButton` to be hidden
  and `loginButton` to be visible (both `/books` as a guest and `/login` have one), return
  `page.url()` for the spec to record (R-28: landing URL not observed).

### 3.4 `DemoqaSideMenu` (`side-menu.page.ts`, component)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `group` | `page.locator('.element-group').filter({ has: page.locator('span.group-header', { hasText: 'Book Store Application' }) })` | Verified `span.group-header` text. The `.element-group` container class is **probe P7**; menu ids `item-N` repeat in other groups and are not used. |
| `link(name)` | `group.getByRole('link', { name, exact: true })` | `exact` separates "Book Store" from "Book Store API". Verified `a.router-link`. |
| `item(name)` | `group.getByRole('listitem').filter({ has: link(name) })` | Holds class `active` (verified on the `li`). |

Methods:

- `open(name: 'Login' | 'Book Store' | 'Profile')`: scrolls the link to the centre
  (`evaluate(el => el.scrollIntoView({ block: 'center' }))`, because the fixed footer covers the
  lower menu at 1280x900, R-13), then click plus `waitForURL` for `/login`, `/books` or `/profile`,
  then the target page's ready wait. Returns the target page object. No `force` clicks.

### 3.5 `DemoqaBooksPage` (`books.page.ts`, `/books`)

Composes `table: DemoqaBooksTable`, `session: DemoqaSessionBar`, `menu: DemoqaSideMenu`.

| Locator | Strategy | Notes |
| --- | --- | --- |
| `searchBox` | `page.getByPlaceholder('Type to search')` | Verified; no label. `#searchBox` fallback. |
| `menuToggle` | **Probe P8** (hamburger at 375 px; not needed by any assertion) | TC-47 only checks that menu links are hidden. |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open()` | `Response` | Arms `page.waitForResponse(API.booksList)` (GET `/BookStore/v1/Books`), `goto('books')`, awaits the response, `table.waitForRows()`, `waitForHydration(searchBox)`. |
| `openExpectingNoRows()` | `void` | TC-21: `goto('books')`, then `searchBox` visible and hydrated. The spec awaits the route's `fired` promise. No row wait. |
| `search(term)` | `void` | `fillAndConfirm(searchBox, term)`. Filtering is client-side and immediate; specs assert with web-first assertions. |
| `clearSearch()` | `void` | `fillAndConfirm(searchBox, '')`. |
| `reload()` | `void` | `page.reload(dcl)` and the same waits as `open()`. |
| `openBook(title)` | `DemoqaBookDetailPage` | Click `table.titleLink(title)`, `waitForURL(/\/books\?search=\d+$/)`, then the detail ready wait. |

### 3.6 `DemoqaBookDetailPage` (`book-detail.page.ts`, `/books?search=<ISBN>`)

Composes `session: DemoqaSessionBar`.

| Locator | Strategy | Notes |
| --- | --- | --- |
| `wrapper(field)` | `page.locator(`#${WRAPPER_ID[field]}`)` | Verified stable ids: `ISBN-wrapper`, `title-wrapper`, `subtitle-wrapper`, `author-wrapper`, `publisher-wrapper`, `pages-wrapper`, `description-wrapper`, `website-wrapper`. Labels are not associated. |
| `fieldValue(field)` | `wrapper(field).locator('label, span, div, a').last()` | **Probe P4**: the value element inside each wrapper (the last element after the `*-label`). If P4 finds a stable value id, use it scoped to the wrapper. |
| `websiteLink` | `wrapper('website').getByRole('link')` | Verified link. Never followed. |
| `backButton` | `page.getByRole('button', { name: 'Back To Book Store', exact: true })` | Verified. Duplicate id `addNewRecordButton` avoided (R-08). |
| `addToCollectionButton` | `page.getByRole('button', { name: 'Add To Your Collection', exact: true })` | Verified, same duplicate id avoided. |
| `alertRegion` | `page.getByRole('alert')` | For the "no user-facing error" check (TC-20). |
| `text(value)` | `page.getByText(value)` | Generic text presence for absence checks of the API message (TC-20). |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open(isbn)` | `void` | Arms `waitForResponse(API.bookByIsbn(isbn))`, `goto(`books?search=${isbn}`)`, awaits it, then waits until `fieldValue('title')` has non-empty text (`expect.poll` on `textContent`), then `waitForHydration(backButton)`. |
| `openUnknown(isbn)` | `number` (status) | TC-20: same arming; returns the response status; waits for `wrapper('title')` and `backButton` visible. Does not wait for a value. |
| `addToCollection()` | `{ message: string; status: number }` | `alerts.acceptNext(...)` around the click, together with `waitForResponse(API.addBooks)` (POST `/BookStore/v1/Books`). Returns the alert text and status (201 or 400). Probe P12: order of response and alert. |
| `backToBookStore()` | `DemoqaBooksPage` | Click, `waitForURL(/\/books$/)`, then the list ready wait (rows). |

### 3.7 `DemoqaLoginPage` (`login.page.ts`, `/login`)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `heading` | `page.getByRole('heading', { level: 1, name: 'Login' })` | Verified h1. |
| `form` | `page.locator('#userForm')` | Scope: count of "Login" buttons on /login was not checked (discovery 7). |
| `userNameInput` | `form.getByPlaceholder('UserName')` | Verified placeholder; label not associated. |
| `passwordInput` | `form.getByPlaceholder('Password')` | Verified. |
| `loginButton` | `form.getByRole('button', { name: 'Login', exact: true })` | Verified (`#login` fallback). |
| `newUserButton` | `form.getByRole('button', { name: 'New User', exact: true })` | Verified. |
| `errorMessage` | `page.locator('p#name')` | Verified; no role. Same id used for register errors (different page). |
| `invalidInputs` | `form.locator('input.is-invalid')` | Verified class; no text message exists. |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open()` | `this` | `goto('login')`, `heading`, `waitForHydration(loginButton)`. |
| `signIn(userName, password)` | `'signed-in' \| 'rejected' \| 'invalid-field'` | `fillSecretValue` both; if `inputHasValue` is false for either (lost to a re-render), fill again once. Click `loginButton`. Wait for `page.waitForURL(/\/profile$/)` **or** `errorMessage` visible **or** `invalidInputs.first()` visible (race; `LOGIN_REDIRECT_MS`). On `'invalid-field'` (no request was sent, so no lockout cost) refill and click once more. Never logs the arguments. |
| `signInExpectingSuccess(account)` | `DemoqaProfilePage` | Calls `signIn`. If `'rejected'`, the caller's circuit breaker records it (section 4) and this throws `Error('<role> sign-in was rejected. Check the credential with: node scripts/credentials.mjs check --app demoqa-books')` (role name only, no values). Then the profile signed-in ready wait. |
| `submitEmpty()` | `void` | `toPass` loop: click `loginButton`, wait up to 2 s for `invalidInputs.first()`; up to 15 s overall (R-01: the first click can be lost). |
| `submitWithUserNameOnly(name)` | `void` | `fillAndConfirm(userNameInput, name)` (fake name only), then the same click loop. |
| `errorText(): Promise<string>` | `string` | `''` when `p#name` is absent or empty. |
| `openRegister()` | `DemoqaRegisterPage` | Click `newUserButton`, `waitForURL(/\/register$/)`, register ready wait. |

### 3.8 `DemoqaRegisterPage` (`register.page.ts`, `/register`)

| Locator | Strategy | Notes |
| --- | --- | --- |
| `heading` | `page.getByRole('heading', { level: 1, name: 'Register' })` | Verified h1. |
| `firstName`, `lastName`, `userName`, `password` | `page.getByPlaceholder('First Name' \| 'Last Name' \| 'UserName' \| 'Password')` | Verified; labels not associated. |
| `registerButton` | `page.getByRole('button', { name: 'Register', exact: true })` | Verified (`#register`). |
| `backToLoginButton` | `page.getByRole('button', { name: 'Back to Login', exact: true })` | Verified (`#gotologin`). |
| `errorMessage` | `page.locator('p#name')` | Verified. |
| `inputs` | `[firstName, lastName, userName, password]` | For per-field `is-invalid` checks in the spec. |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `open()` | `this` | `goto('register')`, heading, `waitForHydration(registerButton)`. |
| `submitEmpty()` | `void` | Same `toPass` click loop as login, waiting for `input.is-invalid`. |
| `fillForm({ firstName, lastName, userName, password })` | `void` | `fillAndConfirm` on each (non-secret: static names, `fakeUserName()`, `"abc"`). |
| `submitExpectingRejection()` | `{ status: number; bodyKeys: string[] }` | **Guard first** (section 3.10). Arms `waitForResponse(API.createUser)`, clicks, returns the status and the request body's JSON **keys only** (TC-41 records whether a captcha field is present, R-26). |
| `backToLogin()` | `DemoqaLoginPage` | Click, `waitForURL(/\/login$/)`, login ready wait. |

### 3.9 `DemoqaProfilePage` (`profile.page.ts`, `/profile`)

Composes `table: DemoqaBooksTable`.

| Locator | Strategy | Notes |
| --- | --- | --- |
| `booksHeading` | `page.getByText('Books :', { exact: true })` | Verified text; not reported as a heading. |
| `userNameValue` | `page.locator('#userName-value')` | Verified `label#userName-value` (no role, no association). |
| `logoutButton` | `page.getByRole('button', { name: /^Log ?out$/ })` | Verified "Logout" here. Never `#submit` (shared with Delete Account). |
| `goToStoreButton` | `page.getByRole('button', { name: 'Go To Book Store', exact: true })` | Verified (`#gotoStore`). |
| `deleteAccountButton` | `page.getByRole('button', { name: 'Delete Account', exact: true })` | **Visibility only.** No method clicks it. |
| `deleteAllBooksButton` | `page.getByRole('button', { name: 'Delete All Books', exact: true }).filter({ visible: true })` | **Visibility only.** A hidden duplicate exists (verified); `filter({ visible: true })` (probe P16). |
| `searchBox` | `page.getByPlaceholder('Type to search')` | Verified on profile. |
| `signedOutMessage` | `page.getByText(/^Currently you are not logged into the Book Store application/)` | Verified text. |
| `signedOutLink('login' \| 'register')` | `signedOutMessage.getByRole('link', { name, exact: true })` | Verified lowercase link names; scoped so the left-menu "Login" never matches. |
| `deleteIcon(isbn)` | `page.locator(`#delete-record-${isbn}`)` | Verified; a `span` with `title="Delete"`, no button role. Fallback `table.row(title).getByTitle('Delete')`. |
| `deleteDialog` | `page.getByRole('dialog')` | Verified. |
| `deleteDialogTitle` / `deleteDialogBody` | `deleteDialog.getByText('Delete Book', { exact: true })` / `getByText('Do you want to delete this book?', { exact: true })` | Verified texts. |
| `dialogOk` / `dialogCancel` | `deleteDialog.getByRole('button', { name: 'OK' \| 'Cancel', exact: true })` | Verified (`#closeSmallModal-ok` / `-cancel`). |

Methods:

| Method | Returns | Synchronisation |
| --- | --- | --- |
| `goto()` | `Response` | Raw `goto('profile')` plus `signedOutMessage.or(booksHeading).first().waitFor()`. Used by guest checks (TC-23, 044) and by `signedIn`. |
| `openSignedIn()` | `this` | Arms `waitForResponse(API.accountUser)` (GET `/Account/v1/User/<id>`), `goto('profile')`, awaits it, `booksHeading` and `userNameValue` visible, `waitForHydration(logoutButton)`. Rows are then final (the collection comes from that response). |
| `reload()` | `void` | Same waits after `page.reload(dcl)`. |
| `isSignedIn(): Promise<boolean>` | | After `goto()`: `userNameValue.isVisible()`. |
| `userNameMatches(expected)` | `boolean` | Secret-safe. |
| `openDeleteDialog(isbn)` | `void` | Click `deleteIcon(isbn)`, wait `deleteDialog` visible. |
| `cancelDelete()` | `void` | Click `dialogCancel`, wait `deleteDialog` hidden. |
| `confirmDelete(title)` | `{ message: string; status: number }` | `alerts.acceptNext` around the `dialogOk` click, together with `waitForResponse(API.deleteBook)` (DELETE `/BookStore/v1/Book`); then `table.row(title)` hidden. |
| `removeOwnBook(book)` | `{ removed: boolean }` | Cleanup primitive used only by `ownedBooks` (section 4.4). |
| `logOut()` | `DemoqaLoginPage` | Click `logoutButton`, `waitForURL(/\/login$/)` (verified target), login ready wait. |
| `goToBookStore()` | `string` (URL) | TC-46: click, wait for the URL to leave `/profile`, return `page.url()` (R-29). If it is `/books`, also wait for rows. |
| `openSignedOutLink(name)` | `DemoqaLoginPage \| DemoqaRegisterPage` | Click, `waitForURL`, target ready wait. |

### 3.10 Safety guards (they throw; they are not assertions)

- **No destructive methods.** No method clicks `deleteAccountButton` or `deleteAllBooksButton`, and
  no locator uses `#submit`.
- **`accountGuard` network guard** (fixture, section 4.2): in every `@account` test the context routes
  `**/*` on demoqa.com; any `DELETE` whose path is not exactly `/BookStore/v1/Book` is **aborted**, an
  annotation `account-guard` is added and the test fails in teardown with
  `Error('Blocked a DELETE <path> (only single-book delete is allowed)')`. Path only, with any
  `UserId`/`userID` segment replaced by `<userID>`.
- **Own-books guard** (`removeOwnBook`): refuses a book that is not in `OWN_BOOKS`; snapshots all row
  titles before the removal and throws `Error('Cleanup changed a row it does not own: <title>')` if
  any other row disappeared afterwards (titles are not secrets).
- **Register guard** (`submitExpectingRejection`): throws
  `Error('R-07: refusing to submit a password that satisfies the server rule')` if the password
  matches `STRONG_PASSWORD_RULE` (the verified `pattern`, discovery 3.4). The fake user name plus
  `"abc"` is the only data ever submitted.
- **Wrong-password budget** (TC-26): run marker per role (K4).

## 4. Fixtures (`fixtures/demoqa-books.fixture.ts`)

### 4.1 Types and skeleton

```ts
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { getAccount } from '../lib/credentials-store.cjs';

type Role = 'existingUser' | 'firefoxUser' | 'webkitUser';
interface BrowserAccount { role: Role; userName: string; password: string }
interface AccountSession {                       // worker scoped, lazy
  apply(context: BrowserContext): Promise<void>; // signs in on first call, then adds cached cookies
  refresh(): Promise<void>;                      // UI login again, replace cached cookies
  logins(): number;                              // count for annotations
}
interface OwnedBooks { claim(book: OwnBook): Promise<void>; addViaUi(book: OwnBook): Promise<void> }
interface BooksApi { failListWith(status: number): Promise<{ fired: Promise<void> }> }
interface ApiLog { count(method: string, path: string): number }
interface PageErrors { mark(): void; sinceMark(): string[] }

type Fixtures = {
  blockThirdParty: void;                         // auto
  alerts: DemoqaAlerts;
  booksPage: DemoqaBooksPage; bookDetailPage: DemoqaBookDetailPage; loginPage: DemoqaLoginPage;
  registerPage: DemoqaRegisterPage; profilePage: DemoqaProfilePage;
  loginCircuitBreaker: { ensureClosed(): void; recordRejection(): void };
  accountLock: void;
  account: BrowserAccount;                       // test view of browserAccount + CSS mask + guard
  signedIn: { account: BrowserAccount };
  freshLogin: () => Promise<DemoqaProfilePage>;
  ownedBooks: OwnedBooks;
  apiLog: ApiLog; booksApi: BooksApi; pageErrors: PageErrors;
};
type WorkerFixtures = { browserAccount: BrowserAccount; accountSession: AccountSession };
```

### 4.2 Fixture definitions

| Fixture | Scope | Depends on | Behaviour |
| --- | --- | --- | --- |
| `blockThirdParty` | test, **auto** | `context` | `context.route(url => isThirdParty(url), r => r.fulfill({ status: 200, body: '', contentType: CONTENT_TYPE[r.request().resourceType()] ?? 'text/plain' }))`. `isThirdParty` = hostname equals or ends with `.` + an entry of `THIRD_PARTY_BLOCKLIST`, and is never `demoqa.com`, `www.google.com` or `www.gstatic.com` (reCAPTCHA, K8). Also exported as `blockThirdParty(context)`. |
| page objects (5) | test | `page` | `new DemoqaXxxPage(page)`; each builds `DemoqaAlerts.for(page)` internally. |
| `alerts` | test | `page` | `DemoqaAlerts.for(page)`, so specs can check `unexpected()`. |
| `browserAccount` | **worker** | none | `role = ROLE_BY_PROJECT[workerInfo.project.name]`; unknown project: throw `Error('No demoqa-books account role for project "<name>"')`. `getAccount('demoqa-books', role, { required: ['userName', 'password'] })`. A missing role or field throws a descriptive error with no values and the **test fails** (not skipped). Guest tests never request it, so they need no credentials. No scenario is credential-optional, so `test.skip` is never used for credentials. |
| `accountSession` | **worker**, `{ timeout: 90_000 }` | `browser`, `browserAccount` | Lazy. On the first `apply()`: `browser.newContext({ baseURL: workerInfo.project.use.baseURL, viewport: DESKTOP_VIEWPORT })`, `blockThirdParty`, `loginPage.open()`, `signInExpectingSuccess` (circuit breaker as in `freshLogin`), keep `context.cookies()` filtered to `SESSION_COOKIES` on demoqa.com, close the context. `apply(ctx)` = `ctx.addCookies(cached)`. Cookies stay in memory only. |
| `accountLock` | test, `{ timeout: 600_000 }` | none | Per-role mutex: atomically creates `<runDir>/.demoqa-books-<role>.lock` (`fs.openSync(path, 'wx')`, content = pid). If it exists and that pid is alive, polls every 250 ms (a cross-process lock poll, not a UI wait); if the pid is dead, takes the lock over. Released in teardown (`finally`). `runDir` = `path.dirname(testInfo.project.outputDir)` (same as demo-web-shop). |
| `account` | test | `browserAccount`, `accountLock`, `context` | **Tag check:** throws `Error('Test uses an account but is not tagged @account (the guest pass would run it in parallel)')` if `testInfo.tags` lacks `ACCOUNT_TAG`. Installs the CSS mask with `context.addInitScript` (adds a `<style>` on `DOMContentLoaded`: `#userName-value, #userForm #userName { background:#000 !important; color:#000 !important; }`). Installs `accountGuard` (section 3.10). `use(browserAccount)`. |
| `loginCircuitBreaker` | test | `browserAccount` | Marker `<runDir>/.demoqa-books-<role>-login-rejected`. `ensureClosed()` throws `Error('Skipping sign-in: <role> was rejected earlier in this run (lockout protection, R-06)')`. `recordRejection()` writes the empty marker. |
| `signedIn` | test, `{ timeout: 60_000 }` | `account`, `accountSession`, `context`, `profilePage` | `accountSession.apply(context)`, `profilePage.goto()`. If `!isSignedIn()`: annotation `session-refreshed`, `accountSession.refresh()`, apply, `goto()` again; if still signed out, throw `Error('<role> session could not be established')`. Leaves the page on `/profile`. `use({ account })`. No logout on teardown (the context is discarded; logging out could end the cached session). |
| `freshLogin` | test | `account`, `loginPage`, `loginCircuitBreaker` | Returns `async () => { ensureClosed(); await loginPage.open(); const outcome = await test.step('Sign in as the browser account', () => loginPage.signIn(...), { box: true }); if rejected: recordRejection(), throw; return profile after openSignedIn(); }`. Never uses or changes the cached cookies. |
| `ownedBooks` | test, `{ timeout: 90_000 }` | `account`, `accountSession`, `context`, `profilePage`, `bookDetailPage` | `claim(book)`: guard `OWN_BOOKS`; ensure the page is signed in (if `/profile` shows the signed-out message, `accountSession.apply(context)`); `profilePage.openSignedIn()`; `removeOwnBook(book)` (setup removal of a leftover, annotation `cleanup` with the title if removed); remember the book. `addViaUi(book)`: `bookDetailPage.open(isbn)`, `addToCollection()`; if the message is not `MESSAGES.bookAdded`, throw `Error('Setup could not add "<title>": <message>')`. **Teardown (always):** ensure signed in (apply cookies; refresh once if the cookies were invalidated), `openSignedIn()`, `removeOwnBook` for every claimed book. |
| `apiLog` | test | `page` | `page.on('request')` for demoqa.com paths under `/Account/` and `/BookStore/`; stores method + path only, user-id segments replaced. No bodies, headers or query values (except `ISBN`). |
| `booksApi` | test | `page` | `failListWith(status)`: `page.route(API_GLOB.booksList, handler, { times: 1 })` where the handler fulfils `{ status, body: '{}' , contentType: 'application/json' }` only for `GET` (a `POST` to the same path is `route.continue()`d) and resolves `fired`. Teardown: `page.unrouteAll({ behavior: 'ignoreErrors' })`. |
| `pageErrors` | test | `page` | Records `pageerror` messages; `mark()` and `sinceMark()` window them (TC-14: errors from blocked ad code before the action do not count). |

Exported helpers (not fixtures):

- `recordObservation(type, description)`: annotation for first-run records (R-18, R-21, R-26,
  R-28, R-29, R-30, R-16). Never pass account values.
- `sessionCookieNames(context): Promise<string[]>`: names from `SESSION_COOKIES` present on
  demoqa.com. Names only, never values.

### 4.3 Login count per browser per full run

1 cached session login (plus at most one refresh after a fresh login or a token rotation, probe P3),
TC-25 (1), TC-32 (1), TC-33 (1), TC-36 (2): **about 6 to 8 successful logins and exactly 1
wrong-password attempt per account**.

### 4.4 `removeOwnBook(book)` (inside `DemoqaProfilePage`, called only by `ownedBooks`)

1. If `book.isbn` is not in `OWN_BOOKS`, throw.
2. `before = await table.titles()`. If `book.title` is not in `before`, return `{ removed: false }`
   (idempotent; an interrupted run is repaired by the next run's setup).
3. `openDeleteDialog(isbn)`, then `confirmDelete(title)`. Throw if the alert text is not
   `MESSAGES.bookDeleted` or the status is not 204.
4. `after = await table.titles()`. Every title in `before` except the target must still be present,
   otherwise throw the guard error. Return `{ removed: true }`.

### 4.5 Account roles

| Role | Project | Required fields | Used by |
| --- | --- | --- | --- |
| `existingUser` | chromium | `userName`, `password` | TC-24, 025, 026, 030 to 039, 046 |
| `firefoxUser` | firefox | `userName`, `password` | same |
| `webkitUser` | webkit | `userName`, `password` | same |

Masked check before the first run:
`node scripts/credentials.mjs check --app demoqa-books --require existingUser:userName,password --require firefoxUser:userName,password --require webkitUser:userName,password`.

## 5. Test data (`test-data/demoqa-books.data.ts`)

No secrets. Every text is verified in discovery.md unless marked Derived.

| Export | Content |
| --- | --- |
| `BOOKS` | The 8 books with `title`, `author`, `publisher`, `isbn` (verified, discovery 3.1): Git Pocket Guide / Richard E. Silverman / O'Reilly Media / 9781449325862; Learning JavaScript Design Patterns / Addy Osmani / O'Reilly Media / 9781449331818; Designing Evolvable Web APIs with ASP.NET / Glenn Block et al. / O'Reilly Media / 9781449337711; Speaking JavaScript / Axel Rauschmayer / O'Reilly Media / 9781449365035; You Don't Know JS / Kyle Simpson / O'Reilly Media / 9781491904244; Programming JavaScript Applications / Eric Elliott / O'Reilly Media / 9781491950296; Eloquent JavaScript, Second Edition / Marijn Haverbeke / No Starch Press / 9781593275846; Understanding ECMAScript 6 / Nicholas C. Zakas / No Starch Press / 9781593277574. |
| `CATALOGUE_TITLES` | The 8 titles in the verified original order (above). |
| `TITLES_ASC` / `TITLES_DESC` | **Derived** (all first letters differ): Designing…, Eloquent…, Git…, Learning…, Programming…, Speaking…, Understanding…, You Don't Know JS; and the reverse. |
| `AUTHORS_ASC` | **Derived**: Addy Osmani, Axel Rauschmayer, Eric Elliott, Glenn Block et al., Kyle Simpson, Marijn Haverbeke, Nicholas C. Zakas, Richard E. Silverman (verified first and last). |
| `GIT_POCKET_GUIDE_DETAIL` | `isbn '9781449325862'`, `title 'Git Pocket Guide'`, `subTitle 'A Working Introduction'`, `author 'Richard E. Silverman'`, `publisher "O'Reilly Media"`, `totalPages '234'`, `website 'http://chimera.labs.oreilly.com/books/1230000000561/index.html'` (record only; scenario asserts presence). |
| `OWN_BOOKS` | `{ add: BOOKS.gitPocketGuide, duplicate: learningJsPatterns, persist: speakingJs, cancel: designingApis, delete: youDontKnowJs }` (one per collection test, scenarios.json testData). |
| `SEARCH` | `title 'git'`, `titleUpper 'GIT'`, `author 'Kyle'`, `publisher "O'Reilly Media"`, `partial 'script'`, `apostrophe "Don't"`, `noMatch 'zzzznotabook'`, `padded '  git  '`, `isbn '9781449325862'`, `regex '(.*'`. Expected results: `SEARCH_EXPECTED.publisher` = the six O'Reilly titles, `.partial` = the five titles of TC-07. |
| `UNKNOWN_ISBN` | `'0000000000'`. |
| `MESSAGES` | `loginInvalid 'Invalid username or password!'`; `bookAdded 'Book added to your collection.'`; `bookAlreadyPresent 'Book already present in the your collection!'` (exact, R-23); `bookDeleted 'Book deleted.'`; `deleteDialogTitle 'Delete Book'`; `deleteDialogBody 'Do you want to delete this book?'`; `signedOut 'Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself.'`; `weakPassword "Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer."`; `isbnNotAvailable 'ISBN supplied is not available in Books Collection!'` (API body; used only for an absence check); `pageOfOne 'Page 1 of 1'`; `pageOfZero 'Page 1 of 0'`; `logoutList 'Log out'`; `logoutProfile 'Logout'`. |
| `REGISTER` | `firstName 'QA'`, `lastName 'Automation'`, `weakPassword 'abc'`. |
| `STRONG_PASSWORD_RULE` | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/` (verified `pattern`; used only by the R-07 guard). |
| `ROLE_BY_PROJECT` | `{ chromium: 'existingUser', firefox: 'firefoxUser', webkit: 'webkitUser' }`. |
| `SESSION_COOKIES` | `['token', 'expires', 'userID', 'userName']` (verified). |
| `API` | Response predicates: `booksList` (GET path `/BookStore/v1/Books`), `bookByIsbn(isbn)` (GET `/BookStore/v1/Book?ISBN=<isbn>`), `addBooks` (POST `/BookStore/v1/Books`), `deleteBook` (DELETE `/BookStore/v1/Book`), `generateToken`, `login` (POST `/Account/v1/Login`), `accountUser` (GET `/Account/v1/User/<id>`), `createUser` (POST `/Account/v1/User`). `API_GLOB.booksList = '**/BookStore/v1/Books'`. |
| `THIRD_PARTY_BLOCKLIST` | Host suffixes from discovery 8: `googlesyndication.com`, `doubleclick.net`, `criteo.com`, `criteo.net`, `openx.net`, `openxcdn.net`, `id5-sync.com`, `crwdcntrl.net`, `adsrvr.org`, `creativecdn.com`, `ladsp.com`, `adx.opera.com`, `temu.com`, `adtrafficquality.google`, and for "Google Analytics / Tag Manager" `google-analytics.com`, `googletagmanager.com` (host names inferred from the vendor names; probe P9). |
| `DESKTOP_VIEWPORT` / `MOBILE_VIEWPORT` | `{ width: 1280, height: 900 }` / `{ width: 375, height: 812 }`. |
| `ACCOUNT_TAG` | `'@account'`. |
| Generators | `uniqueSuffix()` = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; `fakeUserName()` = `qa-nonexistent-${uniqueSuffix()}`; `wrongLoginValue()` = `qa-wrong-${uniqueSuffix()}`; `escapeRegExp()`. |

## 6. Data strategy and isolation

- **Guest isolation.** Every test gets a fresh context (no cookies). Guest tests change nothing on the
  server (search, sort and detail are reads; the register submit is always rejected; the unknown-user
  login touches no account). They are safe at any worker count and across browsers.
- **Account isolation.** One account per browser (I2). Same-account tests run one at a time (K3).
  Each collection test uses its own book and removes only that book before and after (K5). TC-39
  removes leftovers of all five own books, never anything else.
- **Shared public catalogue (R-04, R-15).** Assertions name books. A catalogue change fails TC-01 and
  the order checks with a clear diff; classify outages (navigation timeouts, 5xx) as environment
  failures.
- **API setup and cleanup.** Not used in the baseline: the `DELETE /BookStore/v1/Book` and
  `POST /BookStore/v1/Books` request shapes and auth were not captured (Q-NB4). Optional probe P11 may
  capture them; an API cleanup (`page.request` with the session token) can then replace the UI removal
  in teardown only, after review.
- **Concurrent runs.** Two separate invocations of the account pass at the same time (two machines,
  CI shards) are **unsupported**: the lock lives in each run's folder. State this in the run notes.

## 7. Spec layout and run plan

### 7.1 Spec structure rules

- One `test.describe('<Area>')` per file; desktop files start with `test.use({ viewport: DESKTOP_VIEWPORT })`.
- `auth.spec.ts`, `collection.spec.ts`, `navigation.spec.ts` start with `test.use({ trace: 'off' })` (K6).
- Every account test has `{ tag: [ACCOUNT_TAG] }` in its details argument (tags never in titles).
  The `account` fixture enforces it.
- Collection tests call `test.slow()` (login, setup add, cleanup).
- Order inside `auth.spec.ts`: guest tests (022, 023, 027, 028, 029), signed-in tests (024, 030, 031),
  fresh-login tests (025, 032, 033), then TC-26 last in `test.describe('Wrong password for the browser account', () => { test.describe.configure({ retries: 0 }); ... })`.
- Arrange steps go in `test.step('Arrange: ...')`; assertions are web-first in the spec.

### 7.2 Guest vs account

| File | Guest tests | `@account` tests |
| --- | --- | --- |
| books.spec.ts | 001 to 021 (21) | none |
| auth.spec.ts | 022, 023, 027, 028, 029 (5) | 024, 025, 026, 030, 031, 032, 033 (7) |
| collection.spec.ts | none | 034 to 039 (6) |
| register.spec.ts | 040, 041 (2) | none |
| navigation.spec.ts | 042 to 045 (4) | 046 (1) |
| responsive.spec.ts | 047, 048 (2) | none |
| **Total** | **34 scenarios = 102 tests** | **14 scenarios = 42 tests** |

### 7.3 Run plan (PowerShell, repository root)

Node: prefix with `$env:Path = "$env:APPDATA\fnm\node-versions\v26.13.0\installation;" + $env:Path;`
(progress.md). The user runs these in a VS Code terminal.

Check first: `npx tsc --noEmit`, then `npx playwright test tests/demoqa-books --list` must report
**144 tests in 6 files** (48 scenarios x 3 projects; no browser-limited scenario).

**Option 1, one run (simplest, all serial):**

```powershell
.\scripts\run-e2e.ps1 -App demoqa-books -BaseUrl https://demoqa.com/
```

The config's `workers: 1` runs all 144 tests one at a time; the runner syncs and rebuilds the workbook.

**Option 2, two passes (faster):**

```powershell
# Pass A: guest tests, parallel, all three browsers (102 tests)
$env:BASE_URL = 'https://demoqa.com/'; $env:TEST_SUITE = 'demoqa-books'
$env:E2E_RUN_ID = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd_HH-mm-ss')
npx playwright test tests/demoqa-books --project=chromium --project=firefox --project=webkit --grep-invert "@account" --workers=3
node scripts/workbook.mjs sync --app demoqa-books

# Pass B: account tests, one worker (42 tests)
$env:E2E_RUN_ID = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd_HH-mm-ss')
npx playwright test tests/demoqa-books --project=chromium --project=firefox --project=webkit --grep "@account" --workers=1
node scripts/workbook.mjs sync --app demoqa-books
node scripts/workbook.mjs build --app demoqa-books
Remove-Item Env:BASE_URL, Env:TEST_SUITE, Env:E2E_RUN_ID
```

Pass A + Pass B = 102 + 42 = **144 tests**. Run the passes one after the other.

**Concurrency of the three browsers.** Running the three browsers' account tests at the same time is
**safe in principle** (different accounts, collections and wrong-password budgets), but Pass B uses
`--workers=1`, so they run one after another. Playwright's worker pool is global, and with
`--workers=3` two workers could take two account files of the **same** browser; the `accountLock`
mutex then makes the second wait, so it stays correct, only less efficient. A per-project worker limit
would need a change to the shared `playwright.config.ts` (probe P15), which is not part of this plan.

## 8. Scenario-to-test mapping (all 48)

Titles start with `[DQB-nnn]` (`lib/artifact-reporter.ts` ID pattern). "Acct" = tagged `@account`.

| ID | Spec | Test title | Fixtures / notes |
| --- | --- | --- | --- |
| TC-01 | books | `[TC-01] Guest sees the 8-book catalogue on the Book Store` | booksPage; `open()` response status 200 and `request().redirectedFrom()` null; headers by `columnHeader`; `titleLinks` `toHaveText(CATALOGUE_TITLES)`; href; row cells |
| TC-02 | books | `[TC-02] All 8 books fit on one page and the pager is disabled` | `pageInfo`, `previousButton`/`nextButton` `toBeDisabled` |
| TC-03 | books | `[TC-03] Search by part of a title` | `toHaveText(['Git Pocket Guide'])`; URL `/books$` |
| TC-04 | books | `[TC-04] Search ignores letter case` | |
| TC-05 | books | `[TC-05] Search by author name` | row author cell "Kyle Simpson" |
| TC-06 | books | `[TC-06] Search by publisher` | count 6; the two No Starch titles count 0 |
| TC-07 | books | `[TC-07] Search matches a fragment inside a word` | `toHaveText(SEARCH_EXPECTED.partial)` |
| TC-08 | books | `[TC-08] Search term with an apostrophe` | |
| TC-09 | books | `[TC-09] Search with no matching book shows an empty table` | headers visible, `titleLinks` count 0, `pageInfo` "Page 1 of 0"; annotation R-21 |
| TC-10 | books | `[TC-10] Clearing the search restores the full list` | |
| TC-11 | books | `[TC-11] Search text is not kept after a reload` | `searchBox` `toHaveValue('')` after `reload()` |
| TC-12 | books | `[TC-12] Search with surrounding spaces is not trimmed` | annotation R-19 |
| TC-13 | books | `[TC-13] Searching by ISBN finds no book` | annotation R-20 |
| TC-14 | books | `[TC-14] Search with regular-expression characters keeps the page usable` | `pageErrors.mark()` before typing, `sinceMark()` empty after; clear restores 8 |
| TC-15 | books | `[TC-15] Title sort cycles ascending, descending and original order` | `TITLES_ASC`, `TITLES_DESC`, `CATALOGUE_TITLES`; indicators; `anySortIndicator` count 0 |
| TC-16 | books | `[TC-16] Author sort orders rows by author ascending` | `columnCells('Author')` `toHaveText(AUTHORS_ASC)` |
| TC-17 | books | `[TC-17] Image column is not sortable` | |
| TC-18 | books | `[TC-18] Guest opens a book and sees its details` | `openBook`; `fieldValue` per field; description `not.toBeEmpty()` (R-25); `websiteLink` visible |
| TC-19 | books | `[TC-19] Back To Book Store returns to the list` | `bookDetailPage.open`, `backToBookStore()` |
| TC-20 | books | `[TC-20] Detail URL with an unknown ISBN shows empty fields` | `openUnknown` status 400; title value `toHaveText('')`; `alertRegion` and `text(MESSAGES.isbnNotAvailable)` count 0; annotation R-22 |
| TC-21 | books | `[TC-21] Book list when the books service fails` | `booksApi.failListWith(500)` before `openExpectingNoRows()`; await `fired`; `titleLinks` count 0; `searchBox` visible; record `pageInfo` text and `alerts.unexpected()` (R-30) |
| TC-22 | auth | `[TC-22] Guest on a book detail page cannot add it to a collection` | guest; `session.loginButton` and `backButton` visible; `addToCollectionButton` count 0; `session.userNameLabel` count 0 |
| TC-23 | auth | `[TC-23] Guest opening the profile sees the signed-out message` | `profilePage.goto()` status 200, URL `/profile$`; message text; links' `href`; `table.table`, `logoutButton`, `deleteAccountButton`, `deleteAllBooksButton` count 0 |
| TC-24 | auth | `[TC-24] Signed-in user sees account controls on a book detail page` | Acct; `signedIn`; `userNameMatches`; `logoutButton` `toHaveText('Log out')`; add/back visible; `loginButton` count 0 |
| TC-25 | auth | `[TC-25] Registered user signs in with valid credentials` | Acct; `freshLogin()`; URL `/profile$` (15 s); `userNameMatches`; "Logout"; `booksHeading` |
| TC-26 | auth | `[TC-26] Real user name with a wrong password is rejected` | Acct; last test, own describe, `retries: 0`; breaker `ensureClosed()`, then the per-role wrong-password marker (K4); `signIn(account.userName, wrongLoginValue())` gives `'rejected'`; `errorMessage` `toHaveText(MESSAGES.loginInvalid)`; URL `/login$`; `passwordInput` `toHaveValue(wrong)`; `sessionCookieNames` lacks `token` |
| TC-27 | auth | `[TC-27] Unknown user name is rejected` | guest; `fakeUserName()`, `wrongLoginValue()`; URL `/login$`; `errorMessage` `toHaveText(/\S/)`; `recordObservation('R-18', text)`; exact text asserted only after confirmation (section 10) |
| TC-28 | auth | `[TC-28] Login submitted with both fields empty` | guest; `submitEmpty()`; both inputs `toHaveClass(/is-invalid/)`; `errorText()` is `''` |
| TC-29 | auth | `[TC-29] Login submitted with only a user name` | guest; `apiLog.count('POST', '/Account/v1/Login')` is 0; user name input `not.toHaveClass(/is-invalid/)` |
| TC-30 | auth | `[TC-30] Session survives a reload of the profile page` | Acct; `signedIn`; `profilePage.reload()`; `signedOutMessage` count 0 |
| TC-31 | auth | `[TC-31] Signed-in user sees their name on the book list` | Acct; `signedIn`, then `booksPage.open()`; "Log out" text; `loginButton` count 0 |
| TC-32 | auth | `[TC-32] Logout from the profile ends the session` | Acct; `freshLogin()`; `logOut()`; URL `/login$`; `sessionCookieNames` `toEqual([])` (via `expect.poll`); `profilePage.goto()` message |
| TC-33 | auth | `[TC-33] Log out from the book list ends the session` | Acct; `freshLogin()`; `booksPage.open()`; `session.logOut()` URL recorded (R-28); `token` absent; profile message |
| TC-34 | collection | `[TC-34] Signed-in user adds a book to their collection` | Acct; `signedIn`, `ownedBooks.claim(OWN_BOOKS.add)`; `addToCollection()` message `bookAdded`, status 201; URL unchanged; profile row cells; `deleteIcon` visible |
| TC-35 | collection | `[TC-35] Adding a book already in the collection is refused` | Acct; claim + `addViaUi(duplicate)`; second add message `bookAlreadyPresent` (status 400); `table.row(title)` count 1 |
| TC-36 | collection | `[TC-36] Added book stays after reload and after signing in again` | Acct; `freshLogin()`, claim + `addViaUi(persist)`; row; `reload()`; `logOut()`; `freshLogin()`; row with author and publisher (R-31) |
| TC-37 | collection | `[TC-37] Cancelling the delete confirmation keeps the book` | Acct; claim + add (cancel); dialog title/body/OK/Cancel; `cancelDelete()`; `apiLog.count('DELETE', '/BookStore/v1/Book')` 0; `alerts.unexpected()` empty; row visible |
| TC-38 | collection | `[TC-38] Signed-in user deletes one book from the collection` | Acct; claim + add (delete); `confirmDelete` message `bookDeleted`, status 204; row hidden; `reload()`; row count 0 |
| TC-39 | collection | `[TC-39] Profile with an empty collection` | Acct; `signedIn`; claim all five `OWN_BOOKS` (leftover removal only); `userNameMatches`; five headers; buttons visible (never clicked); if foreign rows exist: `recordObservation('R-16', titles)` and `test.skip(true, 'R-16: ...')` **after** the other checks; else rows 0 and "Page 1 of 0" (R-21) |
| TC-40 | register | `[TC-40] Register form submitted with all fields empty` | guest; `submitEmpty()`; four inputs `is-invalid`; `errorMessage` empty; URL `/register$`; `apiLog` POST `/Account/v1/User` count 0 |
| TC-41 | register | `[TC-41] Register with a weak password shows the server rule message` | guest; `fillForm` (fake name, "abc"); `submitExpectingRejection()` status 400; `errorMessage` `toHaveText(MESSAGES.weakPassword)`; four `toHaveValue`; URL; record `bodyKeys` (R-26) |
| TC-42 | navigation | `[TC-42] New User opens the register page` | guest; `openRegister()`; URL; heading |
| TC-43 | navigation | `[TC-43] Back to Login returns from the register page` | guest |
| TC-44 | navigation | `[TC-44] Signed-out profile links lead to login and register` | guest; `openSignedOutLink('login')`, `goto()`, `openSignedOutLink('register')` |
| TC-45 | navigation | `[TC-45] Book Store Application menu links open their pages` | guest; `menu.open(...)` three times; `item(name)` `toHaveClass(/\bactive\b/)` |
| TC-46 | navigation | `[TC-46] Go To Book Store leads from the profile to the book list` | Acct; `signedIn`; `goToBookStore()` URL recorded (R-29); then `toHaveURL(/\/books$/)` and 8 titles |
| TC-47 | responsive | `[TC-47] Book list on a 375x812 viewport` | guest; `test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true, isMobile: browserName !== 'firefox' })` (function override as in demo-web-shop TC-67); menu links hidden; search and Login visible; Image/Title/Author `toBeInViewport()`; Publisher `not.toBeInViewport()` (R-27); `documentScrollWidth` at most 375 |
| TC-48 | responsive | `[TC-48] Login page on a 375x812 viewport` | guest; same `test.use`; fields and Login visible; menu collapsed; scroll width |

Totals: **48 scenarios, 48 tests, 144 executions**; 0 browser-limited; 0 not automated.

## 9. Probes for the implementer (do these first)

Throwaway scripts under `artifacts/demoqa-books/discovery/probes/` (git-ignored), guest only except
P2b, P3, P4b and P11, which run once on Chromium with `existingUser` through the fixture (never
printing values).

| # | Verify | Why / fallback |
| --- | --- | --- |
| P1 | React internal key on the login button, register button, search box and detail back button after load (`__reactProps$` or `__reactEventHandlers$`), on all three browsers; and that typing after it is never lost (20 loads per page). | K7. Fallback: wait until a harmless typed probe value survives (`fillAndConfirm` on the search box, then clear), or for `/login` and `/register` wait for the `GET` responses the page makes after mount, if any. |
| P2 | (a) `fillSecretValue` with the native setter makes React accept the value (login works on all three browsers); (b) after a TC-25 run, the password and user name do not appear in `results.json`, `report/` or `summary.md`; the CSS mask hides the user name in screenshots and video. | K6. If React does not pick the value up, dispatch `input` with `InputEvent` and `bubbles: true`; never fall back to `fill()` for account values. |
| P3 | Does a new login (GenerateToken) invalidate an earlier token? Does Logout call the server? | Decides how often `signedIn` self-heals. No design change either way. |
| P4 | `#userName-value` count on `/books`, detail and `/profile` signed in; the value element inside each detail wrapper. | Section 3.3 and 3.6 locators. |
| P5 | `pageInfo` text structure; `titleLinks` count is exactly 8 (no image links); no padding rows in `tbody`. | Section 3.2 fallbacks. |
| P6 | Empty-submit on `/login` and `/register` sends no request (so the `toPass` click retry is safe). | If a request is sent, retry only after checking `apiLog`. |
| P7 | Left-menu structure (`.element-group`, `li` with class `active`), click target under the fixed footer at 1280x900 on each browser. | TC-45. |
| P8 | 375x812 on Firefox and WebKit: menu collapsed, Publisher outside the viewport, scroll width 375; hamburger locator. | TC-47, 048 (R-17). |
| P9 | With the blocklist active: list remaining third-party hosts; app pages load, reCAPTCHA iframe still renders on `/register`; no app `pageerror` caused by the block. | Extend the blocklist from evidence only. |
| P10 | `/books` "Log out" target (R-28); "Go To Book Store" target (R-29); unknown-user message (R-18). Recorded by TC-27, 033 and 046 on the first run. | Turn into assertions after review (section 10). |
| P11 | Optional: request shape and auth of `DELETE /BookStore/v1/Book` and `POST /BookStore/v1/Books` (method, body keys, header names only). | Enables a later API cleanup (Q-NB4). |
| P12 | Order of the response and the native alert for add, duplicate add and delete on all three browsers (WebKit and Firefox dialog timing). | `acceptNext` already awaits both in parallel. |
| P15 | Optional: whether Playwright 1.64 supports a per-project `workers` limit. | Only relevant if the user later wants the account pass to run browsers concurrently. |
| P16 | `filter({ visible: true })` resolves exactly one "Delete All Books" button. | Fallback: `.locator('visible=true')`. |

## 10. Risks, implementation notes and flagged scenarios

### 10.1 Notes per risk

| Risk | How the design handles it |
| --- | --- |
| R-01 hydration | K7: hydration check, `fillAndConfirm`, bounded click retry for empty submits only. `/register` is ready only once the invisible reCAPTCHA v3 token exists (`textarea[name="g-recaptcha-response"]` has a value, about 1 to 3 s after hydration): before it a filled submit shows "Please verify reCaptcha to register!" and sends nothing, and the token's arrival clears all four fields and every `is-invalid` mark. `DemoqaRegisterPage.waitForReady()` polls for the token (boolean only, never the value). |
| R-02 alerts | K9: `DemoqaAlerts`; unexpected dialogs are accepted and recorded, never left to auto-dismiss silently. |
| R-03 ads | K8: blocklist; reCAPTCHA allowed; `domcontentloaded` everywhere. |
| R-04, R-15 shared catalogue | Named assertions; environment classification of outages. |
| R-05 account collisions | K3 (worker model and mutex), K5 (own book per test, idempotent cleanup, guard). |
| R-06 lockout | K2 (few logins), K4 (one wrong attempt, marker, retries 0, last in file), circuit breaker after any real rejection. |
| R-07 account creation | Register guard; only `"abc"` is ever submitted; no successful-registration path exists. |
| R-08 duplicate ids | Role + exact name everywhere; `#submit` and `#addNewRecordButton` never used; DELETE network guard. |
| R-09 unnamed controls | Placeholders, row-scoped `#delete-record-<ISBN>`. |
| R-10 sort header names | Regex header names; indicators via `aria-label`. |
| R-11, R-27 responsive | Separate mobile tests; `toBeInViewport` for Publisher. |
| R-12 slow login | `LOGIN_REDIRECT_MS = 15_000` for the post-login URL and profile waits; collection tests `test.slow()`. |
| R-13 footer overlap | `scrollIntoView({ block: 'center' })` before menu clicks; no `force`. |
| R-14 console errors | No global console-error failure; TC-14 checks `pageerror` in a window only. |
| R-16 unexpected books | TC-39 records and skips the empty check; the cleaner never removes them. |
| R-17 Firefox/WebKit unobserved | First run on those browsers is exploratory; probes P1, P2, P8, P12. |
| R-18 to R-30 discrepancies and assumptions | Current behaviour asserted where stable; `recordObservation` for R-18, R-26, R-28, R-29, R-30; annotations name the R-id for the report. |
| R-31 persistence | TC-36 confirms on the first run. |
| R-32 guest profile | TC-23 asserts the observed 200 with message. |
| R-33 session expiry | No scenario; nothing to build. |

### 10.2 Scenarios that cannot be implemented exactly as written (flagged, not changed)

1. **TC-27 (two-phase).** The exact message cannot be asserted until it is observed (R-18). First
   implementation asserts URL and a non-empty `p#name` and records the text; after the first run is
   reviewed, the exact text assertion is added and scenarios.json updated. The scenario itself
   describes this, so the acceptance criteria are unchanged.
2. **TC-39 (conditional).** "Skips the empty check" if foreign books exist: implemented as
   `test.skip(true, reason)` **after** the other checks, so the result shows **Skipped**, not Passed.
   Needs the user's agreement that a Skipped status is the intended outcome.
3. **TC-37 "no native alert appears".** The absence of a later alert cannot be proven in finite time.
   Proxies: no `DELETE /BookStore/v1/Book` request and no dialog event by the time the modal has
   closed and the row is re-checked. Stated in the test as a comment.
4. **TC-20 "No user-facing error message is shown".** Only checkable against known candidates: no
   `role=alert` and no text "ISBN supplied is not available in Books Collection!". A differently
   worded message elsewhere on the page would not be detected.
5. **TC-14 "no uncaught page error".** Checked only for errors raised between typing and clearing
   (`pageErrors.mark()`), because the page may raise errors from blocked third-party code at load.
6. **TC-47 / TC-48 on Firefox.** Playwright does not support `isMobile` on Firefox; Firefox runs
   with the 375x812 viewport and touch only (desktop user agent). The asserted layout is driven by
   viewport width, so the acceptance criteria are still checked; the precondition "mobile context" is
   only partly met on Firefox.
7. **TC-24, 030, 031, 034, 035, 037, 038, 039, 046 "signed in (storageState reused)".** Implemented
   as cookies captured from a real UI login in the same worker (K2), not a storageState file. The
   effect is the same; noted only for traceability.
8. **TC-33 and TC-46** record the landing URL (R-28, R-29). TC-46 additionally asserts
   `/books` and the 8 titles, as its expected result states; if P10 shows another target, that is a
   finding to review, not a silent change.

No scenario is blocked. All 48 can be automated on all three browsers.

### 10.3 Other notes

- **TypeScript.** Run `npx tsc --noEmit` before the first execution; the `.cjs` import resolves through
  `lib/credentials-store.d.cts`.
- **Retries in CI** (`retries: 2`) apply to everything except TC-26. Do not use `--repeat-each` on
  `auth.spec.ts`; the wrong-password marker would make the repeat fail rather than try again.
- **Screenshots** of signed-in pages are masked by CSS (K6); they remain git-ignored local artifacts,
  and the HTML report zips should not be shared unedited (reporting.md).
