# Progress: demoqa-books E2E run

Resume in a new session with `/e2e-agent https://demoqa.com/books --app demoqa-books`
(or "continue the demoqa-books E2E run"). Continue from the first step that is not **Done**.

Node: the default Node 20.11.1 is blocked by Defender. Prefix commands with
`$env:Path = "$env:APPDATA\fnm\node-versions\v26.13.0\installation;" + $env:Path;`

| # | Phase / step | Status | Output |
| --- | --- | --- | --- |
| 0 | Intake: URL, account forms, credentials file, check | Done (2026-11-10) | intake.md; credentials/credentials.xlsx `demoqa-books/existingUser` (local, masked check OK) |
| 0a | Rename slug `demoqa` -> `demoqa-books` (user request) | Done: folders, references and the credentials App cell (masked check OK) | test-plans/demoqa-books/, artifacts/demoqa-books/ |
| 1a | Discovery (application-explorer) | Done (2026-11-10): no blockers; collection empty at start and end; 1 wrong-password attempt | discovery.md |
| 1b | Requirements (requirement-analyst) and user questions | Done: 13 REQs; Q1 answered (one account per browser: existingUser, firefoxUser, webkitUser); accessibility out of scope (confirmed by the user) | requirements.md |
| 2 | Scenario catalogue and Excel workbook | Done: 48 scenarios (14 High, 19 Medium, 15 Low), all Planned, all on 3 browsers; validate 0 errors | scenarios.json, demoqa-books-e2e-scenarios.xlsx |
| 2b | Scenario review gate (user approval) | Done: approved in advance by the user (recorded 2026-11-10 with `approve`, 48 scenarios); user reviews the list later in the workbook | approval in scenarios.json |
| 3a | Architecture | Done: 144 tests (48 x 3); guest pass --workers=3, account pass (@account, 42 tests) --workers=1; TC-26 the only wrong password per account | architecture.md |
| 3b | Implementation | Done (2026-11-11): 48 automated, 144 listed (102 guest, 42 @account); tsc OK; validate 0 errors; Chromium smoke 3 passed (run 2026-11-10_18-41-28); leak check clean | pages/demoqa-books/, tests/demoqa-books/, fixtures/demoqa-books.fixture.ts, test-data/demoqa-books.data.ts |
| 4 | Run confirmation, execution, failure fixes | Done: final 141/144 (TC-21 x3 = DEF-001 by design); 1 fix iteration | artifacts/demoqa-books/runs/, html-reports/ |
| 5 | Quality review, delivery report, commit and push | Done (2026-11-11): re-review Ready; Delivery Report: Ready with limitations | Delivery Report sheet |

## Scope

Book Store Application only (assumed from the URL; no flows named). Existing login account only; no registration submissions.

## User authorisations (2026-11-10, user leaving)

| Topic | Decision |
| --- | --- |
| Scenario approval | **Approved in advance** by the user before the catalogue was finished ("I will not be available, so I approve it now"). Record with `workbook.mjs approve` once validated; the user reviews the list later in the workbook. |
| Test runs | **Yes, run and fix** (user): write the tests, run on Chromium, Firefox and WebKit, fix test problems (max 3 rounds each), log defects in the workbook, review, Delivery Report, commit and push. Side effects accepted: books added to and removed from each browser's account collection (left empty), one wrong-password login per account. No accounts created, nothing deleted from accounts, no orders. |

## Run 1 (2026-11-10, user-authorised)

| Pass | Run folder | Result |
| --- | --- | --- |
| A guest, --workers=3 | 2026-11-10_18-43-50 | 92 passed, 10 failed: TC-19 x3 (Back To Book Store -> about:blank after direct goto), TC-21 x3 (app crashes when books API fails), TC-41 x3 (no register request, fields empty), TC-40 webkit |
| B @account, --workers=1 (once; TC-26 ran once per account, passed) | 2026-11-10_18-50-36 | 32 passed, 10 failed: chromium TC-34..039 (response.json protocol error in waitForCollection), firefox+webkit TC-34/037 ("User not authorized!" cached session) |

Chromium account probably still holds suite books "Speaking JavaScript" and "Designing Evolvable Web APIs with ASP.NET" (teardown failed); clean-up assigned to the failure investigator. Iteration 1 of max 3: three failure investigators running (collection/session, register, book list). Re-runs exclude TC-26 (one wrong password per account already used).

## Iteration 1 diagnosis (2026-11-11)

- TC-34..039 (chromium): profile page matched the previous page's User response and read its body after navigation. Fix: bind the wait to the new navigation, read the body immediately.
- TC-34/037 (firefox, webkit): a new login revokes the account's earlier token ("User not authorized!"); Logout is client-side only. Fix: session state from the User response, re-login once, freshLogin adopts its new cookies.
- TC-40 (webkit), TC-41 (all): invisible reCAPTCHA v3 token arrives 1-3 s after load and clears the form. Fix: wait for the token before typing.
- TC-19 (all): Back To Book Store is history-back; test now arrives from the list (steps changed, expected unchanged).
- TC-21 (all): app crashes to a blank page on a books-service 500. Expected result kept; logged as a defect; the test fails while it is open.
- Account clean-up: chromium's two leftover suite books removed; all three collections empty (checked after reload).
- Defects to log after the fixes: DEF-001 blank page on service error, DEF-002 Back To Book Store from deep link, DEF-003 register form erased by the captcha token, DEF-004 Logout does not end the server session.

## Iteration 1 fixes and final run (2026-11-11)

- Fixes applied (implementer): navigation-armed response waits; session state from GET /Account/v1/User with one re-login; freshLogin adopts its cookies; register waits for the reCAPTCHA v3 token; TC-19 arrives from the list; TC-21 asserts directly.
- Targeted verification: guest 2026-11-10_19-15-34 (019/040/041 passed x3; 021 failed x3 = DEF-001, intended); account 2026-11-10_19-16-43 (39/39 passed, TC-26 excluded); collections empty.
- TC-19 steps changed (expected unchanged); approval re-recorded 2026-11-11 under the user's advance "run and fix" authorisation.
- Defects logged: DEF-001 (TC-21 fails while open), DEF-002, DEF-003, DEF-004; risks R-34..R-37 added, R-26 updated.
- Final full run started: Pass A (102 guest, --workers=3) and Pass B (39 @account without TC-26, --workers=1). TC-26's result stays from run 1 (passed on all 3).

## Quality review 1 and fixes (2026-11-11)

- Verdict **Not ready**, no Blockers. Majors: (1) worker login context not masked (close-time screenshot); (2) error-context ARIA snapshots carried account values (12 files in run 2026-11-10_18-50-36); (3) TC-27 asserted only non-empty text.
- Fixed: maskAccountValues() for every context and about:blank before closing the login context; aria-hidden plus teardown visibility:hidden for #userName-value, #userForm #userName and #userForm #password (Playwright 1.64 ai-mode snapshots keep aria-hidden visible elements); TC-27 asserts "Invalid username or password!" (R-18 closed); minors 5, 6, 7, 9, 10, 11; TC-21 annotated DEF-001.
- Local artifacts redacted (git-ignored only, never committed): 12 text files and 55 screenshots removed, 5 kept-report zips rebuilt; all 113 remaining text files in demoqa-books runs contain no account values.
- Verification: guest subset 2026-11-10_19-49-03 (17/18; firefox TC-41 first-load timeout, passed on re-run 19-51-31); account 2026-11-10_19-57-32 39/39.
- Final full run on current code started (Pass A guest, Pass B account without TC-26). TC-26 evidence remains run 1 (passed x3); the fixture changes since then only affect masking of artifacts, not login behaviour.

## Final runs and re-review (2026-11-11)

| Run | Scope | Result |
| --- | --- | --- |
| 2026-11-10_20-05-48 | Guest, all 3 browsers, --workers=3 | 99 passed, 3 failed (TC-21 x3 = DEF-001, by design) |
| 2026-11-10_20-10-19 | @account without TC-26, --workers=1 | 39 passed |
| 2026-11-10_20-21-35 | Chromium TC-24/031/034 after the teardown hardening | 3 passed |
| 2026-11-10_18-50-36 | TC-26 (only evidence; one wrong password per account) | passed on all 3 browsers |

- Quality re-review: **Ready** (no Blockers or Majors). Minors handled: TC-26 lastRunNotes restored after sync; teardown can no longer hide the original error (blank-page failure logged, context always closed; snapshot-hide failures recorded as annotations); temporary scripts deleted before delivery.
- Known flake to watch: firefox TC-41 once timed out on the first load of /register (heading not rendered within 15 s, verification run 2026-11-10_19-49-03); it passed on re-run and in the final run.
- All three account collections were empty after the final runs (TC-39 passed on every browser).
- Scenario changes from quality review 1 (approval re-recorded 2026-11-11 under the user's "run and fix" authorisation): TC-27 asserts the exact "Invalid username or password!"; TC-33 also asserts the URL is /login after "Log out" on /books (R-28 closed); TC-46 expected text states /books (R-29 closed; the test already asserted it).
- The teardown hardening (after the final full runs) only changes error-handling paths; it was re-checked on Chromium (run 2026-11-10_20-21-35, 3 passed), not yet on Firefox/WebKit.
- Delivery Report stored as the workbook's first sheet (verdict: Ready with limitations).

## Discrepancies promoted to defects (2026-11-11, user: "do it")

- R-19..R-26 became defects DEF-005..DEF-012. Where the correct behaviour is concrete, the test now checks it and fails while the defect is open (plain Failed, DEF id in the message): TC-12 (DEF-005), TC-13 (DEF-006), TC-18 (DEF-011), TC-31 (DEF-010), TC-35 (DEF-009), TC-41 (DEF-012). DEF-007 and DEF-008 have no automated check (wording not specified); TC-09/020/039 no longer assert the absence of a message.
- DEF-011: the description is already cut at 255 characters in the API (not a display problem).
- R-27 checked: the table scrolls sideways to the Publisher column on all 3 browsers, so DEF-013 is Rejected and R-27 closed.
- Approval re-recorded for the 9 changed scenarios. Targeted runs: each changed check failed only with its DEF message; TC-09/020/039 passed; collections empty.
- Full run on all 3 browsers started (also re-checks firefox/webkit after the teardown hardening). Expected failures: TC-12, 013, 018, 021, 031, 035, 041 on each browser (21).
- Full run result (2026-11-11): guest 2026-11-11_02-38-36 87 passed / 15 failed, account 2026-11-11_02-44-24 33 passed / 6 failed = 123/144; all 21 failures verified to fail only on their own DEF check. Workbook: 21 "Known defect" rows, 0 to investigate; 12 open defects (4 Medium, 8 Low), 1 rejected. Delivery Report updated with an addendum.

| 2026-11-11 | **Approved** by the user after the TC-NN rename and the plain-language rewrite of all scenarios | all scenarios, recorded in scenarios.json `approval` |

| 2026-11-11 | Full run (2026-11-11_15-34-00 guest, 2026-11-11_15-40-33 account): 144 tests. 5 timeouts on Firefox/WebKit only (TC-15, 24, 25, 36, 41) were re-run on all 3 browsers (2026-11-11_15-58-41): TC-15/24/25/36 passed everywhere (temporary site slowness); TC-41 fails on all 3 browsers with DEF-012. **No browser compatibility defect.** Every failure is linked to an open defect. |
