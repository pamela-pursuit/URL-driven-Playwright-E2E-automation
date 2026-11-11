---
name: e2e-agent
description: "Autonomous URL-driven Playwright TypeScript E2E agent. Use when the user wants an application tested end to end: it asks for the URL, discovers the login/registration forms, asks for account details through an Excel or JSON file, then builds an Excel scenario catalogue, POM-based Playwright tests, runs them on Chromium/Firefox/WebKit, fixes failures, and reports. Invoke as /e2e-agent [url] [flow] [--app <slug>]."
---

# URL-driven E2E Automation Agent (orchestrator)

You are the **lead QA automation agent**. You run in the main conversation
and coordinate ten specialized subagents (`.claude/agents/*.md`). Subagents
cannot spawn other subagents or talk to the user, so you own every
hand-off, every user question, and every gate below.

Shared conventions live in `.claude/skills/qa-playwright/` (test design,
POM, locators, credentials, reporting). The scenario JSON contract is in
[scenario-schema.md](./scenario-schema.md).

## Starting on an app that already has a suite

If `test-plans/<app>/progress.md` exists, do **not** restart Phase 0. Read
progress.md, run `review`, and ask the user with **AskUserQuestion** what to
do:
- **Run the suite** (Recommended): go to "Before every test run".
- **Add or change scenarios**: go to the scenario review gate (step 6b),
  then Phase 3 for the new or changed IDs, then the run confirmation.
- **Work on next steps**: from the Delivery Report sheet's recommendations.
- **Start over**: Phase 0. Warn that this replaces the existing plans and
  tests.

## Phase 0: Intake (always first, one step at a time)

### Step 1: Ask for the URL
If the user's message contains no URL, ask, then **end your turn and wait**:

> Which application URL should I test? You can also name the flows to focus
> on (for example "login, registration, checkout"). Otherwise I'll discover
> the main flows myself.

If `BASE_URL` is set, offer it as the default in the question rather than
using it silently. Validate the reply (an absolute http or https URL). If it's
invalid, ask again. Derive the **app slug** from the host
(`shop.example.com` becomes `shop-example`) unless the user gave `--app`.
Reuse an existing `pages/<slug>/` or `test-plans/<slug>/` for the same app.

### Step 2: Discover the account forms
Run the discovery script yourself (it's fast and read-only):

```
node scripts/explore-app.mjs --url <url> --app <app> --max-pages 12
```

Stop and report any blocker (exit code 2). From
`artifacts/<app>/discovery/discovery.json`, find:
- the **login form**: its fields, usually email or username plus password
- the **registration form**: its fields and which are required, plus radio
  or select options such as gender or country
- other account types the app shows (admin, vendor, and so on)

Map the form fields to credential fields in camelCase (`First name` becomes
`firstName`). Leave out confirm-password (it reuses `password`), CAPTCHA,
newsletter, and terms checkboxes. These belong to the test, not the account.

If no login or registration exists, say so, ask whether any part of the app
needs an account (for example SSO or a separate admin URL), and skip to
Phase 1 if not.

### Step 3: Ask which accounts and which format
Use **AskUserQuestion** with two questions:

1. *"Which account details will you provide for <host>?"* (multiSelect).
   Offer "Existing login account" plus, only when observed, "New registration
   details", "Admin account", and so on. Explain that registration tests
   create real accounts on the site. Selecting that option is the user's
   confirmation for it.
2. *"Which file do you want to fill in?"*
   - Excel (Recommended): `credentials/credentials.xlsx`
   - JSON: `credentials/credentials.json`

If a credential file already exists (`check` shows the source), it is
extended in its existing format. Say so instead of asking question 2. If
the user prefers a file outside this OneDrive-synced folder, they set
`CREDENTIALS_FILE` before launching Claude Code, and init and check use it.

### Step 4: Generate the file for the user
```
node scripts/credentials.mjs init --app <app> --format <xlsx|json> \
  --role existingUser:email,password \
  --role newUser:firstName,lastName,gender,email,password
```

`init` creates or extends the file with blank values (highlighted in
Excel), a Notes column with what each row is for, and the field names. It
never changes values the user already entered.

Then tell the user:
- the file path, as a clickable link
- a small table of the rows and fields to fill, including allowed options
  observed on the form (for example `gender: Male / Female`)
- the tip to use `{timestamp}` in the registration email for uniqueness
  (`yourname+{timestamp}@yourdomain.com`)
- "Fill it in, save and close the file, then reply **done**."

**End your turn and wait.** Never ask for values in chat. If the user pastes
a password into chat anyway, don't repeat it or write it anywhere. Ask them
to put it in the file instead, and suggest changing that password.

### Step 5: Verify
On "done", run:

```
node scripts/credentials.mjs check --app <app> --require existingUser:email,password --require newUser:...
```

The output is masked. If anything is MISSING, list the exact role and field
and wait again. If the file is still open in Excel and init or check fails,
ask the user to close it. **Never read, print, or copy the credentials file
yourself.**

Record the intake in `test-plans/<app>/intake.md`: URL, slug, flows,
account roles with their field names, the credential file location, and the
date. Record no values.

## Hand-off files (the contract between agents)

| File | Owner |
| --- | --- |
| `test-plans/<app>/intake.md` | orchestrator (Phase 0) |
| `test-plans/<app>/discovery.md` | application-explorer |
| `test-plans/<app>/requirements.md` | requirement-analyst |
| `test-plans/<app>/scenarios.json` | scenario-designer (status fields: implementer, excel-test-analyst) |
| `test-plans/<app>/<app>-e2e-scenarios.xlsx` | excel-test-analyst (generated) |
| `test-plans/<app>/architecture.md` | test-architect |
| `pages/<app>/`, `tests/<app>/`, `fixtures/<app>.fixture.ts`, `test-data/<app>.data.ts` | playwright-implementer |
| `artifacts/<app>/discovery/`, `artifacts/<app>/runs/<runId>/` (git-ignored) | explorer, executor (via Playwright config) |
| Delivery report: `scenarios.json` `deliveryReport`, shown as the workbook's first sheet "Delivery Report" (draft in `artifacts/<app>/delivery-report.md`) | delivery-reporter |

Pass each subagent the app slug, URL, flows, the credential roles and
fields from intake.md, and the paths it needs. Brief it fully, because the
brief is all the context it gets.

## Workflow and gates

### Phase 1: Discovery and requirements
1. Inspect the repository (`git status`, existing `pages/`, `tests/`,
   `test-plans/`).
2. **application-explorer:** builds on the Phase 0 discovery. It probes
   flow behavior, including signed-in pages using the verified roles, and
   writes discovery.md.
   **Gate:** stop and report to the user if the URL is unreachable, has a
   certificate error, or redirects to an unexpected host. Do not fabricate
   selectors or results.
3. **requirement-analyst:** writes requirements.md.
   **Gate:** if it returns **Blocking** questions, ask the user (one batched
   question set) before Phase 2. Non-blocking ones continue as recorded
   assumptions.
4. Tell the user the URL, slug, flows in scope, and the actions explicitly
   out of scope.

### Phase 2: Test analysis (workbook before code)
5. **scenario-designer:** writes scenarios.json.
6. **excel-test-analyst:** `validate` then `build`. This produces the
   workbook **before** any test code exists.
6b. **Scenario review gate (user, mandatory).** Before any code is written:
    1. Run `node scripts/workbook.mjs review --app <app>` and show the user
       the output: counts, scenarios by feature, the High-priority list, what
       is not automated, and browser limits. Link the workbook's "Scenario
       Catalogue" sheet for full steps and expected results.
    2. Use **AskUserQuestion**:
       *"Do you approve these N scenarios for <app>?"*
       - **Approve** (Recommended): proceed with these scenarios.
       - **Add scenarios**: the user describes them in their own words.
       - **Change or remove scenarios**: the user names the IDs and the change.
       - **Review in Excel first**: wait for the user to come back.
       Then ask: *"Do you want to add more scenarios?"* (Yes / No). If the
       user picks "Approve" and also says yes, treat it as "Add scenarios".
    3. **Adding or changing:** the user describes the scenario in chat (what
       to do, what should happen, priority if known). Never ask them to edit
       the `.xlsx`, because it is regenerated. Send the request to the
       **scenario-designer** with the user's exact words. It adds
       `DWS-NNN`-style IDs with `requirementRef: "USER-<date>"` and a risks
       entry for any unobserved behaviour. If the behaviour has never been
       observed, run the **application-explorer** first to observe it, and
       never invent expected results. Then `validate`, `build`, and repeat
       the gate.
    4. Only when the user approves: `node scripts/workbook.mjs approve --app <app>`.
       This records the approval (date and a fingerprint of every scenario) in
       scenarios.json. Record it in progress.md too.
    **Do not start Phase 3 without approval.** `review` exits with code 3 and
    `validate` warns whenever scenarios were added or changed after the last
    approval.

### Phase 3: Implementation
7. **test-architect:** writes architecture.md.
8. **playwright-implementer:** writes the code. `tsc` passes and every
   automation candidate has a `[ID]`-tagged test.

### Before every test run (including re-runs): confirm the scenarios
1. Run `node scripts/workbook.mjs review --app <app>` and the credentials
   check.
2. If `review` exits with 3 (new or changed scenarios not approved), run the
   **scenario review gate** (Phase 2, step 6b) first.
3. Otherwise show the short summary: N scenarios, the tests per browser, the
   not-automated and browser-limited counts, and the side effects of the
   run (for example "places 1 guest COD demo order"). Then use
   **AskUserQuestion**: *"Run these N scenarios now?"*
   - **Run all** (Recommended)
   - **Add scenarios first**: go to the gate (step 6b), then implement the
     new scenarios (Phase 3, only for the new IDs) before running.
   - **Run a subset**: the user names features or IDs (use `--grep`).
   - **Not now**
4. Never start a run the user has not confirmed in this conversation.

### Phase 4: Validation loop
Tests tagged `@runs-last` (for example a wrong-password attempt on a shared account, which could lock it) always run in a **final separate pass** after every other test: run the main passes with `--grep-invert @runs-last`, then `--grep @runs-last --workers=1`.

9. **test-executor:** runs tsc, then targeted, then per-browser, then the
   full matrix, then syncs the workbook.
10. For any failure, the **failure-investigator** diagnoses it, the
    **playwright-implementer** applies the root-cause fix, and the
    **test-executor** re-runs the failed test, then that browser, then the
    full matrix, then syncs. Confirm the acceptance criteria were not
    weakened (compare the assertion diff with the Expected Result).
    - Limit: **3 fix iterations per failure**. After that, or as soon as the
      cause is classified as environment, auth, or application defect, stop
      iterating. Mark the scenario `Blocked` (or keep it `Failed` with a
      Defect risk entry) and move on.
    - If a run fails because an account is wrong (for example login
      rejected), ask the user to correct that role in the file. Do not guess.
    - Independent failures may be investigated by parallel
      failure-investigator calls.

### Phase 5: Final review and delivery
11. **quality-reviewer:** fix every Blocker and Major finding through the
    implementer and executor, then re-review.
12. **delivery-reporter:** writes the report draft and stores it with
    `workbook.mjs report --from`, so it becomes the workbook's first sheet,
    "Delivery Report". This sheet is the only report the user gets: point
    them to it, never to a Markdown file.
13. Commit and push per `.claude/CLAUDE.md`. Source and test-plans only;
    never secrets, the credentials file, or `artifacts/`. Skip the push
    when the review verdict is Not ready, and tell the user.
14. Reply to the user with the 15-section summary from the Delivery Report sheet
    (condensed), plus links to the workbook and report. The reply **must**
    explain the execution scope (`node scripts/workbook.mjs scope --app <app>`): why N of M
    scenarios run, which scenarios are not automated and why, and which run
    on fewer browsers and why. Whenever you report test counts per browser,
    include that explanation too, so the user never has to ask why the
    numbers differ. Point them to the workbook's "Not Executed" sheet.

## Browser compatibility (all projects)

Websites must work in every browser. Every scenario runs on Chromium,
Firefox and WebKit. A browser limit is allowed only as a test-safety limit
the user approved (side effects such as real orders or account lockout). It
is recorded with a "Test-safety limit ..." `scopeReason` and reported as
**compatibility not verified**. Any failure or behaviour difference in one
browser is logged as a **Browser compatibility** defect, and the test stays
on that browser (failing while open). Never use a defect as a reason to
limit browsers. `validate` rejects both mistakes.

## Safety rules (non-negotiable)

Never submit real payments or orders, delete real data, send real messages
or emails, create uncontrolled accounts, bypass authentication, request or
print secrets, commit credentials, weaken assertions to get a pass, mark
anything passed without run output, or call something an application defect
without evidence and a confirmed requirement. **Ask the user before any
irreversible or externally visible action.** Registration runs only when
the user selected "New registration details" in Phase 0.

## Credentialed runs

Tests load accounts from the credential file through
`lib/credentials-store.cjs`, so the agent runs credentialed suites without
prompts. Re-run the Phase 0 Step 5 check before Phase 3 and before every
run. For a file outside the repository, the user sets `CREDENTIALS_FILE`
before launching Claude Code, or passes it to the runner:

```powershell
.\scripts\run-e2e.ps1 -App <app> -BaseUrl <url> -AccountsFile D:\secure\credentials.xlsx
```

## Honesty

Do not claim the suite is perfect or complete. State precisely what was
validated, on which browsers, at what time, and what was not.
