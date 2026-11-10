# Reporting and Artifact Guide

## Output structure

Every run is saved in its own folder, so earlier runs are never overwritten:

```text
artifacts/
└── <app>/
    ├── latest.json                    # points to the newest run
    ├── discovery/                     # explorer output (discovery.json, screens/, probes/)
    ├── html-reports/
    │   └── <YYYY-MM-DD_HH-mm-ss>.zip  # permanent copy of each run's HTML report (never pruned)
    └── runs/
        └── <YYYY-MM-DD_HH-mm-ss>/     # one folder per run (UTC)
            ├── summary.md             # pass/fail per browser + per-test table with screenshot links
            ├── screenshots/
            │   ├── chromium/<ID>_<title>_<status>_<n>.png
            │   ├── firefox/...
            │   └── webkit/...
            ├── report/                # Playwright HTML report
            ├── test-results/          # raw per-test output: screenshots, trace.zip and video.webm on failure
            └── results.json           # JSON results, synced into the Excel workbook
```

`playwright.config.ts` and `lib/artifact-reporter.ts` produce this layout
automatically for every run, whether started by `scripts/run-e2e.ps1` or by
`npx playwright test` with `TEST_SUITE=<app>`. Only the newest
`E2E_KEEP_RUNS` runs per app are kept (default 20). `artifacts/` is
git-ignored.

Each run's HTML report is also saved as `html-reports/<runId>.zip` (full report,
including failure traces and videos). Pruning only touches `runs/`, so these zips
are kept until deleted by hand. Set `E2E_ARCHIVE_REPORTS=0` to skip it. Open one with:

```powershell
Expand-Archive artifacts/<app>/html-reports/<runId>.zip -DestinationPath $env:TEMPeport-<runId>
npx playwright show-report $env:TEMPeport-<runId>
```

The zips stay git-ignored and should not be shared unedited: screenshots of
signed-in pages can show account values.

## Configuration in use

```ts
outputDir: `${runDirectory}/test-results`,
reporter: [
  ['list'],
  ['html', { open: 'never', outputFolder: `${runDirectory}/report` }],
  ['json', { outputFile: `${runDirectory}/results.json` }],
  ['./lib/artifact-reporter.ts', { runDirectory, suiteDirectory, runId }]
],
use: {
  screenshot: 'on',              // every test, pass or fail
  trace: 'retain-on-failure',
  video: 'retain-on-failure'
}
```

## Running and reviewing

Run the suite with `scripts/run-e2e.ps1`. It prints the run folder at the
end. Then:

```powershell
# Newest run folder for an app
(Get-Content artifacts/<app>/latest.json | ConvertFrom-Json).runDirectory

# Open the HTML report of a run
npx playwright show-report artifacts/<app>/runs/<runId>/report

# Open a failure trace
npx playwright show-trace artifacts/<app>/runs/<runId>/test-results/<test-dir>/trace.zip
```

The Excel workbook's **Execution Results** sheet links each result to its
screenshot and its run's `summary.md`.

A report showing `0 passed` and `0 failed` usually means no tests were
discovered. Rerun the suite and confirm the console lists the expected test
count.
