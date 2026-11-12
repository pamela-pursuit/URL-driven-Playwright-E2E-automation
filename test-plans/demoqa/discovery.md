# demoqa - Discovery (Book Store, guest only)

## Run details

- URL tested: https://demoqa.com/books
- Final URL: https://demoqa.com/books (HTTP 200, no redirects)
- Browser: Chromium (Playwright), default 1280x720 viewport
- Date: 2026-11-12
- Boundary: https://demoqa.com, Book Store pages under `/books`
- Environment (guess): public demo / practice site
- Scope: list, search and view a book as a guest. Not signed in, nothing changed.

## Book list (https://demoqa.com/books)

- Page title: "demosite" (no page heading found by the crawl)
- One table (`getByRole('table')`), column headers: "Image", "Title", "Author", "Publisher"
- 8 book rows load (9 rows including the header row); pager shows "Page 1 of 1", "Previous" and "Next" buttons both disabled
- Rows observed (Title / Author / Publisher):
  1. Git Pocket Guide / Richard E. Silverman / O'Reilly Media
  2. Learning JavaScript Design Patterns / Addy Osmani / O'Reilly Media
  3. Designing Evolvable Web APIs with ASP.NET / Glenn Block et al. / O'Reilly Media
  4. Speaking JavaScript / Axel Rauschmayer / O'Reilly Media
  5. You Don't Know JS / Kyle Simpson / O'Reilly Media
  6. Programming JavaScript Applications / Eric Elliott / O'Reilly Media
  7. Eloquent JavaScript, Second Edition / Marijn Haverbeke / No Starch Press
  8. Understanding ECMAScript 6 / Nicholas C. Zakas / No Starch Press
- Each title is a link, href `/books?search=<ISBN>` (e.g. Git Pocket Guide -> `/books?search=9781449325862`)
- A "Login" button is shown top right for guests (not used)

## Search box

- Single text input: id `searchBox`, placeholder "Type to search", no aria-label
- Filters the table live while typing (no submit needed; ~500-800 ms wait was enough)
- "Git" -> only "Git Pocket Guide" remains
- "git" (lower case) -> same single row, "Git Pocket Guide" (case-insensitive)
- "Java" -> "Learning JavaScript Design Patterns", "Speaking JavaScript", "Programming JavaScript Applications", "Eloquent JavaScript, Second Edition"
- "Osmani" (author name) -> "Learning JavaScript Design Patterns" (search also matches author)
- "zzzz" -> only the header row remains; no "No rows found" style message is shown; pager reads "Page 1 of 0"
- Clearing the box -> all 8 books return

## Book detail (click a title as a guest)

- Clicking "Git Pocket Guide" goes to https://demoqa.com/books?search=9781449325862
- Shown as label / value pairs: "ISBN:" 9781449325862, "Title :" Git Pocket Guide, "Sub Title :" A Working Introduction, "Author :" Richard E. Silverman, "Publisher :" O'Reilly Media, "Total Pages :" 234, "Description :" (text), "Website :" http://chimera.labs.oreilly.com/books/1230000000561/index.html
- No add-to-collection button is shown to a guest
- "Back To Book Store" button returns to https://demoqa.com/books with all 8 books

## Locator candidates

| Element | Preferred | Fallback |
|---|---|---|
| Book table | `getByRole('table')` | - |
| Column header | `getByRole('columnheader', { name: 'Title' })` | - |
| Book rows | `getByRole('table').getByRole('row')` (minus header) | - |
| Book title link | `getByRole('link', { name: 'Git Pocket Guide' })` | - |
| Search box | `getByPlaceholder('Type to search')` | `#searchBox` (stable id, no accessible name) |
| Pager text | `getByText(/Page \d+ of \d+/)` | - |
| Previous / Next | `getByRole('button', { name: 'Previous' })` / `{ name: 'Next' }` | - |
| Back button (detail) | `getByRole('button', { name: 'Back To Book Store' })` | - |
| Detail title value | `getByText('Git Pocket Guide')` within detail | `#title-wrapper #userName-value` (CSS; all values share id `userName-value`, so scope by wrapper) |

## Timing and flakiness

- Book rows render after page load (async); first title link visible about 2 s after navigation. Wait for a title link, not for network idle.
- Right-side ad panel present (blank placeholder in screenshots); did not overlap the table at 1280x720.
- Search icon button next to the box has no accessible name (empty button text).

## Not observed

- Any "no results" message text (none exists on screen; only "Page 1 of 0")
- Pagination beyond one page (only 8 books, pager disabled); rows-per-page control not found
- Signed-in behaviour, adding to a collection, profile: out of scope (requires sign in)
- Behaviour on other browsers or mobile viewport
- Console errors were not captured in these probes
