# Changelog

## 2026-11-10

### Added

- Kept HTML reports: after every run, `lib/artifact-reporter.ts` saves the
  full Playwright HTML report as `artifacts/<app>/html-reports/<runId>.zip`.
  Pruning (`E2E_KEEP_RUNS`) only deletes run folders, so the zips are kept;
  `E2E_ARCHIVE_REPORTS=0` turns it off. `jszip` is now a direct dev
  dependency. The 19 existing demo-web-shop reports were archived too.
- User manual: section 6.1 (which agents and skill guides run each step)
  and kept HTML reports in 7.2, 12 and 13; README and `reporting.md` updated.

- `@axe-core/playwright` dev dependency and an automated, report-only axe
  scan for demo-web-shop (DWS-070, Chromium only): Home, Login, Books
  listing, a product page and the cart. Violations are recorded as
  `a11y-axe` annotations with the full results attached as JSON; they do not
  fail CI until a WCAG target is agreed (R-31).
- A defect log: `defects` in `scenarios.json` and a "Defects" sheet (third
  tab) with severity, status, steps to reproduce, expected vs actual, the
  basis for the expected result, evidence links and next action. `validate`
  checks required fields, severity and status values, and risk and scenario
  references. The Delivery Report dashboard shows a defect count.
- demo-web-shop defects DEF-001 to DEF-004 (from R-13, R-14, R-15, R-12),
  status New, and DEF-005 to DEF-013, status Needs confirmation: R-05,
  R-11, R-21, R-36, and the accessibility findings from DWS-068 to DWS-070
  (pending a WCAG target, R-31).
- Re-checks: DEF-005 reproduced (status New); DEF-003 lowered to Low (http
  redirects 301 to https, no HSTS); DEF-013 Rejected (Email has autofocus).

### Changed

- demo-web-shop tests behind open defects now check the correct behaviour
  and fail while the defect is open (user decision): DWS-003, 014, 042,
  045, 047, 055, 056, and DWS-066 newly automated (Chromium only). 22 of
  185 tests fail by design. Defects get a `failingScenario`; the Defects
  sheet shows a "Test Result" column, and the Not Executed sheet labels
  these failures "Known defect DEF-xxx" instead of "Investigate".
- DEF-001 Rejected and R-13 closed (raised by the user): the estimate used
  "Computing and Internet", which has free shipping, while checkout used
  Health Book; for the same product they agree. DWS-047 asserts the 0.00
  options again and passes. A full run now has 19 failures by design.

### Removed

- demo-web-shop accessibility testing (user decision D6: out of scope for
  the demo site): `accessibility.spec.ts` (DWS-068 to DWS-070), the
  `@axe-core/playwright` dependency, `reportOnly`, the keyboard sign-in
  mode and its login-page helpers, and two home-page locators. The
  catalogue has 67 scenarios; a full run executes 184 tests. The
  axe scan entry under "Added" above was superseded the same day.

### Fixed

- DWS-068 (since removed): `tabToEmail` returns 0 when the Email field already has focus
  after load, instead of Tabbing through the page. Headless Firefox left the
  page for the browser UI and the test reported a false accessibility gap.

### Changed

- Improved the Not Executed workbook reasons with readable labeled lines for
  coverage decisions, automation blockers, and execution failures.

## 2026-11-06

### Added

- A scenario review gate. After designing scenarios, the agent shows them
  (`workbook.mjs review`), asks you to approve, add, or change them, and asks
  whether to add more. It records approval (`workbook.mjs approve`, with a
  fingerprint per scenario) and does not implement before approval. `review`
  exits with 3 and `validate` warns when scenarios change after approval.
- A run confirmation before every test run, including re-runs: what will
  run, its side effects, and options to run all, add scenarios first, run a
  subset, or not now.
- A re-entry menu when `/e2e-agent` is used on an app that already has a
  suite.
- README section "How the agent works (flow and steps)".

- A "Delivery Report" sheet, the first sheet of each app's workbook. It holds
  a live summary dashboard (verdict, scenarios, results per browser with
  out-of-scope counts, latest run, open risks) and the delivery-report.md
  rendered as formatted sections and tables. It is rebuilt by
  `workbook.mjs build`.

- A "Not Executed" workbook sheet, the second tab (it replaces "Scope & Exclusions"). The
  Delivery Report sheet also gets a "Not executed and why" section under its summary. It
  shows why N of M scenarios run, the scenarios x browsers arithmetic down to
  the executed count, per-browser counts, problems in the latest results,
  and one row per scenario/browser that is not automated, out of scope by
  design, failed, flaky, or not run, with reason, coverage elsewhere and
  action.

### Changed

- The delivery report is no longer kept as `test-plans/<app>/delivery-report.md`.
  Its text is stored in `scenarios.json` (`deliveryReport`) with
  `workbook.mjs report --from <draft.md>`, read back with `report --print`,
  and shown only as the workbook's "Delivery Report" sheet. Drafts go to the
  git-ignored `artifacts/<app>/`.

- Execution scope reporting, so reports say why N of M scenarios run and why
  browser counts differ:
  - a `scopeReason` field, required by `validate` for any browser-limited
    scenario, and `failureNotes` required for Manual and Not Automatable
    scenarios
  - a "Scope & Exclusions" workbook sheet, an "Execution scope" block, and an
    "Out of scope (by design)" column in the per-browser table
  - `node scripts/workbook.mjs scope --app <app>` prints the explanation as
    Markdown
  - each run's `summary.md` lists skipped tests grouped by reason
- The delivery reporter, executor, scenario designer, Excel analyst and
  orchestrator must include this explanation in their reports.

## 2026-11-05

### Added

- Credential store: accounts per app and role are read from a git-ignored
  JSON or Excel file (`credentials/`, `CREDENTIALS_FILE`, or
  `CREDENTIALS_JSON`). Supports `{timestamp}` and `{random}` placeholders and
  `E2E_<APP>_<ROLE>_<FIELD>` overrides (`test-data/credentials-store.cjs`).
- `scripts/credentials.mjs` for masked checks and JSON/XLSX templates in
  `test-data/templates/`.
- `.claude/settings.json` deny rules that keep Claude from reading or
  editing the credentials folder.
- `-AccountsFile` option on `scripts/run-e2e.ps1`.
- URL-driven E2E automation agent: `/e2e-agent` orchestrator skill and ten
  Claude Code subagents under `.claude/agents/`.
- `scripts/explore-app.mjs` for read-only application discovery.
- `scripts/workbook.mjs` to validate the scenario catalogue, merge Playwright
  results, and build the five-sheet Excel workbook (exceljs).
- `scripts/run-e2e.ps1`, a generic cross-browser runner with hidden secret
  prompts and automatic workbook refresh.
- Playwright JSON reporter output at `artifacts/<suite>/results.json`.

### Changed

- E2E subagents now use the credential file instead of environment-variable
  prompts.
- `baseURL` now comes only from `BASE_URL` (set by `run-e2e.ps1`).
- README, guides, and `.env.example` now describe the agent workflow instead
  of individual suites.

### Added (artifacts)

- Each test run is saved in its own folder,
  `artifacts/<app>/runs/<timestamp>/`, holding `summary.md`, readable
  screenshots per browser (`screenshots/<browser>/<ID>_<title>_<status>_<n>.png`),
  the HTML report, raw `test-results/`, and `results.json`.
  `artifacts/<app>/latest.json` points to the newest run, and older runs
  beyond `E2E_KEEP_RUNS` (default 20) are pruned (`lib/artifact-reporter.ts`).
- Traces are kept on every failure (`retain-on-failure`).
- The workbook's Execution Results sheet links each result to its screenshot
  and run summary.

### Added (intake)

- `/e2e-agent` Phase 0 intake: it asks for the URL, discovers the login and
  registration fields, asks which accounts and which format (Excel or JSON),
  generates the credential file for the user to fill in, and verifies it.
- `scripts/credentials.mjs init`: creates or extends the credential file
  with blank, highlighted fields and per-role notes, never changing
  existing values.
- Discovery records required-field hints and radio/checkbox values.

### Changed (structure)

- Moved the credential loader to `lib/` and the credential templates to
  `templates/`. `test-data/` now holds only per-app test data.
- Added placeholder folders (`pages/`, `tests/`, `fixtures/`, `test-data/`,
  `test-plans/`) and documented the project structure in the README.

### Removed

- Rahul Shetty and Tricentis Demo Web Shop test suites, page objects, and
  their dedicated runners (`run-checkout-tests.ps1`,
  `run-demo-web-shop-tests.ps1`, `run-demo-web-shop-error-test.ps1`), to
  start fresh with agent-generated suites.

## 2026-11-04

### Changed

- Enhanced the QA Playwright agent with a URL-driven autonomous workflow.
- Added live-page inspection, locator discovery, root-cause repair, and
  cross-browser validation guidance.
- Added safety boundaries for credentials, destructive actions, and external
  side effects.

## 2026-11-04

### Added

- Chromium, Firefox, and WebKit projects for cross-browser Playwright runs.
- Browser-specific npm commands and an all-browsers command.
- Setup and execution documentation for browser coverage.

## 2026-11-03

### Added

- Playwright TypeScript automation for the Rahul Shetty ProtoCommerce demo.
- Playwright TypeScript automation for the Tricentis Demo Web Shop.
- Page Object Model classes grouped by application.
- Positive registration and login scenarios.
- Duplicate-email registration validation.
- Cart, checkout, and product-removal scenarios.
- Secure PowerShell runners for local credential prompts.
- Suite-specific reports, screenshots, videos, and test-result folders.
- QA/Playwright agent, skill guides, and workspace instructions.
- Automatic validated-change commit and push guidance.

### Git commits

- `89ec547` - Add Playwright QA automation suites
- `fdc54b3` - Automate validated changes delivery
