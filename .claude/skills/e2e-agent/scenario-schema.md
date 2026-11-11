# Scenario catalogue schema (`test-plans/<app>/scenarios.json`)

`scenarios.json` is the single source of truth for the Excel workbook.
`scripts/workbook.mjs validate` enforces this schema.

```jsonc
{
  "app": "demo-web-shop",
  "baseUrl": "https://demowebshop.tricentis.com/",
  "code": "TC",                       // scenario ID prefix
  "scenarios": [
    {
      "id": "TC-01",                 // required, unique, stable: TC-NN
      "feature": "Authentication",     // required
      "journey": "Registered customer signs in",   // required (User Journey)
      "testType": "Positive",          // required: Positive | Negative | Validation | Boundary | Edge Case |
                                       //   Authentication | Authorization | Session | Persistence | Navigation |
                                       //   Error Handling | Accessibility | Responsive | Cross-Browser
      "priority": "High",              // required: High | Medium | Low
      "preconditions": "Existing account; signed out",
      "testData": "credentials: existingUser (email, password)",
      "steps": ["Open Log in", "Enter email and password", "Select Log in"],  // required
      "expected": "Header shows the account email and a Log out link",       // required, observable
      "browsers": ["chromium", "firefox", "webkit"],  // default: all three
      "scopeReason": "",               // REQUIRED when browsers is a subset: why, and what covers the others
      "automationStatus": "Planned",   // required: Automated | Planned | Manual | Blocked | Not Automatable
      "pageObject": "DemoWebShopLoginPage",
      "risk": "Login failure blocks every purchase",
      "requirementRef": "REQ-01",      // required: REQ-xx or ASSUMPTION-xx
      "executionStatus": "Not Run",    // Not Run | Passed | Failed | Flaky | Skipped | Partial | Blocked (set by sync)
      "failureNotes": "",              // required when Blocked; from failure-investigator evidence
      "specFile": "tests/demo-web-shop/login.spec.ts",
      "lastRun": "",                   // set by sync
      "lastRunNotes": ""               // set by sync
    }
  ],
  "testData": [
    { "key": "existingEmail", "source": "credentials:existingUser.email", "usedBy": ["TC-01"], "notes": "Pre-registered account" },
    { "key": "password", "source": "credentials:existingUser.password", "usedBy": ["TC-01"] },
    { "key": "newEmail", "value": "qa+<timestamp>@example.test", "source": "generated", "usedBy": ["TC-10"], "notes": "Unique per run" }
  ],
  "risks": [
    { "id": "R-01", "type": "Assumption", "description": "...", "impact": "High", "mitigation": "...", "scenarios": ["TC-01"], "status": "Open" }
    // type: Risk | Assumption | Ambiguity | Blocker | Discrepancy | Defect
  ],
  "executions": []                     // appended by `workbook.mjs sync`; do not edit by hand
}
```

## Linking tests to scenarios

Each Playwright test title starts with its scenario ID in brackets:

```ts
test('[TC-01] registered customer signs in', async ({ loginPage, existingUser }) => { ... });
```

`sync` maps results through this tag. `validate` fails when an `Automated`
scenario has no tagged test, and when a tagged test has no scenario.

## Execution status rollup (per scenario, latest run)

| Status | Meaning |
| --- | --- |
| Failed | failed on any browser |
| Flaky | passed only on retry on some browser |
| Skipped | skipped on every browser |
| Partial | a browser in its coverage was not run, or skipped on some browsers |
| Passed | passed on every browser in its coverage |
