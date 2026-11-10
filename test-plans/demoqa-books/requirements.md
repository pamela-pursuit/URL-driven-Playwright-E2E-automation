# Requirements: demoqa-books

| Item | Value |
| --- | --- |
| App | `demoqa-books`, base URL `https://demoqa.com` (public ToolsQA practice site, shared with the world, not owned by us) |
| Date | 2026-11-10 |
| Inputs | `intake.md` (user decisions), `discovery.md` (observations, sections 1 to 11) |
| User stories / acceptance criteria | None supplied. The user gave `https://demoqa.com/books` and named no flows. |

Source labels used below:

- **Confirmed (user)**: a user decision recorded in `intake.md` or relayed by the orchestrator on 2026-11-10.
- **Observed (D x.y)**: seen during discovery, `discovery.md` section x.y.
- **Assumed**: not specified and not observed. Must not be asserted as a hard rule without confirmation. Record it as a gap if behaviour differs.

## 1. Requirement Summary

Priorities follow `.claude/skills/qa-playwright/test-design.md`. Scope is the Book Store Application only, **Assumed** from the URL (intake.md); the other demoqa sections are out of scope.

| REQ | Flow | Priority | In scope |
| --- | --- | --- | --- |
| REQ-01 | Book list: 8 rows, columns, title links, `Page 1 of 1`, Previous/Next disabled | Medium | Yes |
| REQ-02 | Search on `/books`: client-side filter on Title/Author/Publisher, case-insensitive, partial, no match, clear, not kept after reload | Medium | Yes |
| REQ-03 | Sort on `/books`: Title and Author asc / desc / unsorted cycle, Image not sortable | Low | Yes |
| REQ-04 | Book detail: fields for a known ISBN, guest vs signed-in buttons, Back To Book Store, unknown ISBN | Medium | Yes |
| REQ-05 | Login: valid sign-in to `/profile`, wrong password, unknown user name, empty and partial submit, New User link | High | Yes |
| REQ-06 | Session and logout: session survives reload, signed-in header on `/books`, Logout clears session and returns to `/login` | High | Yes |
| REQ-07 | Guest restrictions: `/profile` signed-out message with login/register links; no "Add To Your Collection" for guests | High | Yes |
| REQ-08 | Add to collection: success alert, duplicate-add alert, book appears in profile | High | Yes |
| REQ-09 | Profile collection: rows and columns, delete one book (Cancel keeps it, OK removes it), persistence after reload, empty state | High | Yes |
| REQ-10 | Registration **validation only**: empty submit, weak-password server message, Back to Login. Never a successful registration | Medium | Yes (restricted) |
| REQ-11 | Navigation: left-menu Book Store group links, Go To Book Store, Back to Login, New User | Low | Yes |
| REQ-12 | Responsive 375x812: collapsed menu, no page-level horizontal scroll, key controls visible on `/books` and `/login` | Medium | Yes |
| REQ-13 | Cross-browser: REQ-01 to REQ-12 on Chromium, Firefox and WebKit (project default) | Medium | Yes (execution model depends on Q1) |

## 2. Source of each requirement

### REQ-01 Book list

- `/books` returns 200 with no redirect; page title `demosite` on every page (not page-specific). **Observed (D 1)**
- Columns `Image`, `Title`, `Author`, `Publisher`; 8 rows with the titles, authors, publishers and `/books?search=<ISBN>` links listed in D 3.1. **Observed (D 3.1)**
- Text `Page 1 of 1`; `Previous` and `Next` both disabled; no rows-per-page control. **Observed (D 3.1)**
- No h1 on `/books`. **Observed (D 2)**
- The 8-book catalogue stays unchanged. **Assumed** (shared public data).

### REQ-02 Search

- `input#searchBox`, placeholder `Type to search`, no label. Filters as you type, no network request. **Observed (D 3.1)**
- `git` and `GIT` give Git Pocket Guide; `Kyle` gives You Don't Know JS (author); `O'Reilly Media` gives 6 rows (publisher); `script` gives 5 rows (partial, mid-word); `Don't` works. **Observed (D 3.1)**
- ISBN `9781449325862` gives 0 rows; `  git  ` (leading/trailing spaces) gives 0 rows (not trimmed); `(.*` gives 0 rows with no error. **Observed (D 3.1)**
- No match (`zzzznotabook`): header row stays, text `Page 1 of 0`, **no empty-state message**. **Observed (D 3.1)**
- Clearing restores 8 rows; URL unchanged while searching; search text not kept after reload. **Observed (D 3.1)**
- Whether trimming, ISBN search, or an empty-state message is intended: **not specified** (Q-NB3).

### REQ-03 Sort

- Title: click 1 ascending (`span[aria-label="sorted-asc"]` "↑"), click 2 descending (`sorted-desc` "↓"), click 3 original order, indicator removed. **Observed (D 3.1)**
- Author click 1 ascending by author. Image header click leaves the order unchanged. **Observed (D 3.1)**
- `aria-sort` is not set; the header accessible name gains the arrow after sorting. **Observed (D 3.1)**
- Publisher sort and sort on `/profile`: **not observed (D 10)**. Publisher sort **Assumed** to behave like Title/Author; candidate only.

### REQ-04 Book detail

- Clicking a title opens `/books?search=<ISBN>` (`GET /BookStore/v1/Book?ISBN=<ISBN>` 200). **Observed (D 3.2)**
- Git Pocket Guide shows `ISBN:` 9781449325862, `Title :` Git Pocket Guide, `Sub Title :` A Working Introduction, `Author :` Richard E. Silverman, `Publisher :` O'Reilly Media, `Total Pages :` 234, a Description, and a Website link. Wrapper ids `ISBN-wrapper`, `title-wrapper`, etc. **Observed (D 3.2)**
- The description ends mid-word ("... for those of you with Git exp"). **Observed (D 3.2)**. Whether intended: unknown; do not assert the full text (Q-NB3).
- Guest: `Login` and `Back To Book Store`, no `Add To Your Collection`. Signed in: `User Name :` value, `Log out`, `Back To Book Store`, `Add To Your Collection`. **Observed (D 3.2)**
- `Back To Book Store` returns to `https://demoqa.com/books`. **Observed (D 3.2)**
- Unknown ISBN (`/books?search=0000000000`): labels with empty values, no user-facing error; API 400 with `{"code":"1205","message":"ISBN supplied is not available in Books Collection!"}`. **Observed (D 3.2)**. The expected user-facing behaviour is **not specified** (Q-NB3).
- Website link target: **not observed (D 10)**. Out of scope (off-origin).

### REQ-05 Login

- Form with UserName (`#userName`, placeholder `UserName`) and Password (`#password`, placeholder `Password`), buttons `Login` and `New User`. Labels are not associated with inputs. Buttons are `type="button"` (no native validation bubbles). **Observed (D 3.3)**
- Empty submit: both inputs get class `is-invalid` (red border), no message text, URL stays `/login`. **Observed (D 3.3)**
- UserName only: only Password gets `is-invalid`, no request. **Observed (D 3.3)**
- Real user name + wrong password: `Invalid username or password!` in `p#name`; URL stays `/login`; Password keeps its value. **Observed (D 3.3)** (one attempt only).
- Unknown user name: **not observed (D 10)**. The message is **Assumed** to be `Invalid username or password!`; confirm on the first run before asserting the exact text (Q-NB2).
- Valid existingUser login redirects to `https://demoqa.com/profile` in about 3.9 to 5.1 s; calls `GenerateToken` 200, `Login` 200, `GET /Account/v1/User/<userID>` 200; cookies `token`, `expires`, `userID`, `userName` set. **Observed (D 3.3)**
- `New User` navigates to `https://demoqa.com/register`. **Observed (D 3.3)**
- Lockout or rate limit after failed logins: **not observed (D 10)**. Unknown (Q-NB1).
- `/login` while already signed in: **not observed (D 10)**.

### REQ-06 Session and logout

- Session persists across reload of `/profile`. **Observed (D 3.3, D 4 F4.2)**
- Signed in, `/books` shows `User Name :` `<existingUser>` and `Log out` instead of `Login`. **Observed (D 4 F4.3)**
- `Logout` on `/profile` navigates to `https://demoqa.com/login`, removes the four cookies; `/profile` then shows the signed-out message. **Observed (D 4 F4.12)**
- Button text is `Logout` on `/profile` and `Log out` on list/detail. **Observed (D 3.5)**. Whether the inconsistency is intended: unknown (Q-NB3).
- `Log out` from `/books` or detail: **not observed**. **Assumed** to behave like profile `Logout`; candidate only.
- Session lifetime and expiry: **not observed (D 10)**. Not specified; out of scope until specified.

### REQ-07 Guest restrictions

- Signed out, `/profile` (HTTP 200, no redirect) shows `Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself.` with links `login` (`/login`) and `register` (`/register`). **Observed (D 3.5)**
- Guests see no `Add To Your Collection` on detail. **Observed (D 3.2)**
- Whether `/profile` should redirect guests to `/login`: **not specified**. Test as observed.

### REQ-08 Add to collection

- Tests may add and remove books in existingUser's collection. **Confirmed (user)**
- `Add To Your Collection` gives native alert `Book added to your collection.` (`POST /BookStore/v1/Books` 201); URL unchanged. **Observed (D 4 F4.5)**
- Adding the same book again gives native alert `Book already present in the your collection!` (400, console error). Text quoted exactly, including "the your". **Observed (D 4 F4.6)**. Grammar: possible defect, assert as observed (Q-NB3).
- The added book appears on `/profile` with Title, Author, Publisher and delete icon `#delete-record-<ISBN>`. **Observed (D 4 F4.7)**
- Collection with several books (ordering, multiple deletes): **not observed (D 10)**.

### REQ-09 Profile collection and delete

- Signed in: `Books :`, `User Name :` value, `Logout`, search box, columns `Image`, `Title`, `Author`, `Publisher`, `Action`, buttons `Go To Book Store`, `Delete Account`, `Delete All Books`. **Observed (D 3.5)**
- Empty collection: header row only, `Page 1 of 0`, no empty-state message. **Observed (D 3.5)**
- Delete icon opens modal (`role=dialog`) titled `Delete Book`, body `Do you want to delete this book?`, buttons `OK` and `Cancel`. **Observed (D 4 F4.8)**
- `Cancel` closes the modal and keeps the row. **Observed (D 4 F4.9)**
- `OK` gives native alert `Book deleted.` (`DELETE /BookStore/v1/Book` 204), removes the row, `Page 1 of 0`; reload confirms the collection is empty. **Observed (D 4 F4.10, F4.11)**
- Collection was empty at the start and restored to empty at the end of discovery. **Observed (D 5)**
- Profile search with data, `Delete All Books`: **not observed (D 10)**.

### REQ-10 Registration validation

- Tests must not create accounts. **Confirmed (user)**
- Fields First Name, Last Name, UserName, Password, all `required`; Password `pattern` `^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})$`; no `maxlength`. **Observed (D 3.4)**
- Empty submit: all four inputs get `is-invalid`, no text. **Observed (D 3.4)**
- Weak password `abc`: the client sends `POST /Account/v1/User` without a reCAPTCHA token; 400 code 1300; `p#name` shows `Passwords must have at least one non alphanumeric character, one digit ('0'-'9'), one uppercase ('A'-'Z'), one lowercase ('a'-'z'), one special character and Password must be eight characters or longer.` Values kept. Reproduced 3 of 3. **Observed (D 3.4)**
- The client blocks neither on the `pattern` nor on the unsolved reCAPTCHA. **Observed (D 3.4)**. Intended: unknown (Q-NB3).
- `Back to Login` goes to `https://demoqa.com/login`. **Observed (D 3.4)**
- reCAPTCHA iframe renders as a floating badge. **Observed (D 3.4)**
- Successful registration, server reCAPTCHA enforcement, duplicate user name, invalid names: **not observed (D 10)**. Out of scope (would or could create an account).

### REQ-11 Navigation

- Left-menu group "Book Store Application" with `Login`, `Book Store`, `Profile`, `Book Store API`; active item gets class `active`. **Observed (D 2)**
- `Go To Book Store` (`#gotoStore`) exists on `/profile`. **Observed (D 3.5)**. Its target is **Assumed** `/books`; confirm on the first run.
- `/swagger` content: **not observed**. Out of scope.

### REQ-12 Responsive

- At 375x812: `/books` left menu collapsed behind a hamburger; search and `Login` visible; Image, Title, Author visible; **Publisher column not visible**; document `scrollWidth` 375. `/login` `Login` button visible, no page-level horizontal scroll. **Observed (D 9)**
- Whether hiding Publisher on mobile is intended: unknown (Q-NB3). Test as observed.
- Other viewports: no requirement.

### REQ-13 Cross-browser

- Project default is Chromium, Firefox and WebKit. **Confirmed (orchestrator, project default)**
- Firefox and WebKit behaviour: **not observed (D 10)**. **Assumed** to match Chromium.

## 3. Missing Acceptance Criteria

Nobody has specified the following. Tests assert observed behaviour only and record differences as gaps.

1. **Authentication:** lockout or throttling threshold; message for an unknown user name; session lifetime and expiry; whether `/login` redirects a signed-in user; whether `/profile` should redirect guests.
2. **Search:** whether input is trimmed; whether ISBN is searchable; a no-results message; search on `/profile`.
3. **Empty states:** whether an empty collection or no-match search should show a message (today only `Page 1 of 0`).
4. **Detail:** user-facing behaviour for an unknown ISBN (today blank fields); whether the truncated description is intended.
5. **Messages:** accepted wording of `Book already present in the your collection!`; `Logout` vs `Log out`.
6. **Registration:** whether the client should block on the password pattern and on the reCAPTCHA before calling the server; name length limits (no `maxlength`); user-name rules.
7. **Collection:** maximum collection size; ordering of several books; `Delete All Books` behaviour and messages.
8. **Pagination:** rows-per-page and multi-page behaviour (8 books fit one page; no control exists).
9. **Responsive:** supported viewports; whether Publisher may be hidden at 375px.
10. **Non-functional:** accessibility target (none; see section 6), performance (login redirect 3.9 to 5.1 s).

## 4. Ambiguities and Clarification Questions

| ID | Question | Type | Affects | Recommended default |
| --- | --- | --- | --- | --- |
| Q1 | All three browsers share **one** account and one collection. Do you accept strictly serial execution (`workers: 1`, no parallel CI shards, nobody else running the suite at the same time), with **collection-changing** tests (add, duplicate add, delete) on **Chromium only**? | **Blocking** | REQ-08, REQ-09, REQ-13 (High) | Yes: serial run; add/delete tests on Chromium only; read-only signed-in tests (login, session, logout, profile view, detail as signed-in) and all guest tests on all three browsers. Same model as demo-web-shop D2. |

Non-blocking items (proceed with the stated default unless the user objects):

| ID | Topic | Default assumption |
| --- | --- | --- |
| Q-NB1 | Lockout threshold unknown | At most **one** wrong-password attempt for the real user name per run. All other negative login tests use a fake user name (e.g. `qa-nonexistent-<timestamp>`). Reuse a signed-in `storageState` to limit logins. |
| Q-NB2 | Unknown-user-name login message not observed | Assert URL stays `/login` and an error shows in `p#name`; assert the exact text `Invalid username or password!` only after the first run confirms it. |
| Q-NB3 | Observed quirks: search not trimmed, ISBN not searchable, no empty-state message, unknown ISBN shows blank fields, "the your" wording, `Logout` vs `Log out`, truncated description, password pattern and reCAPTCHA not enforced client-side, Publisher hidden at 375px | Assert current behaviour where it is a stable user outcome and flag each as a "possible defect / gap" in the report. Do not assert the full description text. |
| Q-NB4 | Collection cleanup | Each test removes only the books it added, in setup (leftovers from a failed run) and teardown, via the observed single-row delete + `OK`. API cleanup (`DELETE /BookStore/v1/Book`) only after its request shape is captured. Never use `Delete All Books`. |
| Q-NB5 | `Delete All Books` in scope? | No. Not observed, and it would empty the whole collection. Can be added later if the user wants it. |
| Q-NB6 | Accessibility | Out of scope, assumed from the user's decision D6 on demo-web-shop (accessibility out of scope for dummy sites); confirm for this app. Discovery shows no specific reason to include it. |
| Q-NB7 | Pagination | Only assert `Page 1 of 1` and disabled Previous/Next; multi-page and rows-per-page are untestable with 8 books and no control. |
| Q-NB8 | Viewports | Desktop 1280x900 on all three browsers plus 375x812 mobile checks (REQ-12). |

## 5. Testing Risks and Assumptions

| ID | Type | Description | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R-01 | Risk | **Hydration timing**: input typed or clicks made right after load are lost (2 runs, D 8) | High (false failures) | Wait for a readiness signal (rows rendered, a field keeps its value via `toHaveValue` after fill) before interacting; use web-first assertions, no fixed sleeps. |
| R-02 | Risk | **Native `alert()`** for add, duplicate add and delete (D 8) | High (hangs, lost assertions) | Register a dialog handler before the click, capture `dialog.message()`, accept it. |
| R-03 | Risk | **Third-party ads and trackers** (Criteo, OpenX, DoubleClick, googlesyndication, etc., D 8); an ad slot sits in the content area | Medium (slow loads, overlays, intercepted clicks) | Block the listed ad hosts with `page.route`; navigate with `waitUntil: 'domcontentloaded'`. Do not block `google.com/recaptcha` on `/register` unless needed. |
| R-04 | Risk | **Shared public demo**: the catalogue or site can change or be down; other people may use the same site | Medium | Health-check base URL; assert by named books; record outages as environment failures. |
| R-05 | Risk | **One shared account** across browsers, retries and runs; leftovers from failed runs | High (collection pollution, duplicate-add false results) | Q1 default (serial, Chromium-only writes); idempotent own-book cleanup before and after (Q-NB4); use distinct books per test where possible. |
| R-06 | Risk | **Unknown lockout** on the only account | High (blocks the signed-in suite) | Q-NB1: one wrong-password attempt per run; fake user names for other negatives; reuse `storageState`. |
| R-07 | Risk | **Registration / reCAPTCHA**: the server accepts the request without a token; a valid password could create a real account | High (irreversible, violates user decision) | Only submit passwords that fail the server rule (e.g. `abc`); never submit a pattern-valid password; never solve or bypass the captcha. |
| R-08 | Risk | **Duplicate element ids**: `#submit` (Logout, Delete Account, Delete All Books), `#addNewRecordButton` (Back To Book Store, Add To Your Collection), `#userName` on login and register, menu `item-N` ids | High (wrong button clicked, e.g. Delete Account) | Never locate by these ids; use role + exact name (D 7). Logout via `/^Log ?out$/`. |
| R-09 | Risk | **Labels not linked to inputs**; search box and search icon unnamed; delete icon is a span with `title` only | Medium | Use `getByPlaceholder`, `getByTitle('Delete')` scoped to the row, `#delete-record-<ISBN>` fallback (D 7). |
| R-10 | Risk | **Sort header name changes** after sorting | Low | Regex header names `/^Title/`; assert via `sorted-asc`/`sorted-desc` labels and row order. |
| R-11 | Risk | **Responsive differences at 375px**: menu collapsed, Publisher column hidden | Medium | Separate mobile scenarios; do not reuse desktop assertions on Publisher at 375px. |
| R-12 | Risk | **Slow login redirect** (3.9 to 5.1 s) vs default 5 s expect timeout | Medium | Use a longer timeout for the post-login URL assertion. |
| R-13 | Risk | **Fixed footer overlaps** the lower left menu at 1280x900 | Low | Prefer direct navigation or scroll into view; scope menu clicks. |
| R-14 | Risk | **Expected console errors** (400 on duplicate add and unknown ISBN; `requestStorageAccess` on `/register`) | Low | Do not fail tests on console errors globally; allow-list these. |
| R-15 | Assumption | A-01: The catalogue keeps the 8 books listed in D 3.1. | Medium | Assert by name; investigate on change. |
| R-16 | Assumption | A-02: existingUser's collection is empty at the start of each run, apart from leftovers of our own tests. | Medium | Setup removes own-test books; assert row-specific, not absolute counts where avoidable. |
| R-17 | Assumption | A-03: Firefox and WebKit render the same markup and timing as Chromium. | Medium | First run on those browsers is exploratory; investigate before calling flaky. |

## 6. Out of Scope / Unsafe Actions

Never automated:

- **`Delete Account`** on `/profile`: never clicked, never located by `#submit`. **Confirmed (user)**
- **Account creation**: any successful registration, any register submit with a password that satisfies the server rule, register with the existing user name. **Confirmed (user)**
- Solving, bypassing or disabling the reCAPTCHA.
- `Delete All Books` (Q-NB5 default).
- Removing books the tests did not add (none exist today).
- Brute-force or lockout testing of existingUser (Q-NB1).
- Session-expiry testing by waiting (not specified).
- Everything outside the Book Store Application: Elements, Forms, Alerts/Frames/Windows, Widgets, Interactions. **Assumed** from the URL (intake.md).
- `/swagger` (Book Store API page) and direct API testing; API calls are allowed only as test setup/cleanup for own books (Q-NB4).
- The external Website link on the detail page and any ad or third-party link.
- Accessibility testing: assumed from the user's decision D6 on demo-web-shop (accessibility out of scope for dummy sites); **confirm** for this app (Q-NB6). Discovery found unlabeled inputs and buttons, but no reason that requires a11y scope.
- Load or performance testing against the public site.

## 7. Credential Needs

| Role | Fields | Needed for | Status |
| --- | --- | --- | --- |
| `existingUser` | `userName`, `password` | REQ-04 (signed in), REQ-05, REQ-06, REQ-08, REQ-09 | Present: masked `check` OK on 2026-11-10 (intake.md); valid login confirmed in discovery (D 3.3) |
| `newUser` | none | Not needed: tests must not create accounts | Not requested (Confirmed (user)) |

Check command for the orchestrator (masked output):

```powershell
node scripts/credentials.mjs check --app demoqa-books --require existingUser:userName,password
```

The analyst has no shell access in this step (node is blocked in Claude sessions), so the command was not re-run here. Last recorded result: OK (intake.md, 2026-11-10). Missing entries: **none**.

## 8. Suggested scenario areas (input for the scenario-designer)

| Area | REQ | Priority |
| --- | --- | --- |
| Valid login lands on `/profile` with user name shown | REQ-05 | High |
| Wrong password (real user, once per run), unknown user name (fake), empty and partial submit | REQ-05 | High |
| Session persists on reload; signed-in header on `/books`; Logout clears session and `/profile` shows the signed-out message | REQ-06 | High |
| Guest `/profile` message and links; guest detail has no Add button | REQ-07 | High |
| Add book: success alert, book in profile; duplicate add alert | REQ-08 | High |
| Delete book: Cancel keeps the row, OK removes it, persists after reload, empty table `Page 1 of 0` | REQ-09 | High |
| Book list content and disabled pagination | REQ-01 | Medium |
| Search: title/author/publisher, case-insensitive, partial, no match, clear, reset after reload; quirks (spaces, ISBN) flagged | REQ-02 | Medium |
| Detail fields for a known ISBN; Back To Book Store; unknown ISBN blank fields (flag) | REQ-04 | Medium |
| Register validation: empty submit, weak-password server message, Back to Login | REQ-10 | Medium |
| Responsive 375x812 on `/books` and `/login` | REQ-12 | Medium |
| Cross-browser execution per Q1 | REQ-13 | Medium |
| Sort Title/Author cycle, Image not sortable | REQ-03 | Low |
| Left-menu navigation, New User, Go To Book Store | REQ-11 | Low |

## User answers (2026-11-10)

| Question | Answer | Effect |
| --- | --- | --- |
| Q1 (Blocking): one shared account, serial runs? | **No: one account per browser.** `existingUser` = Chromium, `firefoxUser` = Firefox, `webkitUser` = WebKit; masked check OK and the three userNames are different. | Collection tests (add, duplicate add, delete) run on **all three browsers**, each on its own account. Tests that use the same browser's account must still run one at a time. |
| Q-NB6: accessibility | **Out of scope, confirmed by the user** ("no need"). | No accessibility scenarios. |
| Q-NB1 to Q-NB5, Q-NB7, Q-NB8 | Not answered; the stated defaults apply. | As written above. |
