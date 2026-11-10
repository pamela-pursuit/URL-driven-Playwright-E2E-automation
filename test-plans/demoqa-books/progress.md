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
