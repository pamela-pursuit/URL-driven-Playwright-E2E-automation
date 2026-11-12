# demoqa-login-books - Requirements (log in, books while signed in, log out)

Website: https://demoqa.com/ (second flow; the guest book list and search flow is in test-plans/demoqa/).
Requested flow (user): "login, list and search books, log out".

## 1. Requirement Summary

| Ref | Requirement | Source |
|---|---|---|
| REQ-01 | Logging in with a saved account opens the Profile page, which shows the account's user name. | Confirmed (user, flow); Observed (discovery.md, Login and Profile pages) |
| REQ-02 | While signed in, the Book Store lists the 8 books and shows the user name and a "Log out" button instead of "Login". | Observed (discovery.md, Book Store while signed in) |
| REQ-03 | While signed in, search works as for guests: "Git" leaves only "Git Pocket Guide"; clearing the box shows all 8 books again. | Confirmed (user, flow); Observed (discovery.md, Book Store while signed in) |
| REQ-04 | Logging out returns to the Login page; the user name is no longer shown, and the Book Store shows "Login" again instead of "Log out". | Confirmed (user, flow); Observed (discovery.md, Log out) |

Every test case runs on Chromium, Firefox and WebKit (project rule).

## 2. Source notes

- Observed: the Profile page log-out button is named "Logout"; the Book Store one is named "Log out". Both lead to the Login page.
- Observed: after logging out, the Profile page shows the "not logged in" notice (exact text in discovery.md) instead of the user name.
- Assumed: Firefox and WebKit behave the same as Chromium (only Chromium was explored).
- Assumed: the 8 books and the search result for "Git" stay as observed (public site content, not under our control).

## 3. Missing Acceptance Criteria

- Messages for a wrong password, unknown user or empty fields: not observed.
- How long a sign-in lasts, and whether it survives a page reload or a new tab: not specified.
- Whether the Profile page should send a signed-out visitor to the Login page (observed: it does not; it shows a notice).
- Whether Back after logging out should show signed-in content: not specified.
- Expected loading time: not specified.

## 4. Ambiguities and Clarification Questions

| # | Question | Type | Assumption if not answered |
|---|---|---|---|
| Q1 | Should logging out be checked from both the Book Store ("Log out") and the Profile page ("Logout")? | Non-blocking | Check from the Book Store (the requested flow); Profile log out as a Medium case. |
| Q2 | Should the Profile page after log out (notice shown, user name gone) be checked? | Non-blocking | Yes, as part of REQ-04, using the observed notice text. |
| Q3 | Is a reload while signed in (still signed in) wanted? | Non-blocking | Not covered; behaviour not observed. |

No Blocking questions.

## 5. Testing Risks and Assumptions

- Shared public demo site: content and availability can change without notice.
- One saved account per browser (Chromium, Firefox, WebKit) so parallel runs do not sign each other out.
- The site loads slowly and shows adverts; waits must rely on page content, not fixed delays.
- Account values must never appear in test names, logs, screenshots, traces or reports; check the user name only as a match, not by printing it.
- Login fields are not linked to their labels; use the placeholders "UserName" and "Password".
- Firefox and WebKit not explored; differences will show up on the first run.

## 6. Out of Scope / Unsafe Actions

- Registration ("New User").
- Adding or removing books from the collection ("Delete All Books").
- Deleting the account ("Delete Account").
- Invalid-login tests (not requested).
- Anything that changes data on the site.

## 7. Credential Needs

App name in the credential file: `demoqa-books` (no values recorded here).

| Role | Browser | Fields |
|---|---|---|
| existingUser | Chromium | userName, password |
| firefoxUser | Firefox | userName, password |
| webkitUser | WebKit | userName, password |

Status: all three present per the masked `credentials.mjs check` recorded in intake.md. Missing: none.
