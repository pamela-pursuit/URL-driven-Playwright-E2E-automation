# Requirements: demo-web-shop

| Item | Value |
| --- | --- |
| App | `demo-web-shop`, `https://demowebshop.tricentis.com/` (public Tricentis demo on nopCommerce, shared with the world, not owned by us) |
| Date | 2026-11-05 |
| Inputs | `intake.md` (user decisions), `discovery.md` (observations, sections 1 to 7) |
| User stories / acceptance criteria | None supplied. No flows named. |

Source labels used below:

- **Confirmed (user)**: a user decision recorded in `intake.md`.
- **Observed (D x.y)**: seen during discovery, `discovery.md` section x.y.
- **Assumed**: not specified and not observed. Must not be asserted as a hard rule without confirmation. Record it as a gap if behaviour differs.

## 1. Requirement Summary

The priority is set by business risk (see `.claude/skills/qa-playwright/test-design.md`). "Proposed" means the agent chose the scope, because the user named no flows (Confirmed (user): "agent decides, by risk").

| REQ | Flow | Priority | In scope |
| --- | --- | --- | --- |
| REQ-01 | Login: valid sign-in, wrong password, unknown email, empty submit, malformed email | High | Yes |
| REQ-02 | Session and logout: session survives reload, logout restores guest header, back navigation after logout shows no signed-in content | High | Yes |
| REQ-03 | Protected routes: guest access to `/customer/*` redirects to `/login?ReturnUrl=...`. Return after login is unobserved | High | Yes |
| REQ-04 | Registration **validation only**: required fields, email format, password length, confirm mismatch, duplicate email (existingUser). Never a successful registration | Medium | Yes (restricted) |
| REQ-05 | Search: results, no results, minimum length, empty-term alert, autocomplete | Medium | Yes |
| REQ-06 | Category listing: sort, page size, view mode, price filter and remove filter, paging | Medium | Yes |
| REQ-07 | Product detail: add to cart, add to wishlist, quantity validation (0, non-numeric), configurable-product redirect from home | High | Yes |
| REQ-08 | Cart (guest): quantity update and totals, remove, empty state, terms-of-service gate, invalid coupon and gift card, estimate shipping | High | Yes |
| REQ-09 | Cart (signed in): persistence across logout and login, guest-cart merge on login, signed-in terms gate | High | Yes (depends on Q1, Q2) |
| REQ-10 | Wishlist (guest and signed in): add, view, remove, share URL shown | Medium | Yes (signed-in part depends on Q1) |
| REQ-11 | Checkout up to the Billing step: guest path via "Checkout as Guest", signed-in direct path, step list, billing prefill, billing required-field and email validation | High | Yes, stop at Billing (see Q3) |
| REQ-12 | My account pages, read only: Customer info, Addresses, Orders, Reward points, Back in stock, Change password (labels only), account navigation | Medium | Yes (no form submission) |
| REQ-13 | Responsive / mobile (375x812): category menu toggle, no horizontal scroll, header links visible | Medium | Yes |
| REQ-14 | Basic accessibility: record known gaps (no `lang`, no home `h1`, unnamed controls), check landmarks and headings on key pages | Low | Yes (report gaps, do not fail CI on known gaps without agreement) |
| REQ-15 | Cross-browser: REQ-01 to REQ-13 on Chromium, Firefox and WebKit | Medium | Yes (execution model depends on Q2) |

## 2. Source of each requirement

### REQ-01 Login

- The form has Email, Password, "Remember me?", "Log in", and "Forgot password?". **Observed (D 4.1)**
- Valid existingUser credentials lead to `/`. The header shows the account link and "Log out", and hides "Log in" and "Register". **Observed (D 4.1, 4.11)**
- Wrong password for a known email gives "Login was unsuccessful. Please correct the errors and try again." and "The credentials provided are incorrect". **Observed (D 4.1)**
- An unknown email, or an empty submit, gives the same summary plus "No customer account found". **Observed (D 4.1)**
- A malformed email gives the client-side message "Please enter a valid email address." **Observed (D 4.1)**
- The different messages for unknown and known emails allow account enumeration. Whether that is intended is **Assumed** to be accepted product behaviour. Test the observed text only. See Q-NB2.
- Lockout or rate limiting after failed logins: not observed after 4 failures. **Unknown** (D 7).

### REQ-02 Session and logout

- Reload keeps the session. **Observed (D 4.11)**
- `/login` renders while signed in, with no redirect. **Observed (D 4.11)**
- Logout lands on `/` with the guest header, and the guest cart is empty. **Observed (D 4.11)**
- Back navigation after logout shows no signed-in content. **Observed (D 4.11)**
- "Remember me?" persistence and session timeout: **not observed (D 7)**. Out of scope until specified.

### REQ-03 Protected routes

- Guests visiting `/customer/info|orders|addresses|changepassword|downloadableproducts|rewardpoints` are redirected to `/login?ReturnUrl=%2fcustomer%2f<page>`. **Observed (D 3)**
- `/customer/backinstocksubscriptions` renders for guests with no redirect. **Observed (D 3)**. Whether that is intended is **Assumed** acceptable. Test as observed and flag it.
- Signing in from a ReturnUrl brings the user back to the requested page: **Assumed** (D 7, not probed). Treat it as a candidate. Assert it only after a first run confirms it.

### REQ-04 Registration validation

- New accounts must never be created. **Confirmed (user)**
- Required messages, "Wrong email", the minimum length of 6 ("The password should have at least 6 characters."), and the confirm-mismatch message all come from client-side validation. **Observed (D 4.2)**
- The existingUser email gives "The specified email already exists". **Observed (D 4.2, p7)**. This submits a valid form. The server rejects it, so no account is created.
- There is no `maxlength` on any field. The data-val maximum for the password is 999. **Observed (D 4.2)**. No other limits are known.

### REQ-05 Search

- `computer` gives 4 named results. **Observed (D 4.3)**. Counts on shared data may change, so assert names or a non-zero count rather than exactly 4. **Assumed** stable enough.
- No results: "No products were found that matched your criteria." **Observed**
- A term shorter than 3 characters: "Search term minimum length is 3 characters". **Observed**
- An empty term, or the default "Search store": native alert "Please enter some search keyword". **Observed**
- Autocomplete suggestions for `comp`. **Observed**
- Advanced search results: **not observed (D 7)**. Low priority.

### REQ-06 Category listing (`/books`)

- Sort options and URL params, page sizes 4/8/12 (default 8), Grid/List view, three price-filter links, "Remove Filter", and paging with `pagenumber`. **Observed (D 4.4)**
- Observed orderings (Price Low to High, Name Z to A) and the "Under 25.00" result (5 products) are **Observed**. They depend on shared catalogue data. **Assumed** to be stable. Assert relative order and the price range rather than fixed lists where possible.

### REQ-07 Product detail

- Add to cart gives the success bar "The product has been added to your shopping cart", and the header count increases. **Observed (D 4.5)**
- Add to wishlist (only on some products, e.g. `/health`) gives "The product has been added to your wishlist". **Observed (D 4.5)**
- Qty `0` or `abc` gives the error bar "Quantity should be positive", and the cart is unchanged. **Observed (D 4.5)**
- The maximum order quantity is unknown. **Not observed**
- Negative quantity on the product page: **not observed**.
- Home "Add to cart" for "Build your own computer" navigates to its product page. **Observed (D 4.5)**
- Configurable-product attribute validation: **not observed (D 7)**.

### REQ-08 Cart (guest)

- Columns, totals block, Update, Continue shopping, coupon, gift card, estimate shipping, terms checkbox, and Checkout. **Observed (D 4.6)**
- Qty 3 + Update gives a row total of 30.00 and the header "(3)". **Observed**
- Qty 0 or -1 + Update removes the row with no message. **Observed**. Whether this is intended is **Assumed** acceptable. See Q-NB2.
- Checkout without ticking terms opens the dialog "Please accept the terms of service before the next step.". **Observed**
- An invalid coupon **and** an invalid gift card both give "The coupon code you entered couldn't be applied to your order". **Observed**. The shared text for gift cards may be a defect. Record it, do not "fix" it in the assertion.
- Estimate shipping lists 4 options at 0.00, with or without a country. **Observed**
- Valid coupon or gift card codes: none known (D 7). Positive discount tests are out of scope.

### REQ-09 Cart (signed in)

- The account cart persists across logout and login. **Observed (D 4.11, a1 to a2)**
- The guest cart merges into the account cart on login. **Observed (D 4.11, a3)**
- Before any test ran, the account cart already held "14.1-inch Laptop" qty 1. **Observed (D 4.11)**
- With terms ticked, a signed-in Checkout goes straight to `/onepagecheckout`. **Observed (D 4.11)**
- Merge rule when the same product is in both carts (quantities added together or replaced): **not observed**. **Assumed** unknown. Avoid it, or ask.

### REQ-10 Wishlist

- Empty state "The wishlist is empty!". Add, view and remove via "Update wishlist". The share URL is shown (http scheme). **Observed (D 4.7, 4.11)**
- Wishlist "Add to cart" (moving an item to the cart) and wishlist persistence across sessions: **not observed**. **Assumed** to behave like the cart. Candidate only.

### REQ-11 Checkout to Billing

- Checkout may go up to, but not including, final order confirmation. No payment is submitted. **Confirmed (user)**
- Guest path: cart, then `/login/checkoutasguest` ("Checkout as Guest"), then `/onepagecheckout`. **Observed (D 4.6, 4.8)**
- The 6 step titles, 12 billing fields, and required markers are **Observed (D 4.8)**.
- An empty Continue shows 8 required messages (4 with no trailing period). Email `not-an-email` gives "Wrong email". **Observed (D 4.8)**
- Signed in: the new-address form appears directly, prefilled with First name, Last name and Email. Country defaults to "Select country". **Observed (D 4.11)**
- Continuing past Billing (signed in) saves an address to the account. **Observed (D 4.11, inferred by discovery)**. Steps after Billing are **not observed (D 7)**.
- Direct `/onepagecheckout` as a guest with an empty cart redirects to `/cart`. **Observed (D 3)**

### REQ-12 Account pages (read only)

- Headings, empty states ("No addresses", "No orders", reward balance 0, back-in-stock none), and the 7 account-navigation links. **Observed (D 4.11)**
- The empty states hold only while the account stays unchanged. **Assumed** (shared account).
- `/customer/downloadableproducts` did not render within 45 s. **Observed (D 3, 4.11)**. This is a possible defect. Do not include it in the CI-gating suite. See risks.
- Change-password labels and data-val messages. **Observed (D 4.11)**. They were not triggered. Submitting the form is out of scope (it would change the password).

### REQ-13 Responsive

- At 375x812, the desktop top menu is hidden and `#mob-menu-button` opens `.mob-top-menu` with 7 categories. There is no horizontal scroll, and the header links and search stay visible. **Observed (D 4.9)**
- Tablet and other breakpoints: **not observed**. No requirement exists.

### REQ-14 Accessibility

- The known gaps in D 4.10 are **Observed**.
- No WCAG level is specified. **Assumed**: report only, non-gating, until the user sets a target.

### REQ-15 Cross-browser

- `playwright.config.ts` defines the chromium, firefox and webkit projects, `workers: 1`, `fullyParallel: false`, and `retries: 2` in CI. **Observed (repository)**
- Firefox and WebKit behaviour: **not observed (D 7)**. **Assumed** to match Chromium.

## 3. Missing Acceptance Criteria

Nobody has specified the following. Tests will assert observed behaviour only, and will record any difference as a gap.

1. **Authentication:** lockout or throttling threshold after failed logins; session timeout; "Remember me" duration; whether `/login` should redirect a signed-in user; whether ReturnUrl is honoured after login.
2. **Account enumeration:** whether different messages for unknown and known emails are acceptable.
3. **Registration:** maximum field lengths, password complexity beyond 6 characters, and email uniqueness case-sensitivity.
4. **Quantities:** the maximum order quantity per line; whether 0 or negative values in the cart should remove the line or show a validation message (today they remove it silently); decimal quantities.
5. **Cart merge:** the rule when the same product exists in both the guest cart and the account cart.
6. **Coupons and gift cards:** the expected message for an invalid gift card (today it reuses the coupon text); whether valid test codes exist.
7. **Shipping and tax:** all shipping options show 0.00 and tax 0.00. It is unknown whether that is the intended demo configuration.
8. **Checkout:** the behaviour and validation of steps after Billing; whether guest billing data is stored server-side.
9. **Wishlist:** whether the share URL should use https; wishlist persistence and merge on login.
10. **Search:** whether the minimum length of 3 applies to the header and the page alike (observed for both); the result ordering rule.
11. **Account pages:** the expected load time and content of Downloadable products.
12. **Non-functional:** a target accessibility level (e.g. WCAG 2.1 AA), supported viewports, and performance budgets.

## 4. Ambiguities and Clarification Questions

At most four, each with a recommended default so the orchestrator can ask in one batch.

| ID | Question | Type | Affects | Recommended default |
| --- | --- | --- | --- | --- |
| Q1 | May tests add and remove items in existingUser's **cart and wishlist**? What should happen to the pre-existing "14.1-inch Laptop" in the account cart: leave it, or clear the cart before each test? | **Blocking** | REQ-07 (signed in), REQ-09, REQ-10, REQ-11 (signed in) | Yes, tests may add and remove **only items they added themselves**, with cleanup in `afterEach`. **Never remove the Laptop** or any other pre-existing item. Assertions are row-specific and use relative counts (count before + n), never absolute header counts or "cart is empty" for the signed-in cart. |
| Q2 | All three browsers would use **one shared account**. Do you accept strictly serial execution (current `workers: 1`, no parallel CI shards, no two people running the suite at once)? Or will you add one account per browser (e.g. `existingUserFirefox`, `existingUserWebkit`)? | **Blocking** | REQ-09, REQ-10, REQ-11, REQ-15 | Share the one account and keep the run serial (`workers: 1`, `fullyParallel: false`). Run signed-in **state-changing** tests (cart persistence, merge, signed-in wishlist) on **Chromium only**, and run read-only signed-in tests on all three browsers. Guest flows run on all three browsers. |
| Q3 | Checkout depth: is **saving one billing address** to existingUser acceptable, so signed-in checkout can reach Payment Information (never Confirm)? And may **guest** checkout continue past Billing with fictional data (`example.test` email, made-up address)? | **Blocking** | REQ-11 | **No** for both. Stop at the Billing step for guest and signed-in (validation, prefill, step list). This keeps the account and the shared demo free of saved data. Later steps stay in the "Not covered" list. |
| Q4 | Any flows you want prioritised, or excluded? | Non-blocking | All | Use the scope and priorities in section 1. Exclude Downloadable products from CI gating (it does not load). Treat accessibility as report-only. |

Non-blocking items, which proceed with a recorded assumption and are not asked unless the user wants them:

- **Q-NB1:** Lockout threshold. Assumption: unknown. Limit tests to **one** wrong-password attempt for the existingUser email per run. Use an unknown `example.test` email for other negative login tests.
- **Q-NB2:** Silent row removal for qty 0/-1, shared coupon/gift-card text, `/backinstocksubscriptions` open to guests, http share URL, and email enumeration. Assumption: assert the current behaviour and flag each as a "possible defect" in the report.
- **Q-NB3:** Cart merge with a duplicate product. Assumption: avoid the case (use a product that is not already in the account cart).

## 5. Testing Risks and Assumptions

| Risk | Impact | Mitigation (proposed) |
| --- | --- | --- |
| **Shared account state.** The existingUser cart persists and already holds an item the tests did not add. Guest carts merge into it on login | Flaky counts. Leftovers from failed runs pollute later runs. Tests can remove the user's own data | Q1 default: own-items-only cleanup in `afterEach` (also on failure). Relative assertions. A pre-test step that removes only known test products left over from earlier runs |
| **One account across 3 browsers, plus CI retries (`retries: 2`)** | Parallel or overlapping runs (other machines, CI shards, retries after partial adds) corrupt each other's cart | Q2 default: serial execution, Chromium-only for signed-in writes, idempotent setup and cleanup |
| **Public shared demo** | Other users change the catalogue, carts, search results, and possibly the account itself. The site can be slow or down | Assert stable properties (ordering, ranges, names), not totals across the catalogue. Health-check the base URL before the suite. Record outages as environment failures, not defects |
| **Third-party `addthis` script fails** (DNS) and stalls the `load` event on product pages | `goto` timeouts (30 s) | Use `waitUntil: 'domcontentloaded'` for navigation, or block `s7.addthis.com` with `page.route`. Wait for specific elements |
| **`/customer/downloadableproducts` never renders** | A timeout in any test that visits it | Exclude it from gating. Keep one tagged known-issue test, or record it as a gap |
| **Account lockout unknown** | Repeated wrong-password tests might lock the only account and block the whole signed-in suite | One wrong-password attempt per run (Q-NB1). Log in through a stored `storageState` where possible, to reduce the number of logins |
| **No test IDs. Unnamed controls** (search box, listing selects, cart qty, remove, terms, coupon) | Fallback to id or name CSS locators, which are more brittle | Use the verified locators in D 5. Scope by rows and containers. Record a11y gaps |
| **Native `alert()`** for an empty search, a popup window for terms "(read)", and a jQuery UI dialog | Unhandled dialogs hang tests | Register a `page.once('dialog')` handler. Do not open the terms popup |
| **Firefox and WebKit unverified** | Unknown selector or timing differences | First run is exploratory. Investigate failures before writing them off as flaky |
| **Data-dependent expectations** (4 search results for "computer", 6 books, prices) | Break if the demo catalogue changes | Prefer containment and order checks over exact counts |
| **Session/cookie leakage between tests** | Guest tests could inherit a signed-in state | A fresh context per test (Playwright default). Signed-in tests use their own fixture |

Assumptions recorded:

- A1: The demo catalogue (Books category, `/health`, `/computing-and-internet`) stays available.
- A2: The existingUser account keeps no addresses and no orders unless we change it.
- A3: Firefox and WebKit render the same markup as Chromium.
- A4: No CAPTCHA appears on login or registration (none observed). If one appears, the tests stop and report it rather than bypass it.

## 6. Out of Scope / Unsafe Actions

Never automated against this real, shared system:

- Placing an order, "Confirm" in checkout, and any payment entry or submission. **Confirmed (user)**
- Successful registration or any account creation. **Confirmed (user)**
- Saving a billing or shipping address, or advancing signed-in checkout past Billing (pending Q3; default is excluded).
- Submitting Customer info "Save", Addresses "Add new", or "Change password" (they change the only account).
- Forgot-password submission, "Email a friend", Contact us, newsletter subscribe, poll vote, and product reviews (they send email or change shared data).
- Removing items from the account cart or wishlist that the tests did not add (pending Q1).
- Brute-force or lockout testing on existingUser.
- Off-origin links (social, nopcommerce.com).
- Load or performance testing against the public demo.

## 7. Credential Needs

| Role | Fields | Needed for | Status |
| --- | --- | --- | --- |
| `existingUser` | `email`, `password` | REQ-01, 02, 03 (return after login), 04 (duplicate email), 09, 10, 11 (signed in), 12 | Present: `check` OK and login verified on 2026-11-05 (intake.md, D 4.11) |
| `newUser` | none | Not needed: registration must not create accounts | Not requested (Confirmed (user)) |
| `existingUserFirefox`, `existingUserWebkit` (optional) | `email`, `password` | Only if the answer to Q2 is "one account per browser" | Not provided. Not required under the default |

Check command for the orchestrator (masked output):

```powershell
node scripts/credentials.mjs check --app demo-web-shop --require existingUser:email,password
```

The analyst had no shell access in this step, so the command was not re-run here. The last recorded result is OK (intake.md, 2026-11-05). Missing entries under the default plan: **none**.

## 8. User decisions (2026-11-05). These override the recommendations above

Recorded in `intake.md` (D1 to D4). Status: **Confirmed (user)**.

- **Q1 → D1, own items only.** Tests add and remove only their own items in existingUser's cart and wishlist, with cleanup after each test. The pre-existing "14.1-inch Laptop" is never touched. Signed-in assertions are row-specific and count-relative.
- **Q2 → D2, share one account and run serially.** `workers: 1`, no parallel runs. State-changing signed-in tests run on Chromium only. Read-only signed-in tests and guest flows run on all three browsers.
- **Q3 → D3, place Cash On Delivery orders end to end (supersedes the "stop at Billing" default).** The user chose "Place COD orders" because the site is a demo for testing. **REQ-11 is extended and REQ-16 is added:**
  - **REQ-16 (High): Signed-in checkout with Cash On Delivery, end to end.** Billing address (select a saved one, or create one; saving an address to existingUser is allowed), Shipping address, Shipping method, Payment method **Cash On Delivery (COD)**, Payment information, **Confirm Order**, confirmation page (order number shown), and the order visible in My account > Orders with its details. Each run creates a permanent demo order. This is accepted. Never select any card or other real payment method. The behaviour of the steps after Billing is **Not yet observed**. The application-explorer must observe one full COD order before scenarios assert on it.
  - **Guest checkout (REQ-11):** Assumed. Guest checkout may continue through the steps with fictional data (`example.test` email, made-up address) up to the Confirm Order summary, but does **not** place guest orders. The user approved order placement for the account flow only. This is recorded as assumption **A-COD-GUEST**.
- **Q4 → D4, default plan.** Priorities as in section 1. Accessibility is report-only.
- **D6 (2026-11-10) amends D4.** Accessibility is out of scope for this demo site: no WCAG target (R-31 closed), and accessibility findings are not logged as defects (DEF-009 to DEF-012 Closed). REQ-14 has no scenarios: TC-68 to TC-70 were removed at the user's request.
- **Credentials re-checked** on 2026-11-05 after the analysis: `existingUser has email, password`: **OK**.
- **D5 (2026-11-05) amends REQ-16 and REQ-11.** Because the site checks out the whole cart, including the pre-existing Laptop, **COD orders are placed as a guest** (fictional data) end to end: Confirm, completion page "Thank you" / "Your order has been successfully processed!", order number, and guest order details (`/orderdetails/<id>`, "Order Status: Pending"). Signed-in checkout stops at Billing, and no address is saved to existingUser. Assumption A-COD-GUEST is replaced: guest orders **are** placed. Each run creates a permanent demo order on the public site, and the user accepts this. Observed in discovery.md section 4.12.
