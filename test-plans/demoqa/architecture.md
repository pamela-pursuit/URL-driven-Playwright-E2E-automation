# demoqa - Architecture (Book Store, guest only)

## 1. File plan (all new; nothing existing is modified)

| File | Purpose |
|---|---|
| `pages/demoqa/books.page.ts` | `DemoqaBooksPage`: book list, search, pager |
| `pages/demoqa/book-detail.page.ts` | `DemoqaBookDetailPage`: detail values, "Back To Book Store" |
| `fixtures/demoqa.fixture.ts` | `test.extend` with `booksPage`, `bookDetailPage`; re-exports `expect` |
| `test-data/demoqa.data.ts` | Static constants from scenarios.json `testData` |
| `tests/demoqa/books.spec.ts` | TC-01..TC-03 |

Names follow the approved catalogue (`pageObject` = `DemoqaBooksPage` / `DemoqaBookDetailPage`, `specFile` = `tests/demoqa/books.spec.ts`), so the catalogue stays in step with the code.
**playwright.config.ts: no change.** `baseURL` comes from `process.env.BASE_URL`, which `scripts/run-e2e.ps1 -App demoqa -BaseUrl https://demoqa.com/` sets. Use the trailing slash so `page.goto('books')` resolves to `https://demoqa.com/books`.

## 2. Page objects

**`DemoqaBooksPage`** (constructor takes `page`)
- `table` = `getByRole('table')`; `columnHeader(name)` = `table.getByRole('columnheader', { name })`
- `bookRows` = `table.getByRole('row')` filtered to rows that contain a link (this leaves out the header row)
- `bookLink(title)` = `table.getByRole('link', { name: title, exact: true })`
- `searchBox` = `getByPlaceholder('Type to search')` (fallback `#searchBox`)
- `pager` = `getByText(/Page \d+ of \d+/)`
- `open()`: `goto('books', { waitUntil: 'domcontentloaded' })`, then `waitForBooks()`. Returns `this`.
- `waitForBooks()`: waits for the first `table.getByRole('link')` to be visible (the rows load about 2 s after the page). It never waits for network idle and never uses a fixed sleep.
- `search(text)`: calls `searchBox.fill(text)`. The table filters live, so specs check the result with web-first `expect` checks, which retry. There is no sleep.
- `clearSearch()`: calls `searchBox.clear()`.
- `bookTitles()`: returns the trimmed inner text of every row link.
- `openBook(title)`: clicks `bookLink(title)` and returns `new DemoqaBookDetailPage(page)` after `waitForLoaded()`.

**`DemoqaBookDetailPage`**
- `field(label)`: a row scoped by its own label, for example `page.locator('[id$="-wrapper"]').filter({ has: page.getByText(label, { exact: true }) })`, with its value at `#userName-value` inside that row. This scoping is needed because every value element shares the id `userName-value`. Labels: `'Title :'`, `'Author :'`, `'Publisher :'`.
- `titleValue`, `authorValue`, `publisherValue` are locators built from `field(...)`.
- `backButton` = `getByRole('button', { name: 'Back To Book Store' })`
- `waitForLoaded()`: waits for `backButton` to be visible.
- `backToBookStore()`: clicks the button and returns `DemoqaBooksPage` after `waitForBooks()`.

## 3. Fixtures (`fixtures/demoqa.fixture.ts`)
- `booksPage` and `bookDetailPage` are the only fixtures.
- **No account fixtures.** All three cases are guest only, so the fixture does not call `getAccount`. Default trace, screenshot and video settings are kept.

## 4. Data strategy
- `test-data/demoqa.data.ts` holds:
  - `SEARCH_MATCH = 'Git'` and `SEARCH_NO_MATCH = 'zzzz'`
  - `BOOK = { title: 'Git Pocket Guide', author: 'Richard E. Silverman', publisher: "O'Reilly Media" }`
  - `KNOWN_TITLES = ['Git Pocket Guide', 'Understanding ECMAScript 6']`
  - `EXPECTED_BOOK_COUNT = 8`
  - `COLUMNS = ['Image', 'Title', 'Author', 'Publisher']`
- The tests only read data and change nothing, so they need no unique data, no API setup or cleanup, and nothing to keep separate between browsers.

## 5. Spec mapping (`tests/demoqa/books.spec.ts`, all 3 browsers)
| ID | Test title |
|---|---|
| TC-01 | `[TC-01] A guest opens the Book Store and sees the list of books` |
| TC-02 | `[TC-02] A guest searches for a book and then clears the search` |
| TC-03 | `[TC-03] A guest opens a book to see its details and goes back to the list` |

Assertions stay in the spec: the column headers, the row count, the known titles, the pager text ("Page 1 of 1" or "Page 1 of 0") and the detail values. Specs contain no locators.

## 6. Network and failure simulation
None. No scenario uses `page.route`. The ad panel did not cover the table at the default desktop size, so nothing is blocked (R-03).
