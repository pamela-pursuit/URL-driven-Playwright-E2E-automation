# Progress: demo-web-shop E2E run

Resume in a new session with `/e2e-agent https://demowebshop.tricentis.com --app demo-web-shop`
(or "continue the demo-web-shop E2E run"). Continue from the first step that is not **Done**.

| # | Phase / step | Status | Output |
| --- | --- | --- | --- |
| 0 | Intake: URL, account forms, credentials file, check | Done (2026-11-05) | intake.md, credentials/credentials.xlsx (local) |
| 1a | Discovery: public, signed in, checkout | Done | discovery.md (guest COD order #2411222 placed) |
| 1b | Requirements and user decisions D1 to D5 | Done | requirements.md (section 8), intake.md |
| 2 | Scenario catalogue and Excel workbook | Done (70 scenarios, 0 errors) | scenarios.json, demo-web-shop-e2e-scenarios.xlsx |
| 3a | Architecture | Done | architecture.md |
| 3b | Implementation (68 tests) and smoke | Done: tsc OK, 204 listed, Chromium smoke passed, Laptop untouched, no account values in reports; checkpoint commit 9a5b5fc | pages/, fixtures/, test-data/, tests/demo-web-shop/ |
| 4 | Execution (user asked for parallel; see plan below) | Done: run 1 gave 186 passed, 4 failed, 14 skipped (Pass A re-run for reports; guest COD order #2411261) | artifacts/demo-web-shop/runs/ |
| 4b | Failure investigation and fixes (max 3 iterations per failure) | Done in 1 iteration: DWS-069 (retrying waits), DWS-056 (image layout shift), DWS-050 (demo server error, fail-fast). Re-runs green; all 68 automated scenarios Passed | scenarios.json, workbook |
| 5a | Quality review | Done: re-review verdict **Ready** (2026-11-06); no Blocker or Major; 3 optional Minors (DWS-069 positive control, DWS-068 redundant check, untracked template file) | |
| 5b | Delivery report, commit and push | Done (2026-11-06): verdict **Ready with limitations** | "Delivery Report" sheet in demo-web-shop-e2e-scenarios.xlsx |

## Execution plan (user: "run in parallel", 2026-11-05)

- **Pass A, guest-only files, `--workers=3`, all 3 browsers:** search, listing, product, resilience, cart-guest, checkout-guest, checkout-cod, responsive.
- **Pass B, files touching the account, `--workers=1`:** auth, session, authorization, register, cart-signed-in, checkout-signed-in, wishlist, account, accessibility. D2 (one shared account) still applies, and Chromium-only tests remain Chromium-only.
- After each pass: `node scripts/workbook.mjs sync --app demo-web-shop` then `build`.

## Constraints to keep (see intake.md D1 to D5)

Never touch the "14.1-inch Laptop" in the account cart. COD orders only as a guest. Signed-in checkout stops at Billing. No account creation. At most one wrong-password login per run. Never read or print credentials.

## Guest COD demo orders placed (permanent, accepted by the user under D3/D5)

| Order | When | Source |
| --- | --- | --- |
| #2411222 | 2026-11-05 | Discovery probe c3 |
| (number not captured) | run 2026-11-05_15-07-20 | First Pass A; no JSON reporter was used |
| #2411261 | run 2026-11-05_15-27-19 | Pass A re-run |
| #2411276 | run 2026-11-05_15-59-08 | Final full run |
| #2411680 | run 2026-11-06_13-14-06 | Re-run requested by the user (2026-11-06) |

## Re-runs

| Date | Runs | Result |
| --- | --- | --- |
| 2026-11-06 | 2026-11-06_13-14-06 (guest, --workers=3), 2026-11-06_13-21-14 (account, --workers=1) | 190 passed, 0 failed, 14 skipped (Chromium-only by design); code unchanged since df75acb |

## Scenario approval

| Date | Decision | Scenarios |
| --- | --- | --- |
| 2026-11-06 | **Approved** by the user at the scenario review gate (after reviewing in Excel); no scenarios added | 70 (DWS-001 to DWS-070), recorded in scenarios.json `approval` |
| 2026-11-10 | User asked to install what DWS-070 needs. DWS-070 changed from Manual to Automated (axe scan, report-only, Chromium only). **Done:** `@axe-core/playwright` 4.14.0 installed, tsc OK, run `2026-11-10_14-03-26` passed (9 axe rules violated, 2 critical), synced, approval re-recorded (70), R-32 closed, Delivery Report addendum, workbook rebuilt. Node 20.11.1 is blocked by Defender (TvmWarn); use Node 26.13.0 from fnm (`%APPDATA%\fnm\node-versions\v26.13.0\installation`) | DWS-070 |
| 2026-11-10 | Defects sheet added; DEF-001 to DEF-013 logged. Re-checks: DEF-005 New, DEF-003 Low, DEF-013 Rejected; DWS-068 false Firefox gap fixed (run 2026-11-10_14-34-57, 3 passed); R-30 closed. **Open, user's call:** WCAG target (R-31), product-owner decisions (DEF-006 to DEF-008), reporting the New defects to the site owner | DWS-068, defects |
| 2026-11-10 | **D6:** accessibility out of scope (user: "dummy website"). User chose to remove the tests entirely: DWS-068 to DWS-070, accessibility.spec.ts and @axe-core/playwright removed; R-31 closed; DEF-009 to DEF-012 Closed. Approval re-recorded for **67** scenarios. Full run now 184 tests. DWS-001 smoke passed (run 2026-11-10_14-43-13) | DWS-068 to DWS-070 |
