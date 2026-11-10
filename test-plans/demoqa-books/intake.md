# Intake: demoqa-books

| Item | Value |
| --- | --- |
| Date | 2026-11-10 |
| URL given by the user | https://demoqa.com/books |
| Base URL | https://demoqa.com |
| App slug | `demoqa-books` (renamed from `demoqa` at the user's request, 2026-11-10) |
| Flows requested | None named. Scope assumed from the URL: the **Book Store Application** (`/books`, `/login`, `/register`, `/profile`, book details). The other demoqa sections (Elements, Forms, Alerts/Frames, Widgets, Interactions) are out of scope unless the user adds them. |
| Credential file | `credentials/credentials.xlsx` (git-ignored; shared with demo-web-shop) |
| Account roles | `existingUser`: `userName`, `password` (masked check OK on 2026-11-10) |
| Registration | Not selected. No account is created by the tests. The register page has a reCAPTCHA. |

## Phase 0 observations (discovery script, read-only)

- `/login`: h1 "Login"; form `#userForm` with UserName (`#userName`, placeholder "UserName") and Password (`#password`, placeholder "Password"); buttons "Login" and "New User". No visible labels (placeholders only).
- `/register`: h1 "Register"; First Name (`#firstname`), Last Name (`#lastname`), UserName (`#userName`), Password (`#password`, pattern: 8+ characters with lowercase, uppercase, digit and special character); buttons "Register" and "Back to Login"; Google reCAPTCHA iframe present.
- Third-party ad and tracking iframes load on these pages (Criteo, OpenX, DoubleClick).
- Raw output: `artifacts/demoqa-books/discovery/discovery-books-crawl.json`, `discovery-login.json`, `discovery-register.json` (git-ignored).

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| I1 | Accounts | Existing login account only (user, 2026-11-10). |
| I2 | One account per browser (Q1) | User chose to provide more accounts (2026-11-10): `existingUser` for Chromium, `firefoxUser` for Firefox, `webkitUser` for WebKit (fields `userName`, `password`). Collection tests can then run on all three browsers, each on its own account. Masked check OK for all three; the three userNames are different (checked without printing them). |
| I3 | Accessibility | **Out of scope, confirmed by the user** (2026-11-10: "no need"); same as D6 on demo-web-shop. |
