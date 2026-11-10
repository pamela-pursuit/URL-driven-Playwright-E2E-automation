# URL-driven Playwright E2E automation

URL-driven Playwright TypeScript E2E automation. Give Claude Code an
application URL, and it explores the app, builds an Excel scenario catalogue,
writes Page Object Model tests, runs them on Chromium, Firefox, and WebKit,
fixes failures at the root cause, and reports the result.

## Setup

```powershell
npm install
npx playwright install chromium firefox webkit
```

## Choose a QA entry point

There are two related ways to use the QA setup:

- **`qa-playwright` agent**: a focused task, such as reviewing acceptance
  criteria, fixing a locator, or adding a small set of tests.
- **`e2e-agent`**: the full URL-driven workflow, including safe discovery,
  scenario review, implementation, browser runs, and a delivery report.

In VS Code, choose either agent from the chat agent picker. For the full flow,
choose **e2e-agent** and provide the application URL and any target flows.
`e2e-agent` can delegate focused work to `qa-playwright`.

The `/e2e-agent` skill workflow below is also available in Claude Code and
coordinates the specialized agents under `.claude/agents/`.

## Start a new application in Claude Code

In Claude Code, type:

```text
/e2e-agent
```

The agent then walks you through the inputs:

1. **URL.** It asks which application to test. You can also name flows,
   such as "login, registration, checkout".
2. **Account forms.** It opens the site and finds the login and registration
   forms and the fields they need.
3. **Accounts and format.** It asks which account details you'll provide
   (existing login, new registration, admin, and so on) and whether you want
   an **Excel** or **JSON** file.
4. **Credential file.** It creates `credentials/credentials.xlsx` (or
   `.json`) with exactly those fields, left blank and highlighted, and a note
   on each row. You fill it in, save, and reply **done**. Passwords are never
   typed into chat.
5. **Check.** It verifies the file (values masked), tells you about any blank
   cells, and then starts exploring, designing scenarios, and testing.

Shortcut: `/e2e-agent https://example.com login, registration --app my-app`
skips the URL question.

You can also prepare the credential file yourself:

```powershell
node scripts/credentials.mjs init --app my-app --format xlsx --role existingUser:email,password --role newUser:firstName,lastName,email,password
```

## How the agent works (flow and steps)

Steps marked **(you)** wait for your answer. The agent never writes code or
runs tests without your confirmation.

| # | Phase | Who | What happens | Output |
| --- | --- | --- | --- | --- |
| 1 | Intake | **(you)** + orchestrator | Asks for the URL, finds the login and registration forms, asks which accounts and which file format, and creates the credentials file for you to fill | `credentials/credentials.xlsx`, `intake.md` |
| 2 | Discovery | application-explorer | Crawls safe pages and probes flows (also signed in); records only observed behaviour | `discovery.md` |
| 3 | Requirements | requirement-analyst, **(you)** | Builds the requirement list and asks you the blocking questions (for example what tests may change, or whether orders may be placed) | `requirements.md` |
| 4 | Scenario design | scenario-designer, excel-test-analyst | Writes the risk-based scenarios and builds the Excel workbook, before any code | `scenarios.json`, workbook |
| 5 | **Scenario review** | **(you)** | Shows the scenarios (by feature, High priority, not automated, browser limits). You **approve**, **add**, or **change** scenarios; it then asks whether you want to add more. New ones are designed (and observed first if needed), and the review repeats until you approve | approval recorded in `scenarios.json` |
| 6 | Implementation | test-architect, playwright-implementer | Designs and writes page objects, fixtures and specs (type-checked, smoke-tested) | `pages/`, `fixtures/`, `tests/` |
| 7 | **Run confirmation** | **(you)** | Before every run (also re-runs): shows what will run and any side effects (for example one demo order). You choose run all, add scenarios first, run a subset, or not now | |
| 8 | Execution and fixes | test-executor, failure-investigator, playwright-implementer | Runs Chromium, Firefox and WebKit, diagnoses failures from evidence, fixes root causes, re-runs (max 3 iterations per failure) | `artifacts/<app>/runs/<timestamp>/`, workbook results |
| 9 | Review and delivery | quality-reviewer, delivery-reporter | Independent review (must be Ready), then the delivery report; commit and push | workbook "Delivery Report" and "Not Executed" sheets |

Running `/e2e-agent` again on an app that already has a suite skips intake
and asks what to do: run the suite, add or change scenarios, work on next
steps, or start over.

Approval commands (used by the agent):

```powershell
node scripts/workbook.mjs review  --app my-app   # summary + changes since approval (exit 3 = approval needed)
node scripts/workbook.mjs approve --app my-app   # record your approval
```

## Project structure

```text
.claude/
  agents/               # the 10 E2E subagents
  skills/e2e-agent/     # /e2e-agent orchestrator + scenario schema
  skills/qa-playwright/ # shared QA guides (test design, POM, locators, credentials, reporting)
  settings.json         # blocks Claude from reading credentials/
lib/                    # shared runtime code (credentials-store)
scripts/                # CLI tools: explore-app, workbook, credentials, run-e2e
templates/              # credentials.example.json / .xlsx

# Generated per application by the agent (empty until the first run)
test-plans/<app>/       # discovery, requirements, architecture, scenarios.json, Excel workbook, delivery report
pages/<app>/            # page objects
tests/<app>/            # specs (titles start with [ID])
fixtures/<app>.fixture.ts
test-data/<app>.data.ts # non-secret test data

# Local only (git-ignored)
credentials/            # your credentials.json or credentials.xlsx
artifacts/<app>/        # latest.json + runs/<timestamp>/ (summary.md, screenshots/<browser>/, report/, test-results/, results.json)
```

## URL-driven E2E automation agent (Claude Code)

The orchestrator is `.claude/skills/e2e-agent/SKILL.md`. It coordinates ten
subagents in `.claude/agents/`:

| Subagent | Responsibility | Output |
| --- | --- | --- |
| application-explorer | Validate the URL, crawl safe pages, record observed behavior | `test-plans/<app>/discovery.md` |
| requirement-analyst | Requirements, assumptions, gaps, clarification questions | `test-plans/<app>/requirements.md` |
| scenario-designer | Risk-based scenario catalogue | `test-plans/<app>/scenarios.json` |
| excel-test-analyst | Build and refresh the workbook | `test-plans/<app>/<app>-e2e-scenarios.xlsx` |
| test-architect | POM, fixture, and data design | `test-plans/<app>/architecture.md` |
| playwright-implementer | Page objects, fixtures, specs, fixes | `pages/`, `tests/`, `fixtures/`, `test-data/` |
| test-executor | tsc, targeted, per-browser, and full-matrix runs; evidence | `artifacts/<app>/runs/<runId>/` |
| failure-investigator | Root-cause classification from evidence | fix prescriptions |
| quality-reviewer | Independent read-only review | Ready / Not ready verdict |
| delivery-reporter | Final 15-section report | First sheet "Delivery Report" of `test-plans/<app>/<app>-e2e-scenarios.xlsx` |

Supporting tools:

```powershell
# Read-only discovery (no form submits, skips logout/delete-style links)
node scripts/explore-app.mjs --url https://example.com --app my-app --max-pages 12

# Scenario catalogue -> Excel (validate, merge results, build)
node scripts/workbook.mjs validate --app my-app
node scripts/workbook.mjs sync --app my-app
node scripts/workbook.mjs build --app my-app

# Run an app on all three browsers and refresh its workbook
.\scripts\run-e2e.ps1 -App my-app -BaseUrl https://example.com

# Debug a single browser or scenario
.\scripts\run-e2e.ps1 -App my-app -BaseUrl https://example.com -Browsers firefox -Grep "\[MYA-004\]" -Headed

# Open the HTML report of a run (the runner prints the run folder)
npx playwright show-report artifacts/my-app/runs/<runId>/report

# Type-check
npx tsc --noEmit
```

Test titles start with their scenario ID, for example
`test('[MYA-001] signs in', ...)`. This links each Playwright result to its
row in the workbook. The catalogue format is described in
`.claude/skills/e2e-agent/scenario-schema.md`.

## Credentials file (JSON or Excel)

Put login, registration, and other accounts in **one** file. The agent and
the tests extract them from there, and you never type them into chat.

1. Copy a template from `templates/`:
   - `credentials.example.json` to `credentials/credentials.json`, or
   - `credentials.example.xlsx` to `credentials/credentials.xlsx`

   Alternatively, keep the file outside this OneDrive-synced folder and set
   `$env:CREDENTIALS_FILE = 'D:\secure\credentials.xlsx'` before starting
   Claude Code, or pass `-AccountsFile` to `run-e2e.ps1`.
2. Fill one entry per application and role:

   ```json
   {
     "my-app": {
       "existingUser": { "email": "me@example.com", "password": "..." },
       "newUser": { "firstName": "QA", "lastName": "Bot", "email": "qa+{timestamp}@example.com", "password": "..." }
     }
   }
   ```

   In Excel, use one row per role, with the columns `App | Role | Email |
   Password | First Name | ...`. Add any field as a new column.
   `{timestamp}` and `{random}` make registration data unique on every run.
3. Check it. This prints masked values only:

   ```powershell
   node scripts/credentials.mjs check --app my-app
   ```

`credentials/`, `credentials.json`, and `credentials.xlsx` are git-ignored,
and `.claude/settings.json` blocks Claude from reading or editing
`credentials/`. In CI, supply the JSON through the `CREDENTIALS_JSON`
secret. A single field can be overridden with `E2E_<APP>_<ROLE>_<FIELD>`.
