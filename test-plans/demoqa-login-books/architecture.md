# demoqa-login-books - Architecture

Base URL: `BASE_URL` = https://demoqa.com/ (relative paths only: `login`, `profile`, `books`).
Second flow on the same site as `demoqa`; the guest Book Store page object is reused, not copied.

## 1. File plan

| Action | File | Purpose |
|---|---|---|
| Reuse (no change) | `pages/demoqa/books.page.ts` | `DemoqaBooksPage`: open, waitForBooks, searchBox, search, clearSearch, bookRows, bookLink |
| Reuse (no change) | `test-data/demoqa.data.ts` | `SEARCH_MATCH` ("Git"), `BOOK.title` ("Git Pocket Guide"), `EXPECTED_BOOK_COUNT` (8) |
| Create | `pages/demoqa-login-books/account-input.ts` | `setHiddenValue(locator, value)`: native value setter + `input` event, so values never appear in steps, traces or reports |
| Create | `pages/demoqa-login-books/login.page.ts` | `DemoqaLoginPage` |
| Create | `pages/demoqa-login-books/profile.page.ts` | `DemoqaProfilePage` |
| Create | `pages/demoqa-login-books/signed-in-books.page.ts` | `DemoqaSignedInBooksPage extends DemoqaBooksPage` (adds signed-in header bits only) |
| Create | `fixtures/demoqa-login-books.fixture.ts` | page fixtures, per-browser `account`, `signIn` helper fixture |
| Create | `tests/demoqa-login-books/login-flow.spec.ts` | TC-01..TC-04 |

No new test-data file: the only static value ("Git") already lives in `test-data/demoqa.data.ts`.

## 2. Page objects

### account-input.ts
- `export async function setHiddenValue(input: Locator, value: string): Promise<void>`
  - `await input.waitFor({ state: 'visible' })`, then `input.evaluate((el, v) => { native HTMLInputElement value setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value)`.
  - Reason: `fill()` records the value in the step title/trace; the React inputs accept the native setter plus input event (discovery.md).

### DemoqaLoginPage (`login.page.ts`)
| Locator | Strategy |
|---|---|
| `heading` | `getByRole('heading', { name: 'Login', level: 1 })` |
| `userNameInput` | `getByPlaceholder('UserName')` (labels not linked; never `#userName`) |
| `passwordInput` | `getByPlaceholder('Password')` |
| `loginButton` | `getByRole('button', { name: 'Login', exact: true })` |

Methods:
- `open(): Promise<this>` - `goto('login', { waitUntil: 'domcontentloaded' })`, waits for `loginButton` visible.
- `logIn(userName, password): Promise<DemoqaProfilePage>` - `setHiddenValue` on both inputs; starts `page.waitForResponse(r => r.url().includes('/Account/v1/User/') && r.request().method() === 'GET' && r.ok())` and `page.waitForURL(/\/profile/)` before clicking `loginButton`; awaits both; returns `DemoqaProfilePage` after `waitForSignedIn()`.
- `waitForLoaded()` - `waitForURL(/\/login/)` + `loginButton` visible (used after log out).

### DemoqaProfilePage (`profile.page.ts`)
| Locator | Strategy |
|---|---|
| `userNameValue` | `locator('#userName-value')` (no role/name; narrow id, per discovery.md) |
| `logoutButton` | `getByRole('button', { name: 'Logout', exact: true })` (never `#submit`) |
| `notLoggedInNotice` | `getByText('Currently you are not logged into the Book Store application', { exact: false })`; fallback `#notLoggin-label` |

Methods:
- `open(): Promise<this>` - `goto('profile', { waitUntil: 'domcontentloaded' })`; waits for `userNameValue.or(notLoggedInNotice)` visible.
- `waitForSignedIn()` - `userNameValue` visible.
- `logOut(): Promise<DemoqaLoginPage>` - click `logoutButton`, `waitForURL(/\/login/)`, returns `DemoqaLoginPage` after `waitForLoaded()`.

### DemoqaSignedInBooksPage (`signed-in-books.page.ts`)
`extends DemoqaBooksPage` (imported from `../demoqa/books.page`); inherits open, search, clearSearch, bookRows, bookLink. Constructor stores `page` locally (base keeps it private).
| Locator | Strategy |
|---|---|
| `userNameValue` | `locator('#userName-value')` |
| `logOutButton` | `getByRole('button', { name: 'Log out', exact: true })` |
| `loginButton` | `getByRole('button', { name: 'Login', exact: true })` |

Methods:
- `logOut(): Promise<DemoqaLoginPage>` - click `logOutButton`, `waitForURL(/\/login/)`, returns `DemoqaLoginPage` after `waitForLoaded()`.

## 3. Fixtures (`fixtures/demoqa-login-books.fixture.ts`)

Account role by project (one account per browser, R-02):

| Project | Role (app `demoqa-books`) | Required fields |
|---|---|---|
| chromium | `existingUser` | `userName`, `password` |
| firefox | `firefoxUser` | `userName`, `password` |
| webkit | `webkitUser` | `userName`, `password` |

- `account`: `await getAccount('demoqa-books', ROLE_BY_BROWSER[browserName], { required: ['userName', 'password'] })` (from `lib/credentials-store.cjs`, via `createRequire`). Unknown browser or missing role/field throws a descriptive error that fails the test (no skip: no scenario is credential-optional). Never logged.
- Page fixtures: `loginPage`, `profilePage`, `signedInBooksPage`.
- `signIn: () => Promise<DemoqaProfilePage>` - `loginPage.open()` then `loginPage.logIn(account.userName, account.password)`; used as the precondition of TC-02..TC-04.
- Export `test`, `expect`.

## 4. Data strategy

- No created data: read-only login and search; no API setup or cleanup needed (only the `/Account/v1/User/` response is awaited).
- Isolation: separate account per browser project so parallel browsers never sign each other out; each test has its own browser context (fresh storage), so log out in one test does not affect another.
- Secrets: values set through `setHiddenValue`; user name checked only via `toHaveText(account.userName)`; never interpolated into step titles, annotations or console; `test.use({ trace: 'off' })` in the spec.

## 5. Spec mapping (`tests/demoqa-login-books/login-flow.spec.ts`, `describe('Log in and log out (signed in)')`)

| ID | Test title | Steps (test.step) |
|---|---|---|
| TC-01 | `[TC-01] A user logs in with the saved test account and sees their Profile page` | Open the Login page; Type the saved user name in the "UserName" box; Type the saved password in the "Password" box; Click "Login" (then expect `profile.userNameValue` toHaveText(account.userName), `logoutButton` visible) |
| TC-02 | `[TC-02] A signed-in user opens the Book Store, searches for a book and then clears the search` | (signIn) Open the Book Store; Wait for the books to appear (8 rows, userNameValue toHaveText(account.userName), Log out visible, Login hidden); Type "Git"; Check the list (1 row, Git Pocket Guide); Clear the box (8 rows) |
| TC-03 | `[TC-03] A signed-in user logs out from the Book Store` | (signIn, open Book Store) Click "Log out" on the Book Store; Check the Login page (Login visible, UserName empty via toHaveValue('')); Open the Book Store again (Login visible, Log out count 0, userNameValue count 0) |
| TC-04 | `[TC-04] A signed-in user logs out from the Profile page` | (signIn, on Profile) Click "Logout" on the Profile page; Check the Login page (Login visible); Open the Profile page again (userNameValue count 0, notice toHaveText full sentence from discovery.md) |

TC-01 steps 2 and 3 call `setHiddenValue` directly through the page object (`loginPage.typeUserName/typePassword`) so each catalogue step is its own step; `logIn` covers the combined path for `signIn`.

## 6. Network and failure simulation

None. No scenario uses `page.route`. Waits are on elements, URLs and the account response only; no fixed timeouts (R-03).
