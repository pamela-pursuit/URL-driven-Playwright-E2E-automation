# demoqa-login-books - Discovery (log in, books while signed in, log out)

- URL tested: https://demoqa.com/login (crawl started at https://demoqa.com/); timestamp 2026-11-12
- Browser: Chromium (Playwright, headless), default viewport
- Boundary: https://demoqa.com, pages `/login`, `/profile`, `/books`
- Environment guess (unconfirmed): public demo site
- Account: role `existingUser` under app name `demoqa-books`, loaded through the repository loader; no values recorded
- Guest book list and search facts: see test-plans/demoqa/discovery.md (reused, not re-probed as guest)

## Route map (observed)

| Page | URL | Purpose |
|---|---|---|
| Login | https://demoqa.com/login | Sign in form |
| Profile | https://demoqa.com/profile | Signed-in user and their collection; "not logged in" notice for guests |
| Book Store | https://demoqa.com/books | Book list and search |

## Login page

- Headings: h1 "Login", h2 "Welcome,", h5 "Login in Book Store"
- Fields (both `required`, no aria-label, labels not linked to inputs):
  - id `userName`, type text, placeholder "UserName", visible label "UserName :"
  - id `password`, type password, placeholder "Password", visible label "Password :"
- Buttons: "Login" (id `login`), "New User" (id `newUser`, not used)
- Filling: the inputs are React-controlled; values were set through the native value setter plus an input event (accepted by the app)
- After a valid login: URL becomes https://demoqa.com/profile; a GET to `/Account/v1/User/` returned 200 while the Profile page loaded

## Profile page (signed in)

- Shows "User Name :" followed by `#userName-value`; its text equalled the account userName (checked as true/false only)
- Button "Logout" (id `submit`, accessible name exactly "Logout")
- Other buttons seen but out of scope (not clicked): "Go To Book Store", "Delete Account", "Delete All Books"

## Book Store while signed in

- URL https://demoqa.com/books; 8 book title links, same as for guests
- "Type to search" with "Git" leaves only "Git Pocket Guide"; clearing the box returns 8 books (same as guest)
- Differences from guest: "User Name :" label and `#userName-value` shown (equals the account userName: true); a "Log out" button (accessible name exactly "Log out", id `submit`) instead of the "Login" button
- After logging out, the Book Store shows a "Login" button again and no "Log out" button

## Log out

- From Book Store: "Log out" -> https://demoqa.com/login
- From Profile: "Logout" -> https://demoqa.com/login
- On the login page afterwards: "Login" button visible, UserName field visible and empty, user name not shown on the page
- Profile after logout (https://demoqa.com/profile, no redirect): `#userName-value` absent; text shown exactly:
  "Currently you are not logged into the Book Store application, please visit the login page to enter or register page to register yourself."
  ("login" links to `/login`, "register" links to `/register`; notice id `notLoggin-label`)

## Locator candidates

| Element | Candidate (in preferred order) |
|---|---|
| Login heading | `getByRole('heading', { name: 'Login', level: 1 })` |
| User name input | `getByPlaceholder('UserName')`; fallback `#userName` (label not associated) |
| Password input | `getByPlaceholder('Password')`; fallback `#password` |
| Login button | `getByRole('button', { name: 'Login' })` |
| Signed-in user name | `#userName-value` (no role or accessible name; narrow id) |
| Log out (Book Store) | `getByRole('button', { name: 'Log out' })` |
| Log out (Profile) | `getByRole('button', { name: 'Logout', exact: true })` |
| Not-logged-in notice | `getByText('Currently you are not logged into the Book Store application')`; fallback `#notLoggin-label` |
| Search box | `getByPlaceholder('Type to search')` |
| Book title | `getByRole('link', { name: 'Git Pocket Guide', exact: true })` |

Note: the two log-out buttons have different names ("Log out" vs "Logout") and both share id `submit` (also used by Delete buttons), so the id is not a safe locator.

## Console errors / failed requests

- Not captured in these probes.

## Not observed

- Invalid or empty login messages (not probed in this time-boxed run)
- Session expiry / token lifetime
- Registration, adding or removing books, deleting the account: Not observed: requires changing data (out of scope)
- Firefox and WebKit behaviour
