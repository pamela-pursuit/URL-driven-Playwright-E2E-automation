# Discovery: demoqa-books (Book Store Application)

Observed behaviour only. Anything not seen directly is listed under **Not observed**.
Account values are never written here; the signed-in user is shown as `<existingUser>` and
the account id as `<userID>`.

## 1. Summary

| Item | Value |
| --- | --- |
| URL tested | https://demoqa.com/books |
| Final URL | https://demoqa.com/books (HTTP 200, no redirects, `https` only, host stayed `demoqa.com`) |
| Browser | Chromium bundled with `@playwright/test` 1.64, headless, 1280x900 (plus 375x812 mobile context) |
| Run | 2026-11-10, about 17:32 to 17:55 UTC (Phase 0 crawl plus probes `guest.mjs`, `guest2.mjs`, `guest3.mjs`, `register4.mjs`, `signed-in.mjs`, `badisbn.mjs`) |
| Boundary | Origin `https://demoqa.com`; paths `/books`, `/books?search=<ISBN>`, `/login`, `/register`, `/profile`. `/swagger` recorded only. |
| Environment (guess) | Public demo / practice site (ToolsQA). Guess only. |
| Page title | `demosite` on every in-scope page (not page-specific) |
| Auth | Needed for `/profile` content and "Add To Your Collection". `/books`, detail, `/login`, `/register` are public. Role `existingUser` (`userName`, `password`) works. |
| Blockers | None. No certificate error, no unexpected host redirect. |
| data-testid | None found on any in-scope page. |

Main Book Store flows found: browse list, search (client-side filter), sort by column, open book detail,
login (invalid and valid), logout, view profile collection, add book to collection, duplicate add,
delete one book (with confirm modal), register form validation (no account created).

## 2. Routes

| Page | URL | Heading text | Purpose (observed) |
| --- | --- | --- | --- |
| Book list | `/books` | No h1 element found | Table of 8 books, search box, sort, Previous/Next, Login button (guest) or user name + "Log out" (signed in) |
| Book detail | `/books?search=<ISBN>` e.g. `/books?search=9781449325862` | Visible text "Book Store" (not reported as h1-h5) | Book fields, "Back To Book Store"; signed in also "Add To Your Collection" |
| Login | `/login` | h1 "Login", h2 "Welcome,", h5 "Login in Book Store" | Login form, "New User" goes to `/register` |
| Register | `/register` | h1 "Register", sub-heading "Register to Book Store" | Register form with reCAPTCHA |
| Profile | `/profile` | Signed in: "Books :" | Signed out: message with links. Signed in: collection table and account buttons |
| Book Store API | `/swagger` | not visited | Left-menu link only (in scope to record, not exercised) |

Left menu group "Book Store Application" (`span.group-header`) contains `li#item-0` "Login" (`/login`),
`li#item-2` "Book Store" (`/books`), `li#item-3` "Profile" (`/profile`), `li#item-4` "Book Store API" (`/swagger`).
Each is an `a.router-link`. Active item gets class `active`. Note: `item-0` etc. are list positions; the same
ids appear in other menu groups and are not unique-by-meaning.

## 3. Page details

### 3.1 `/books` (list)

- Plain `<table>` (no class, no ARIA role overrides). Accessible role `columnheader` works for headers.
- Columns: `Image`, `Title`, `Author`, `Publisher` (guest and signed in).
- 8 rows, all on one page. Text below table: `Page 1 of 1`. Buttons `Previous` and `Next` are both **disabled**.
  No rows-per-page selector exists in the current UI.
- Rows (Title | Author | Publisher | link):

  | Title | Author | Publisher | href |
  | --- | --- | --- | --- |
  | Git Pocket Guide | Richard E. Silverman | O'Reilly Media | `/books?search=9781449325862` |
  | Learning JavaScript Design Patterns | Addy Osmani | O'Reilly Media | `/books?search=9781449331818` |
  | Designing Evolvable Web APIs with ASP.NET | Glenn Block et al. | O'Reilly Media | `/books?search=9781449337711` |
  | Speaking JavaScript | Axel Rauschmayer | O'Reilly Media | `/books?search=9781449365035` |
  | You Don't Know JS | Kyle Simpson | O'Reilly Media | `/books?search=9781491904244` |
  | Programming JavaScript Applications | Eric Elliott | O'Reilly Media | `/books?search=9781491950296` |
  | Eloquent JavaScript, Second Edition | Marijn Haverbeke | No Starch Press | `/books?search=9781593275846` |
  | Understanding ECMAScript 6 | Nicholas C. Zakas | No Starch Press | `/books?search=9781593277574` |

- Each title link is wrapped in `span#see-book-<Title>` (id contains spaces, e.g. `see-book-Git Pocket Guide`).
- Images: `img[alt="book-image"]` for every row (same alt for all).
- Data source: `GET /BookStore/v1/Books -> 200` on each load.

**Search** (`input#searchBox`, placeholder `Type to search`, no label, no aria-label; icon button next to it has no accessible name):

| Input | Result rows | Notes |
| --- | --- | --- |
| `git` | Git Pocket Guide | filters as you type, no extra network request |
| `GIT` | Git Pocket Guide | case-insensitive |
| `Kyle` | You Don't Know JS | matches Author |
| `O'Reilly Media` | 6 O'Reilly rows | matches Publisher |
| `script` | Learning JavaScript Design Patterns, Speaking JavaScript, Programming JavaScript Applications, Eloquent JavaScript, Second Edition, Understanding ECMAScript 6 | partial, mid-word |
| `Don't` | You Don't Know JS | apostrophe OK |
| `9781449325862` (ISBN) | 0 rows | ISBN is not searchable |
| `  git  ` (leading/trailing spaces) | 0 rows | input is **not trimmed** |
| `(.*` | 0 rows | no error |
| `zzzznotabook` | 0 rows | header row stays, text `Page 1 of 0`, **no empty-state message** |
| cleared | 8 rows | |

- Clicking the search icon button with `Speaking` gives the same single row (filter already applied by typing).
- URL stays `https://demoqa.com/books` while searching. Search text is **not kept** after reload (box empty, 8 rows).

**Sort** (click column header; headers Title/Author/Publisher have `cursor: pointer`, Image has `cursor: default`):

- Title click 1: ascending A-Z; header shows `Title` + `<span aria-label="sorted-asc">↑</span>`.
- Title click 2: descending; `<span aria-label="sorted-desc">↓</span>`.
- Title click 3: back to original (unsorted) order, indicator removed.
- Author click 1: ascending by author (Addy Osmani ... Richard E. Silverman).
- Image header click: order unchanged.
- `aria-sort` attribute is **not** set on `th`. The header's accessible name changes (adds the arrow) after sorting,
  so `getByRole('columnheader', { name: 'Title', exact: true })` stops matching after the first click (observed timeout).

### 3.2 Book detail `/books?search=<ISBN>`

- Reached by clicking a title link. Data: `GET /BookStore/v1/Book?ISBN=<ISBN> -> 200`.
- Labels and values (Git Pocket Guide):
  `ISBN:` 9781449325862, `Title :` Git Pocket Guide, `Sub Title :` A Working Introduction, `Author :` Richard E. Silverman,
  `Publisher :` O'Reilly Media, `Total Pages :` 234, `Description :` (text ends mid-word, "... for those of you with Git exp"),
  `Website :` link `http://chimera.labs.oreilly.com/books/1230000000561/index.html`.
- Stable wrapper ids: `ISBN-wrapper`, `title-wrapper`, `subtitle-wrapper`, `author-wrapper`, `publisher-wrapper`,
  `pages-wrapper`, `description-wrapper`, `website-wrapper`; label ids `title-label`, `subtitle-label`, etc.
- Guest: buttons `Login` (`#login`) and `Back To Book Store`. **No** "Add To Your Collection".
- Signed in: `User Name :` `<existingUser>`, button `Log out`, `Back To Book Store`, `Add To Your Collection`.
- Both `Back To Book Store` and `Add To Your Collection` have the **same id** `addNewRecordButton` (duplicate id).
- `Back To Book Store` returns to `https://demoqa.com/books`.
- Unknown ISBN (`/books?search=0000000000`): page renders all labels with **empty values** and `Back To Book Store`;
  no user-facing error. Network `GET /BookStore/v1/Book?ISBN=0000000000 -> 400`
  body `{"code":"1205","message":"ISBN supplied is not available in Books Collection!"}`; console error
  `Failed to load resource: the server responded with a status of 400 (Bad Request)`.
- `/books?book=0000000000` (other param name) just shows the normal 8-row list.

### 3.3 `/login`

| Element | Label text | Type | id | Placeholder | required | for= |
| --- | --- | --- | --- | --- | --- | --- |
| UserName | `UserName :` (`label#userName-label`) | text | `userName` | `UserName` | true | none |
| Password | `Password :` (`label#password-label`) | password | `password` | `Password` | true | none |
| Button | | button | `login` | | | |
| Button | | button | `newUser` | | | |

Labels exist visually but are **not associated** (no `for`, not wrapping), so `getByLabel` will not work.
Buttons are `type="button"`, so native browser validation bubbles do not appear.

Observed:

1. **Empty submit** (click `Login`): no message text; both inputs get class `is-invalid`, red border `rgb(220, 53, 69)` and a red
   warning icon. URL stays `/login`.
2. **UserName only** (`someone`, password empty): only Password gets `is-invalid`; no message, no request.
3. **Wrong password with the real user name** (exactly one attempt made): message `Invalid username or password!`
   in `p#name` (inline style `color: red`). URL stays `/login`. Password field keeps its value.
   (Network calls for this attempt were not captured.)
4. **New User** button navigates to `https://demoqa.com/register`.
5. **Valid login**: redirects to `https://demoqa.com/profile` (about 3.9 to 5.1 s from click to URL change).
   Calls: `POST /Account/v1/GenerateToken -> 200`, `POST /Account/v1/Login -> 200`, `GET /Account/v1/User/<userID> -> 200`.
   Session cookies set on demoqa.com: `token`, `expires`, `userID`, `userName` (all non-httpOnly, session cookies).
   No session data in localStorage (only ad/tracking keys).
6. **Session persists** across reload of `/profile` (user name still shown, logout button visible).

### 3.4 `/register`

| Field | Label text | id | Placeholder | required | pattern | maxlength |
| --- | --- | --- | --- | --- | --- | --- |
| First Name | `First Name :` | `firstname` | `First Name` | true | none | none |
| Last Name | `Last Name :` | `lastname` | `Last Name` | true | none | none |
| UserName | `UserName :` | `userName` | `UserName` | true | none | none |
| Password | `Password :` | `password` | `Password` | true | `^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})$` | none |

Buttons: `Register` (`#register`), `Back to Login` (`#gotologin`, goes to `https://demoqa.com/login`).
Labels not associated with inputs (same as login).

reCAPTCHA: an iframe titled `reCAPTCHA` (`google.com/recaptcha/api2/anchor`) is visible, 256x60, rendered as the floating badge
at the bottom-right of the viewport (screenshot), not as an "I'm not a robot" checkbox in the form.

Observed:

1. **Empty submit**: all four inputs get class `is-invalid` (red border). No message text. (In one early run, clicked before
   the page had settled, no visual change happened at all; see Stability.)
2. **Weak password** (`abc`, other fields filled, captcha not solved): the client **does send** `POST /Account/v1/User`
   (no reCAPTCHA token present, `g-recaptcha-response` empty) and gets `400`
   `{"code":"1300","message":"Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer."}`.
   Message shown in `p#name`:
   `Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer.`
   Inputs keep their values; no `is-invalid` classes. Reproduced 3 of 3 times in `register4.mjs`.
   So the client neither blocks on the `pattern` attribute nor on the unsolved reCAPTCHA.
3. No account was created (the server rejected every attempt with 400; no valid password was ever submitted).

### 3.5 `/profile`

Signed out: text `Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself.`
with links `login` (`/login`) and `register` (`/register`). HTTP 200, no redirect.

Signed in:

- `Books :` heading, `User Name :` + `label#userName-value` (`<existingUser>`), button `Logout` (`#submit`).
  Note: the profile page says **`Logout`**; the book list and detail pages say **`Log out`**.
- Search box `#searchBox` (`Type to search`).
- Table columns: `Image`, `Title`, `Author`, `Publisher`, `Action`.
- **Empty collection**: header row only, text `Page 1 of 0`, Previous/Next shown. No empty-state message.
- Row action: `span#delete-record-<ISBN>` with `title="Delete"` (trash SVG, no button role, no accessible name other than title).
- Buttons: `Go To Book Store` (`#gotoStore`), `Delete Account` (`#submit`), `Delete All Books` (`#submit`, one visible and one hidden duplicate).
  `#submit` is shared by `Logout`, `Delete Account` and `Delete All Books` (duplicate ids).
- `Delete Account` and `Delete All Books` were **not clicked**.

## 4. Flows observed step by step

### F1 Browse and search (guest)
1. Open `/books` -> 8 rows (`GET /BookStore/v1/Books 200`). DOM ready about 1.9 s, rows visible about 2.3 s.
2. Type in `Type to search` -> rows filter immediately, case-insensitive, across Title/Author/Publisher.
3. No-match -> empty table, `Page 1 of 0`.

### F2 Open detail and go back (guest)
1. Click `Git Pocket Guide` -> `/books?search=9781449325862`, fields shown, buttons `Login`, `Back To Book Store`.
2. Click `Back To Book Store` -> `/books`.

### F3 Login negative
1. Empty submit -> both fields red (`is-invalid`), no text.
2. Real user name + wrong password -> `Invalid username or password!`.

### F4 Login, add to collection, delete, logout (signed in)
1. Login -> lands on `/profile`; collection empty.
2. Reload -> still signed in.
3. `/books` shows `User Name :` `<existingUser>` and `Log out` instead of `Login`.
4. Open `Git Pocket Guide` -> `Add To Your Collection` visible.
5. Click `Add To Your Collection` -> native **alert** `Book added to your collection.` (`POST /BookStore/v1/Books -> 201`). URL unchanged.
6. Click it again -> native **alert** `Book already present in the your collection!` (`POST /BookStore/v1/Books -> 400`, console 400 error). Text quoted exactly, including "the your".
7. `/profile` -> one row `Git Pocket Guide` | Richard E. Silverman | O'Reilly Media, delete icon `#delete-record-9781449325862`.
8. Click delete icon -> in-page modal (`role=dialog`), title `Delete Book`, body `Do you want to delete this book?`,
   buttons `OK` (`#closeSmallModal-ok`), `Cancel` (`#closeSmallModal-cancel`), plus an unnamed close button.
9. `Cancel` -> modal closes, row still present.
10. Delete icon -> `OK` -> native **alert** `Book deleted.` (`DELETE /BookStore/v1/Book -> 204`), row removed, `Page 1 of 0`.
11. Reload `/profile` -> collection empty.
12. Click `Logout` on `/profile` -> navigates to `https://demoqa.com/login`; cookies `token`, `expires`, `userID`, `userName` removed;
    `/profile` then shows the signed-out message.

### F5 Register validation (no account)
See 3.4. Empty submit -> red fields; weak password -> server message in `p#name`.

## 5. Account state

| When | Collection (titles) |
| --- | --- |
| Start (2026-11-10 ~17:50 UTC) | empty (0 books) |
| During | `Git Pocket Guide` added, then deleted via the row delete + `OK` |
| End | empty (0 books), confirmed after reload |

Account restored to its starting state. One wrong-password login attempt was made in total; the next valid
login succeeded (no lockout seen after one failure). `Delete All Books` and `Delete Account` were never clicked.

## 6. API calls observed (same origin)

| Call | Status | Trigger |
| --- | --- | --- |
| `GET /BookStore/v1/Books` | 200 | `/books` load, `/profile` load |
| `GET /BookStore/v1/Book?ISBN=<ISBN>` | 200 / 400 (code 1205, unknown ISBN) | detail page |
| `POST /Account/v1/GenerateToken` | 200 | valid login |
| `POST /Account/v1/Login` | 200 | valid login |
| `GET /Account/v1/User/<userID>` | 200 | profile load (signed in) |
| `POST /BookStore/v1/Books` | 201 / 400 (duplicate) | Add To Your Collection |
| `DELETE /BookStore/v1/Book` | 204 | single-row delete OK |
| `POST /Account/v1/User` | 400 (code 1300) | Register with weak password |

Search and sort are client-side (no requests).

## 7. Locator candidates

| Element | 1st choice | Fallback | Notes |
| --- | --- | --- | --- |
| Search box | `getByPlaceholder('Type to search')` | `#searchBox` | no label |
| Books table | `getByRole('table')` | | single table on page |
| Column header | `getByRole('columnheader', { name: /^Title/ })` | `thead th` nth | name gains arrow after sort; use regex |
| Sort indicator | `getByLabel('sorted-asc')` / `getByLabel('sorted-desc')` (aria-label on span) | | no `aria-sort` |
| Book link | `getByRole('link', { name: 'Git Pocket Guide' })` | `a[href="/books?search=<ISBN>"]` | hrefs stable per ISBN |
| Book row | `getByRole('row').filter({ has: getByRole('link', { name }) })` | | |
| Pagination | `getByRole('button', { name: 'Previous' })`, `'Next'`; text `Page 1 of 1` | | both disabled |
| Login (header) | `getByRole('button', { name: 'Login' })` | `#login` | on /books and detail (guest), and the login form submit |
| Detail fields | `#title-wrapper`, `#author-wrapper`, etc. (stable ids) | | label/value not associated |
| Back To Book Store | `getByRole('button', { name: 'Back To Book Store' })` | | id `addNewRecordButton` is duplicated, avoid |
| Add To Your Collection | `getByRole('button', { name: 'Add To Your Collection' })` | | same duplicate id, avoid |
| UserName / Password | `getByPlaceholder('UserName')`, `getByPlaceholder('Password')` | `#userName`, `#password` | `getByLabel` will not work |
| Login submit | `getByRole('button', { name: 'Login' })` scoped to `#userForm` | `#login` | count of `Login` buttons on /login not checked; scope to `#userForm` |
| New User | `getByRole('button', { name: 'New User' })` | `#newUser` | |
| Login error | `#name` (`p`) | `getByText('Invalid username or password!')` | same `#name` used for register errors |
| Field invalid state | class `is-invalid` on the input | | no text message |
| Register fields | `getByPlaceholder('First Name' / 'Last Name' / 'UserName' / 'Password')` | `#firstname`, `#lastname`, `#userName`, `#password` | |
| Register / Back to Login | `getByRole('button', { name: 'Register' })`, `{ name: 'Back to Login' }` | `#register`, `#gotologin` | |
| Signed-in user name | `#userName-value` | | |
| Logout | `getByRole('button', { name: /^Log ?out$/ })` | | "Logout" on /profile, "Log out" elsewhere; `#submit` is shared, avoid |
| Go To Book Store | `getByRole('button', { name: 'Go To Book Store' })` | `#gotoStore` | |
| Delete All Books | `getByRole('button', { name: 'Delete All Books' })` | | a hidden duplicate exists; scope to visible |
| Row delete icon | `#delete-record-<ISBN>` | `getByTitle('Delete')` within row | span, not a button |
| Delete modal | `getByRole('dialog')` + `getByRole('button', { name: 'OK' / 'Cancel' })` | `#closeSmallModal-ok`, `#closeSmallModal-cancel` | |
| Left menu | `getByRole('link', { name: 'Book Store' })` etc. | | many other menu links on the page; scope to the Book Store group |

No `data-testid` anywhere in scope.

## 8. Noise and stability

- Heavy third-party traffic on every page: googlesyndication (safeframes), doubleclick (`securepubads`, `cm.g`), Criteo
  (`gumi.criteo.com`, `static.criteo.net`), OpenX (`rtb`, `u`, `us-u`, `jp-u`, `oa.openxcdn.net`, `google-bidout-d.openx.net`),
  `id5-sync.com`, `crwdcntrl.net`, `adsrvr.org`, `creativecdn.com`, `ladsp.com`, `adx.opera.com`, `temu.com`,
  Google Analytics / Tag Manager, `adtrafficquality.google`. An ad slot is at the top-right of the content area
  and an empty ad container below the forms. Blocking these hosts in tests is recommended.
- Console errors on `/register`: `requestStorageAccess: Permission denied.` (several) and a report-only CSP message about framing `https://www.google.com/`.
  Failed requests: `csp.withgoogle.com` (ERR_BLOCKED_BY_ORB), `recaptcha/api2/clr` (ERR_ABORTED).
- Expected app console errors: 400 resource errors on duplicate add and unknown ISBN.
- **Hydration timing**: in 2 runs, input typed right after the page loaded was lost or the first click had no effect
  (register fields read empty after submit; register empty-submit showed no red borders). Waiting about 3 s after
  `domcontentloaded` made it consistent. Tests should wait for a ready signal (e.g. rows rendered, or a field that keeps its value).
- Login redirect took 3.9 to 5.1 s; default 5 s expectations may be tight.
- Native `alert()` is used for add, duplicate add and delete confirmation messages; tests must register a dialog handler.
- Fixed footer (`© 2013-2026 TOOLSQA.COM | ALL RIGHTS RESERVED.`) overlaps the lower left menu at 1280x900.

## 9. Responsive (375x812, mobile context)

- `/books`: left menu collapsed behind a hamburger button; search box and `Login` visible; table shows Image, Title, Author;
  **Publisher column not visible** in the viewport. Document `scrollWidth` = 375 (no page-level horizontal scroll).
- `/login`: `Login` button visible, no page-level horizontal scroll, left menu collapsed.

## 10. Not observed

- Pagination with more than one page, and any rows-per-page control (only 8 books; Previous/Next disabled).
- Sorting by Publisher; sorting on `/profile`.
- Search inside the profile collection with data.
- Network calls for the wrong-password attempt (not captured).
- Lockout or rate limit after repeated wrong passwords (only one attempt allowed).
- Login with unknown user name.
- Behaviour of `/login` when already signed in.
- Session expiry (cookie `expires` value meaning not checked).
- Successful registration and whether the server enforces reCAPTCHA. **Not observed: requires creating an account.**
- Register with existing user name, or an invalid first/last name. **Not observed: requires a possibly valid registration submit.**
- `Delete All Books` confirm modal and messages. Not observed: collection was empty except our own book, and the
  single-row path was chosen to restore state.
- `Delete Account` modal or behaviour. **Not observed: requires deleting the account.**
- `/swagger` (Book Store API) page content.
- Website link target on the detail page (not clicked).
- Firefox / WebKit behaviour.
- Accessibility audit (axe) results.
- Collection with several books (ordering, multiple deletes).

## 11. Open questions for the requirement analyst

1. Is the search meant to ignore leading/trailing spaces? Currently `  git  ` returns nothing.
2. Should search also match ISBN? Currently it does not.
3. Should a no-results / empty-collection message exist? Today only an empty table and `Page 1 of 0` show.
4. Is `Book already present in the your collection!` the accepted wording (grammar)?
5. Expected behaviour for an unknown ISBN detail URL? Today: blank fields, no message.
6. Is the client-side password `pattern` meant to block submit before the server call? Today it does not.
7. Is the reCAPTCHA meant to block registration? Today the request is sent without a token.
8. Should logout text be consistent (`Logout` vs `Log out`)?
9. Is a lockout policy expected after N failed logins? What is N?
10. Expected session lifetime and behaviour on expiry?
11. Is the truncated book description ("... Git exp") intended?
12. Are rows-per-page and multi-page pagination in scope? Current data fits one page and no rows-per-page control exists.
13. Is `Delete All Books` / `Delete Account` in scope for automation? They need a disposable account, which requires registration (currently excluded).
14. Which browsers and viewports are required (the Publisher column is hidden at 375px)?
