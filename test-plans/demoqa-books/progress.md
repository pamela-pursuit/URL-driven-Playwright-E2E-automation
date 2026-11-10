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
| 3a | Architecture | Done: 144 tests (48 x 3); guest pass --workers=3, account pass (@account, 42 tests) --workers=1; DQB-026 the only wrong password per account | architecture.md |
| 3b | Implementation | Done (2026-11-11): 48 automated, 144 listed (102 guest, 42 @account); tsc OK; validate 0 errors; Chromium smoke 3 passed (run 2026-11-10_18-41-28); leak check clean | pages/demoqa-books/, tests/demoqa-books/, fixtures/demoqa-books.fixture.ts, test-data/demoqa-books.data.ts |
| 4 | Run confirmation, execution, failure fixes | In progress (run authorised in advance by the user) | artifacts/demoqa-books/runs/, html-reports/ |
| 5 | Quality review, delivery report, commit and push | Not started | Delivery Report sheet |

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
| A guest, --workers=3 | 2026-11-10_18-43-50 | 92 passed, 10 failed: DQB-019 x3 (Back To Book Store -> about:blank after direct goto), DQB-021 x3 (app crashes when books API fails), DQB-041 x3 (no register request, fields empty), DQB-040 webkit |
| B @account, --workers=1 (once; DQB-026 ran once per account, passed) | 2026-11-10_18-50-36 | 32 passed, 10 failed: chromium DQB-034..039 (response.json protocol error in waitForCollection), firefox+webkit DQB-034/037 ("User not authorized!" cached session) |

Chromium account probably still holds suite books "Speaking JavaScript" and "Designing Evolvable Web APIs with ASP.NET" (teardown failed); clean-up assigned to the failure investigator. Iteration 1 of max 3: three failure investigators running (collection/session, register, book list). Re-runs exclude DQB-026 (one wrong password per account already used).

## Iteration 1 diagnosis (2026-11-11)

- DQB-034..039 (chromium): profile page matched the previous page's User response and read its body after navigation. Fix: bind the wait to the new navigation, read the body immediately.
- DQB-034/037 (firefox, webkit): a new login revokes the account's earlier token ("User not authorized!"); Logout is client-side only. Fix: session state from the User response, re-login once, freshLogin adopts its new cookies.
- DQB-040 (webkit), DQB-041 (all): invisible reCAPTCHA v3 token arrives 1-3 s after load and clears the form. Fix: wait for the token before typing.
- DQB-019 (all): Back To Book Store is history-back; test now arrives from the list (steps changed, expected unchanged).
- DQB-021 (all): app crashes to a blank page on a books-service 500. Expected result kept; logged as a defect; the test fails while it is open.
- Account clean-up: chromium's two leftover suite books removed; all three collections empty (checked after reload).
- Defects to log after the fixes: DEF-001 blank page on service error, DEF-002 Back To Book Store from deep link, DEF-003 register form erased by the captcha token, DEF-004 Logout does not end the server session.

## Iteration 1 fixes and final run (2026-11-11)

- Fixes applied (implementer): navigation-armed response waits; session state from GET /Account/v1/User with one re-login; freshLogin adopts its cookies; register waits for the reCAPTCHA v3 token; DQB-019 arrives from the list; DQB-021 asserts directly.
- Targeted verification: guest 2026-11-10_19-15-34 (019/040/041 passed x3; 021 failed x3 = DEF-001, intended); account 2026-11-10_19-16-43 (39/39 passed, DQB-026 excluded); collections empty.
- DQB-019 steps changed (expected unchanged); approval re-recorded 2026-11-11 under the user's advance "run and fix" authorisation.
- Defects logged: DEF-001 (DQB-021 fails while open), DEF-002, DEF-003, DEF-004; risks R-34..R-37 added, R-26 updated.
- Final full run started: Pass A (102 guest, --workers=3) and Pass B (39 @account without DQB-026, --workers=1). DQB-026's result stays from run 1 (passed on all 3).
