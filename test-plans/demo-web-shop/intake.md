# Intake: demo-web-shop

| Item | Value |
| --- | --- |
| Date | 2026-11-05 |
| URL | https://demowebshop.tricentis.com/ |
| App slug | `demo-web-shop` (user name: "DemoWebShop") |
| Environment | Public demo site operated by Tricentis (shared, not owned by us) |
| Flows requested | Not specified. Discover the main flows (agent decides, by risk) |
| Credential file | `credentials/credentials.xlsx` (git-ignored, local, OneDrive-synced) |

## Account roles (field names only, no values)

| Role | Fields | Status |
| --- | --- | --- |
| `existingUser` | `email`, `password` | Provided; `check` OK on 2026-11-05 |

## User decisions

- **New registration details: not provided.** Tests must **not** create
  accounts. Registration may be tested only in ways that cannot create an
  account (empty or invalid fields, mismatched confirm password, an email
  that already exists).
- ~~Payment and order placement are out of scope~~. Superseded by decision D3 below.

## Decisions after requirements analysis (user, 2026-11-05)

| ID | Question | Decision |
| --- | --- | --- |
| D1 | Use of existingUser's cart and wishlist | **Own items only.** Tests add and remove only the items they add, and clean up after each test. The pre-existing "14.1-inch Laptop" and anything else already in the account is never touched. Signed-in assertions check specific rows and count deltas, not absolute totals. |
| D2 | One account for three browsers | **Share it and run serially** (`workers: 1`, no parallel runs). Tests that mutate signed-in data run on Chromium only. Read-only signed-in tests and all guest flows run on Chromium, Firefox and WebKit. |
| D3 | How far checkout may go | **Place Cash On Delivery orders end to end** (user: "do cod, this is a demo website for testing purpose"; confirmed with "Place COD orders"). This includes saving a billing address to existingUser, choosing a shipping method and Cash On Delivery, clicking **Confirm**, verifying the confirmation, and checking the order in My account > Orders. Each run creates a permanent demo order. Never use any card or other real payment method. |
| D4 | Scope and priorities | **Default plan from requirements.md** (High: login, session, auth redirects, product page, cart, checkout. Medium: registration validation, search, listing, wishlist, account pages, mobile. Low: accessibility, report-only). |
| D5 | Conflict: nopCommerce checks out the whole cart, so a signed-in order would include the pre-existing Laptop | **Guest COD orders.** Place COD orders as a **guest** with fictional data (`qa.guest@example.test`, the "QA Automation" address). existingUser is never used for orders. **Signed-in checkout stops at the Billing step**, so nothing is saved to the account. This supersedes the signed-in part of D3. One guest COD order (#2411222) was placed during discovery on 2026-11-05. |
| D6 | Accessibility (WCAG target, R-31), asked 2026-11-10 | **Out of scope** (user: "this is a dummy website we do not need to test such things"). No WCAG target is set and accessibility findings are not logged as defects; DEF-009 to DEF-012 are Closed. Amends the "Low: accessibility, report-only" part of D4. |
| D7 | Browser compatibility (user, 2026-11-11: "websites should be compatible to any browser") | **Every scenario runs on Chromium, Firefox and WebKit.** Any site failure or behaviour difference on one browser is logged as a **Browser compatibility** defect, and the test keeps failing on that browser while it is open. The 7 former Chromium-only scenarios (TC-49 to 052, 057, 061, 066) now run on all three browsers: signed-in tests run serially with the D1 cleanup on each browser, and **each full run places 3 guest COD demo orders** (one per browser). **Exception:** TC-02 (wrong password) stays Chromium-only as a test-safety limit (one wrong attempt per run, lockout unknown); its cross-browser compatibility is reported as not verified. Supersedes the Chromium-only parts of D2 and D5. |

## Observed account forms (Phase 0 discovery, unauthenticated)

- **Login** (`/login`, POST): Email, Password, "Remember me?" checkbox, "Log in" button.
- **Register** (`/register`, POST): Gender radio (Male `M` / Female `F`),
  First name*, Last name*, Email*, Password*, Confirm password*, "Register"
  button. (* = required per `data-val-required`.)
- No admin or vendor login was observed.
