#!/usr/bin/env node
// Scenario catalogue tooling for the E2E agent.
//
// test-plans/<app>/scenarios.json is the source of truth. This script:
//   validate  checks the catalogue against the schema and the test files
//   sync      merges the latest run's results.json (artifacts/<app>/latest.json ->
//             runs/<runId>/results.json) with screenshot links
//             into the catalogue's execution history and statuses
//   build     writes test-plans/<app>/<app>-e2e-scenarios.xlsx
//   review    prints the scenario review summary for the user (and what changed since the
//             last approval); the orchestrator shows it before implementing or running
//   approve   records the user's approval of the current scenarios (date + fingerprint)
//   scope     prints the execution scope as Markdown: why N of M scenarios run, what is
//             not automated, and which scenarios are browser-limited (with reasons)
//
// Usage: node scripts/workbook.mjs <validate|sync|build|scope|all> --app <name>
// Schema: .claude/skills/e2e-agent/scenario-schema.md

import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BROWSERS = ['chromium', 'firefox', 'webkit'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const AUTOMATION = ['Automated', 'Planned', 'Manual', 'Blocked', 'Not Automatable'];
const EXECUTION = ['Not Run', 'Passed', 'Failed', 'Flaky', 'Skipped', 'Partial', 'Blocked'];
const TEST_TYPES = [
  'Positive', 'Negative', 'Validation', 'Boundary', 'Edge Case', 'Authentication', 'Authorization',
  'Session', 'Persistence', 'Navigation', 'Error Handling', 'Accessibility', 'Responsive', 'Cross-Browser'
];
const RISK_TYPES = ['Risk', 'Assumption', 'Ambiguity', 'Blocker', 'Discrepancy', 'Defect'];
// Defect log ("defects" in scenarios.json, "Defects" sheet).
const DEFECT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const DEFECT_STATUSES = ['New', 'Needs confirmation', 'Reported', 'In progress', 'Fixed', 'Verified', 'Closed', 'Rejected'];
const ID_PATTERN = /\[([A-Z][A-Z0-9]*-\d{2,})\]/;
const SECRET_HINT = /password|passwd|secret|token|api[-_]?key|bearer/i;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--app') args.app = rest[++i];
    else if (rest[i] === '--from') args.from = rest[++i];
    else if (rest[i] === '--print') args.print = true;
    else if (rest[i] === '--prefix') args.prefix = rest[++i];
    else if (rest[i] === '--digits') args.digits = Number(rest[++i]);
    else throw new Error(`Unknown argument: ${rest[i]}`);
  }
  if (!['validate', 'sync', 'build', 'scope', 'report', 'review', 'approve', 'rename-ids', 'all'].includes(command) || !args.app) {
    throw new Error('Usage: node scripts/workbook.mjs <validate|sync|build|scope|report|review|approve|rename-ids|all> --app <name> [--from report.md | --print] [--prefix TC --digits 2]');
  }
  if (command === 'report' && !args.from && !args.print) {
    throw new Error('report needs --from <file.md> (store the delivery report and rebuild) or --print (output the stored report)');
  }
  return args;
}

const paths = (app) => ({
  catalogue: path.join('test-plans', app, 'scenarios.json'),
  workbook: path.join('test-plans', app, `${app}-e2e-scenarios.xlsx`),
  results: path.join('artifacts', app, 'results.json'),
  tests: path.join('tests', app)
});

async function loadCatalogue(app) {
  const file = paths(app).catalogue;
  if (!existsSync(file)) throw new Error(`Missing ${file}. The Scenario Designer creates it.`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  data.scenarios ??= [];
  data.testData ??= [];
  data.risks ??= [];
  data.executions ??= [];
  data.defects ??= [];
  return data;
}

async function saveCatalogue(app, data) {
  await writeFile(paths(app).catalogue, `${JSON.stringify(data, null, 2)}\n`);
}

async function collectTestTitles(dir) {
  const found = new Map();
  if (!existsSync(dir)) return found;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.spec.ts')) continue;
    const file = path.join(entry.parentPath ?? entry.path, entry.name);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(new RegExp(ID_PATTERN.source, 'g'))) {
      const list = found.get(match[1]) ?? [];
      list.push(file.replaceAll('\\', '/'));
      found.set(match[1], list);
    }
  }
  return found;
}

// ---------- Scenario approval (user confirms the catalogue before implementation and runs) ----------

// Fields that define WHAT is tested. Status fields (automation/execution) are excluded so
// implementing or running a scenario does not invalidate its approval.
function scenarioFingerprint(s) {
  const def = {
    id: s.id, feature: s.feature, journey: s.journey, testType: s.testType, priority: s.priority,
    preconditions: s.preconditions ?? '', testData: s.testData ?? '', steps: s.steps ?? [],
    expected: s.expected, browsers: coverageOf(s)
  };
  return createHash('sha256').update(JSON.stringify(def)).digest('hex').slice(0, 16);
}

function approvalDiff(data) {
  const approved = data.approval?.scenarios ?? {};
  const current = Object.fromEntries(data.scenarios.map((s) => [s.id, scenarioFingerprint(s)]));
  return {
    approved: !!data.approval,
    added: Object.keys(current).filter((id) => !(id in approved)),
    changed: Object.keys(current).filter((id) => id in approved && approved[id] !== current[id]),
    removed: Object.keys(approved).filter((id) => !(id in current))
  };
}

const approvalPending = (d) => !d.approved || d.added.length || d.changed.length || d.removed.length;

function printReview(data) {
  const scope = executionScope(data);
  const diff = approvalDiff(data);
  const by = (key) => data.scenarios.reduce((m, s) => m.set(s[key], (m.get(s[key]) ?? 0) + 1), new Map());
  const lines = [
    '## Scenario review',
    '',
    `- **${data.scenarios.length} scenarios**: ${[...by('priority')].map(([k, v]) => `${v} ${k}`).join(', ')}.`,
    `- **Automation:** ${scope.automated.length} automated, ${data.scenarios.filter((s) => s.automationStatus === 'Planned').length} planned (not yet implemented), ${scope.notAutomated.filter((s) => s.automationStatus !== 'Planned').length} not automated (${scope.notAutomated.filter((s) => s.automationStatus !== 'Planned').map((s) => `${s.id} ${s.automationStatus}`).join(', ') || 'none'}).`,
    `- **Browsers:** a full run executes ${scope.expectedExecutions} tests (${BROWSERS.map((b) => `${b} ${scope.inScope(b).length}`).join(', ')}); ${scope.limited.length} scenarios run on fewer browsers by design.`,
    `- **Approval:** ${!diff.approved ? 'NOT YET APPROVED' : `approved ${data.approval.approvedAt} (${Object.keys(data.approval.scenarios).length} scenarios)`}` +
      (diff.approved ? `; since then ${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed` : '') + '.',
    ''
  ];
  if (diff.approved && (diff.added.length || diff.changed.length || diff.removed.length)) {
    lines.push('### Changes awaiting approval', '');
    for (const id of diff.added) { const s = data.scenarios.find((x) => x.id === id); lines.push(`- **Added** ${id} (${s.priority}) ${s.journey}`); }
    for (const id of diff.changed) { const s = data.scenarios.find((x) => x.id === id); lines.push(`- **Changed** ${id} (${s.priority}) ${s.journey}`); }
    for (const id of diff.removed) lines.push(`- **Removed** ${id}`);
    lines.push('');
  }
  lines.push('### Scenarios by feature', '', '| Feature | Scenarios | High | IDs |', '| --- | --- | --- | --- |');
  for (const [feature, n] of by('feature')) {
    const list = data.scenarios.filter((s) => s.feature === feature);
    lines.push(`| ${feature} | ${n} | ${list.filter((s) => s.priority === 'High').length} | ${list.map((s) => s.id).join(', ')} |`);
  }
  lines.push('', '### High-priority scenarios', '', '| ID | User journey | Type | Browsers |', '| --- | --- | --- | --- |');
  for (const s of data.scenarios.filter((x) => x.priority === 'High')) {
    lines.push(`| ${s.id} | ${s.journey} | ${s.testType} | ${coverageOf(s).length === BROWSERS.length ? 'all' : coverageOf(s).join(', ')} |`);
  }
  lines.push('', 'Full details (steps, expected results, test data): sheet "Scenario Catalogue" in the workbook.');
  console.log(lines.join(String.fromCharCode(10)));
}

async function validate(app, data) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const required = ['id', 'feature', 'journey', 'testType', 'priority', 'steps', 'expected', 'automationStatus', 'requirementRef'];
  for (const s of data.scenarios) {
    const where = s.id ?? '(missing id)';
    for (const key of required) if (s[key] === undefined || s[key] === '' || (Array.isArray(s[key]) && !s[key].length)) errors.push(`${where}: missing ${key}`);
    if (s.id && !/^[A-Z][A-Z0-9]*-\d{2,}$/.test(s.id)) errors.push(`${where}: id must look like TC-01`);
    if (ids.has(s.id)) errors.push(`${where}: duplicate id`);
    ids.add(s.id);
    if (s.priority && !PRIORITIES.includes(s.priority)) errors.push(`${where}: priority must be one of ${PRIORITIES.join(', ')}`);
    if (s.automationStatus && !AUTOMATION.includes(s.automationStatus)) errors.push(`${where}: automationStatus must be one of ${AUTOMATION.join(', ')}`);
    if (s.executionStatus && !EXECUTION.includes(s.executionStatus)) errors.push(`${where}: executionStatus must be one of ${EXECUTION.join(', ')}`);
    if (s.testType && !TEST_TYPES.includes(s.testType)) warnings.push(`${where}: non-standard testType "${s.testType}"`);
    for (const b of s.browsers ?? []) if (!BROWSERS.includes(b)) errors.push(`${where}: unknown browser ${b}`);
    if (s.priority === 'High' && !['Automated', 'Blocked'].includes(s.automationStatus)) {
      warnings.push(`${where}: High priority must be Automated or explicitly Blocked (is ${s.automationStatus})`);
    }
    if (['Blocked', 'Manual', 'Not Automatable'].includes(s.automationStatus) && !s.failureNotes) {
      errors.push(`${where}: ${s.automationStatus} requires failureNotes explaining why it is not automated`);
    }
    // Browser compatibility rule (all projects): every scenario runs on all browsers. A limit is only allowed
    // as a user-approved test-safety limit (side effects on shared data), and it is reported as an
    // unverified-compatibility gap. A site failure in a browser is a "Browser compatibility" defect and the
    // test keeps running (and failing) on that browser - it may never be used as a reason to limit coverage.
    if (s.automationStatus === 'Automated' && s.browsers?.length && s.browsers.length < BROWSERS.length) {
      if (!s.scopeReason) {
        errors.push(`${where}: runs on ${s.browsers.join(', ')} only; scopeReason must explain why`);
      } else if (!/^Test-safety limit/i.test(s.scopeReason)) {
        errors.push(`${where}: a browser limit must be a user-approved "Test-safety limit ..." (scopeReason); a site failure in a browser is a Browser compatibility defect, not a limit`);
      } else if (/DEF-\d+/.test(s.scopeReason)) {
        errors.push(`${where}: do not limit browsers because of a defect (${s.scopeReason.match(/DEF-\d+/)[0]}); keep the test on every browser so the defect stays visible`);
      }
    }
  }
  for (const d of data.testData) {
    if (d.value && SECRET_HINT.test(`${d.key} ${d.notes ?? ''}`)) {
      errors.push(`testData ${d.key}: secret-like data must use source "credentials:<role>.<field>" or "env:VAR" and no literal value`);
    }
  }
  for (const r of data.risks) if (r.type && !RISK_TYPES.includes(r.type)) warnings.push(`risk ${r.id}: non-standard type "${r.type}"`);

  const riskIds = new Set(data.risks.map((r) => r.id));
  const defectIds = new Set();
  for (const d of data.defects) {
    const where = `defect ${d.id ?? '(no id)'}`;
    if (!d.id) errors.push(`${where}: missing id`);
    else if (defectIds.has(d.id)) errors.push(`${where}: duplicate id`);
    defectIds.add(d.id);
    for (const field of ['title', 'severity', 'status', 'expected', 'actual']) if (!d[field]) errors.push(`${where}: missing ${field}`);
    if (!d.steps?.length) errors.push(`${where}: missing steps to reproduce`);
    if (d.severity && !DEFECT_SEVERITIES.includes(d.severity)) errors.push(`${where}: severity must be one of ${DEFECT_SEVERITIES.join(', ')}`);
    if (d.status && !DEFECT_STATUSES.includes(d.status)) errors.push(`${where}: status must be one of ${DEFECT_STATUSES.join(', ')}`);
    if (d.riskRef && !riskIds.has(d.riskRef)) errors.push(`${where}: riskRef ${d.riskRef} is not in the risk register`);
    for (const sid of d.scenarios ?? []) if (!ids.has(sid)) errors.push(`${where}: unknown scenario ${sid}`);
    if (d.failingScenario && !(d.scenarios ?? []).includes(d.failingScenario)) {
      errors.push(`${where}: failingScenario ${d.failingScenario} must be one of its scenarios`);
    }
  }

  const titles = await collectTestTitles(paths(app).tests);
  for (const s of data.scenarios) {
    const files = titles.get(s.id);
    if (s.automationStatus === 'Automated' && !files) errors.push(`${s.id}: marked Automated but no test title contains [${s.id}] under ${paths(app).tests}`);
    if (files && s.automationStatus !== 'Automated') warnings.push(`${s.id}: test exists (${files[0]}) but automationStatus is ${s.automationStatus}`);
    if (files && files.length > 1) errors.push(`${s.id}: referenced by ${files.length} test titles; each scenario must map to exactly one test`);
    // A status may only be what the merged execution rows support (no hand-edited "Passed").
    const computed = computeStatus(s, data.executions).status;
    if ((s.executionStatus ?? 'Not Run') !== computed) {
      errors.push(`${s.id}: executionStatus "${s.executionStatus ?? 'Not Run'}" is not backed by execution rows (computed "${computed}"); run sync`);
    }
  }
  for (const [id, files] of titles) if (!ids.has(id)) errors.push(`${files[0]}: test tag [${id}] has no catalogue scenario`);

  const diff = approvalDiff(data);
  if (approvalPending(diff)) {
    warnings.push(!diff.approved
      ? 'scenarios are not approved by the user yet (run the review gate, then `workbook.mjs approve`)'
      : `scenarios changed since user approval (${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed): ${[...diff.added, ...diff.changed, ...diff.removed].join(', ')}`);
  }
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`validate: ${data.scenarios.length} scenarios, ${errors.length} errors, ${warnings.length} warnings`);
  return errors.length === 0;
}

function stripAnsi(text) {
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

function flattenSpecs(suite, out = []) {
  for (const spec of suite.specs ?? []) out.push(spec);
  for (const child of suite.suites ?? []) flattenSpecs(child, out);
  return out;
}

const STATUS_MAP = { expected: 'Passed', unexpected: 'Failed', flaky: 'Flaky', skipped: 'Skipped' };

// Newest run: artifacts/<app>/latest.json -> runs/<runId>/results.json (legacy: artifacts/<app>/results.json).
async function resolveResults(app) {
  const pointer = path.join('artifacts', app, 'latest.json');
  if (existsSync(pointer)) {
    const { runDirectory } = JSON.parse(await readFile(pointer, 'utf8'));
    const file = path.join(runDirectory, 'results.json');
    if (existsSync(file)) return file;
  }
  return paths(app).results;
}

const toRepoPath = (p) => (p ? path.relative(process.cwd(), p).replaceAll('\\', '/') : '');

const SEVERITY = { Failed: 4, Flaky: 3, Skipped: 2, Passed: 1 };
const coverageOf = (s) => (s.browsers?.length ? s.browsers : BROWSERS);

// Latest result per covered browser across all merged runs (suites are often run in several
// passes). For each browser the newest runAt wins, and within that run the WORST row wins,
// so --repeat-each or duplicate [ID] titles can never hide a failure. Browsers outside the
// scenario's coverage (e.g. intentional skips of a chromium-only test) are ignored.
function latestPerBrowser(s, executions) {
  const coverage = coverageOf(s);
  const newest = new Map();
  for (const e of executions) {
    if (e.scenarioId !== s.id || !coverage.includes(e.browser)) continue;
    const runAt = newest.get(e.browser);
    if (!runAt || e.runAt > runAt) newest.set(e.browser, e.runAt);
  }
  const latest = new Map();
  for (const [browser, runAt] of newest) {
    const rows = executions.filter((e) => e.scenarioId === s.id && e.browser === browser && e.runAt === runAt);
    latest.set(browser, rows.reduce((worst, r) => ((SEVERITY[r.status] ?? 5) > (SEVERITY[worst.status] ?? 5) ? r : worst)));
  }
  return latest;
}

function computeStatus(s, executions) {
  const coverage = coverageOf(s);
  const latest = latestPerBrowser(s, executions);
  if (!latest.size) return { status: 'Not Run', notes: '', lastRun: '' };
  const results = [...latest.values()];
  const statuses = new Set(results.map((r) => r.status));
  const missing = coverage.filter((b) => !latest.has(b));
  let status;
  if (statuses.has('Failed')) status = 'Failed';
  else if (statuses.has('Flaky')) status = 'Flaky';
  else if (statuses.size === 1 && statuses.has('Skipped') && !missing.length) status = 'Skipped';
  else if (missing.length || statuses.has('Skipped')) status = 'Partial';
  else status = 'Passed';
  const notes = results.filter((r) => r.status !== 'Passed').map((r) => `${r.browser}: ${r.status}${r.error ? ` - ${r.error}` : ''}`);
  if (missing.length) notes.push(`not run on: ${missing.join(', ')}`);
  return { status, notes: notes.join(' | '), lastRun: results.map((r) => r.runAt).sort().at(-1) };
}

// Which scenarios run where, and which do not run at all (used by the workbook and the CLI).
function executionScope(data) {
  const automated = data.scenarios.filter((s) => s.automationStatus === 'Automated');
  const notAutomated = data.scenarios.filter((s) => s.automationStatus !== 'Automated');
  const limited = automated.filter((s) => coverageOf(s).length < BROWSERS.length);
  const inScope = (b) => automated.filter((s) => coverageOf(s).includes(b));
  return {
    total: data.scenarios.length,
    automated,
    notAutomated,
    limited,
    inScope,
    expectedExecutions: BROWSERS.reduce((n, b) => n + inScope(b).length, 0)
  };
}

const firstSentence = (text) => {
  const t = String(text ?? '').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).slice(0, 160);
};

// Markdown explanation of the execution scope, for delivery reports and agent summaries.
function printScope(data) {
  const scope = executionScope(data);
  const lines = [
    '## Execution scope',
    '',
    `- **${scope.automated.length} of ${scope.total}** scenarios are automated and run. ${scope.notAutomated.length} are not automated.`,
    `- A full run executes **${scope.expectedExecutions}** tests: ${BROWSERS.map((b) => `${b} ${scope.inScope(b).length}`).join(', ')}.`,
    ''
  ];
  if (scope.notAutomated.length) {
    lines.push('### Not automated (not run)', '', '| Scenario | Priority | Status | Reason |', '| --- | --- | --- | --- |');
    for (const s of scope.notAutomated) lines.push(`| ${s.id} ${s.journey} | ${s.priority} | ${s.automationStatus} | ${String(s.failureNotes ?? '').replaceAll('|', '/')} |`);
    lines.push('');
  }
  if (scope.limited.length) {
    lines.push('### Browser-limited by design', '', '| Scenario | Priority | Runs on | Not run on | Reason |', '| --- | --- | --- | --- | --- |');
    for (const s of scope.limited) {
      const not = BROWSERS.filter((b) => !coverageOf(s).includes(b)).join(', ');
      lines.push(`| ${s.id} ${s.journey} | ${s.priority} | ${coverageOf(s).join(', ')} | ${not} | ${String(s.scopeReason ?? '').replaceAll('|', '/')} |`);
    }
    lines.push('');
    lines.push(`Skipped results for these scenarios on other browsers are expected and are not failures.`);
  }
  console.log(lines.join(String.fromCharCode(10)));
}

function rollup(data) {
  for (const s of data.scenarios) {
    const { status, notes, lastRun } = computeStatus(s, data.executions);
    s.executionStatus = status;
    s.lastRunNotes = notes;
    s.lastRun = lastRun;
  }
}

// Never store e-mail addresses (e.g. the signed-in header link quoted in an error) in the tracked catalogue.
const redact = (text) => text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');

async function sync(app, data) {
  const file = await resolveResults(app);
  if (!existsSync(file)) throw new Error(`Missing ${file}. Run tests with TEST_SUITE=${app} first.`);
  const report = JSON.parse(await readFile(file, 'utf8'));
  const runAt = report.stats?.startTime ?? new Date().toISOString();
  if (data.executions.some((e) => e.runAt === runAt)) {
    console.log(`sync: run ${runAt} already merged (statuses recomputed)`);
    rollup(data);
    return;
  }
  const rows = [];
  const untagged = [];
  for (const spec of (report.suites ?? []).flatMap((s) => flattenSpecs(s))) {
    const id = spec.title.match(ID_PATTERN)?.[1];
    for (const t of spec.tests ?? []) {
      const last = t.results?.at(-1);
      const row = {
        runAt,
        scenarioId: id ?? null,
        browser: t.projectName,
        status: STATUS_MAP[t.status] ?? t.status,
        attempts: t.results?.length ?? 0,
        durationMs: last?.duration ?? null,
        testTitle: spec.title,
        file: spec.file,
        error: redact(stripAnsi(last?.error?.message ?? '').split('\n').slice(0, 4).join(' ')).slice(0, 600),
        screenshot: toRepoPath((last?.attachments ?? []).filter((a) => a.contentType?.startsWith('image/') && a.path).at(-1)?.path),
        runDirectory: toRepoPath(path.dirname(file))
      };
      if (id) rows.push(row);
      else untagged.push(row);
    }
  }
  data.executions.push(...rows);
  rollup(data);

  const known = new Set(data.scenarios.map((s) => s.id));
  const orphan = [...new Set(rows.filter((r) => !known.has(r.scenarioId)).map((r) => r.scenarioId))];
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log(`sync: run ${runAt}: ${JSON.stringify(counts)}`);
  if (orphan.length) console.log(`WARN  results for unknown scenario ids: ${orphan.join(', ')}`);
  if (untagged.length) console.log(`WARN  ${untagged.length} results without a [ID] tag in the title were not merged`);
}

// ---------- Excel ----------

const COLORS = {
  header: 'FF1F3864', headerText: 'FFFFFFFF', band: 'FFF2F5FA', border: 'FFD0D7E2',
  Critical: 'FFFF9999', High: 'FFF8CBAD', Medium: 'FFFFE699', Low: 'FFE2EFDA',
  Passed: 'FFC6EFCE', Failed: 'FFFFC7CE', Flaky: 'FFFFEB9C', Skipped: 'FFEDEDED', Partial: 'FFFFEB9C', Blocked: 'FFD9D2E9', 'Not Run': 'FFFFFFFF'
};

function styleSheet(ws, widths, { wrap = true } = {}) {
  ws.columns.forEach((col, i) => { col.width = widths[i] ?? 18; });
  const header = ws.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  ws.eachRow((row, n) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = ['top', 'left', 'bottom', 'right'].reduce((b, side) => ({ ...b, [side]: { style: 'thin', color: { argb: COLORS.border } } }), {});
      if (n > 1) {
        cell.alignment = { vertical: 'top', wrapText: wrap };
        if (n % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.band } };
      }
    });
  });
}

function tint(cell) {
  const argb = COLORS[cell.value];
  if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function addTable(ws, headers, rows, widths) {
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  styleSheet(ws, widths);
}

// ---------- Delivery report sheet (Markdown -> formatted worksheet) ----------

const REPORT_COLS = [28, 34, 24, 22, 22, 22, 22, 26]; // 8 columns, ~200 characters wide in total
const REPORT_WIDTH = REPORT_COLS.length;
const MONO = 'Consolas';

// Inline Markdown -> Excel rich text: **bold**, `code`, [text](link); escaped pipes restored.
function richText(md, base = {}) {
  const text = String(md).replace(/\\\|/g, '|').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), font: { ...base } });
    const token = m[0];
    if (token.startsWith('**')) runs.push({ text: token.slice(2, -2), font: { ...base, bold: true } });
    else runs.push({ text: token.slice(1, -1), font: { ...base, name: MONO, color: { argb: 'FF7A3E00' } } });
    last = m.index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), font: { ...base } });
  return runs.length ? { richText: runs } : '';
}

const plain = (md) => String(md).replace(/\\\|/g, '|').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '');

// Wrapped text does not auto-size reliably in files written by libraries, so estimate the height.
function rowHeight(texts, widths) {
  let lines = 1;
  texts.forEach((t, i) => {
    const perLine = Math.max(8, Math.floor((widths[i] ?? 20) * 1.08));
    const n = String(t ?? '').split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)), 0);
    lines = Math.max(lines, n);
  });
  return Math.min(409, Math.max(16, lines * 15 + 3));
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

// Plain-language summary of what ran, what did not, and why - short lines, grouped by scenario.
function plainScopeLines(data, scope, notRun) {
  const lines = [];
  const all = BROWSERS.length;
  const browserList = (list) => (list.length === all ? `all ${all} browsers` : list.join(', '));
  const cap = (b) => b.charAt(0).toUpperCase() + b.slice(1);

  // Scenarios
  if (!scope.notAutomated.length) {
    lines.push(`• **Scenarios:** all ${scope.total} scenarios are automated.`);
  } else {
    lines.push(`• **Scenarios:** ${scope.automated.length} of ${scope.total} are automated. Not automated: ` +
      scope.notAutomated.map((s) => `${s.id} (${s.automationStatus.toLowerCase()})`).join(', ') + '.');
  }

  // Browsers
  if (!scope.limited.length) {
    lines.push(`• **Browsers:** every scenario runs on Chromium, Firefox and WebKit, so a full run is **${scope.expectedExecutions} tests**.`);
  } else {
    lines.push(`• **Browsers:** ${scope.automated.length - scope.limited.length} scenarios run on all ${all} browsers. ` +
      `${scope.limited.length} run${scope.limited.length === 1 ? 's' : ''} on fewer browsers to protect shared test data: ` +
      scope.limited.map((s) => `${s.id} (${s.browsers.map(cap).join(', ')} only)`).join(', ') +
      `. Their compatibility on the other browsers is **not checked yet**. A full run is **${scope.expectedExecutions} tests**.`);
  }

  // Latest results, grouped by scenario
  const problems = notRun.filter((r) => !['Not automated', 'Out of scope by design'].includes(r.category));
  const passed = scope.expectedExecutions - problems.length;
  if (!problems.length) {
    lines.push(`• **Latest results:** all ${scope.expectedExecutions} tests passed.`);
    return lines;
  }
  lines.push(`• **Latest results:** ${passed} of ${scope.expectedExecutions} tests passed; ${problems.length} did not.`);
  const byScenario = new Map();
  for (const r of problems) {
    const g = byScenario.get(r.id) ?? { id: r.id, journey: r.journey, browsers: [], defects: new Set(), categories: new Set() };
    g.browsers.push(r.browser);
    g.categories.add(r.category);
    for (const d of String(r.reason ?? '').match(/DEF-\d+/g) ?? []) g.defects.add(d);
    byScenario.set(r.id, g);
  }
  const groups = [...byScenario.values()];
  const defectChecks = groups.filter((g) => g.defects.size && [...g.categories].every((c) => c === 'Failed in latest run'));
  const others = groups.filter((g) => !defectChecks.includes(g));
  if (defectChecks.length) {
    lines.push(`• **Failed because of open defects:** ${defectChecks.length} scenario${defectChecks.length === 1 ? '' : 's'} ` +
      `check bugs that are still open, so they fail until the bug is fixed. See the "Defects" sheet.`);
    for (const g of defectChecks) {
      lines.push(`    – ${g.id} ${g.journey}: checks ${[...g.defects].join(', ')} – fails on ${browserList(g.browsers)}`);
    }
  }
  if (others.length) {
    lines.push(`• **Needs investigation:** ${others.length} scenario${others.length === 1 ? '' : 's'} did not pass for another reason:`);
    for (const g of others) {
      lines.push(`    – ${g.id} ${g.journey}: ${[...g.categories].join(', ').toLowerCase()} on ${browserList(g.browsers)}`);
    }
  }
  lines.push('• Per-browser detail with filters: sheet "Not Executed".');
  return lines;
}

function addDeliveryReportSheet(wb, app, data, md) {
  const ws = wb.addWorksheet('Delivery Report', { properties: { tabColor: { argb: 'FF1F3864' } } });
  ws.columns = REPORT_COLS.map((width) => ({ width }));
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const border = { style: 'thin', color: { argb: COLORS.border } };
  const fullWidth = REPORT_COLS.reduce((a, b) => a + b, 0);

  const mergedRow = (value, { font, fill, height, indent = 0, wrap = true } = {}) => {
    const row = ws.addRow([]);
    ws.mergeCells(row.number, 1, row.number, REPORT_WIDTH);
    const cell = row.getCell(1);
    cell.value = value;
    cell.alignment = { vertical: 'top', wrapText: wrap, indent };
    if (font) cell.font = font;
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    row.height = height ?? rowHeight([plain(typeof value === 'string' ? value : (value.richText ?? []).map((r) => r.text).join(''))], [fullWidth - indent * 2]);
    return row;
  };

  // ---- Live summary dashboard, computed from scenarios.json so it is always current ----
  const scope = executionScope(data);
  const verdict = md.match(/Overall Automation Readiness[\s\S]*?\*\*([^*]+)\*\*/)?.[1] ?? 'See section 14';
  const latestRun = data.executions.map((e) => e.runAt).sort().at(-1) ?? 'Not run';
  const openRisks = data.risks.filter((r) => (r.status ?? 'Open') === 'Open').length;
  const byStatus = (st) => data.scenarios.filter((s) => (s.executionStatus ?? 'Not Run') === st).length;

  mergedRow(`E2E Delivery Report: ${app}`, { font: { bold: true, size: 18, color: { argb: COLORS.header } }, height: 30 });
  mergedRow(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from scenarios.json. The summary and "Not executed and why" are computed live from the latest results; the numbered sections after them are the delivery report.`,
    { font: { italic: true, color: { argb: 'FF595959' } } });
  ws.addRow([]);

  const kpis = [
    ['Readiness verdict', verdict],
    ['Scenarios', `${data.scenarios.length} in catalogue: ${scope.automated.length} automated, ${scope.notAutomated.length} not automated (${scope.notAutomated.map((s) => `${s.id} ${s.automationStatus}`).join(', ') || 'none'})`],
    ['Execution status', `${byStatus('Passed')} Passed, ${byStatus('Failed')} Failed, ${byStatus('Flaky')} Flaky, ${byStatus('Partial')} Partial, ${byStatus('Not Run')} Not Run`],
    ...BROWSERS.map((b) => {
      const covered = scope.inScope(b);
      const st = covered.map((s) => latestPerBrowser(s, data.executions).get(b)?.status ?? 'Not run');
      const n = (x) => st.filter((y) => y === x).length;
      return [`${b[0].toUpperCase()}${b.slice(1)}`, `${n('Passed')} passed, ${n('Failed')} failed, ${n('Flaky')} flaky, ${n('Not run')} not run; ${scope.automated.length - covered.length} out of scope by design (of ${scope.automated.length} automated)`];
    }),
    ['Why counts differ', (!scope.limited.length && !scope.notAutomated.length)
      ? 'They do not: every scenario is automated and runs on all 3 browsers.'
      : `${scope.notAutomated.length} scenario(s) not automated, ${scope.limited.length} run on fewer browsers to protect shared test data. See "Not executed and why" below.`],
    ['Latest run', latestRun],
    ['Open risks', `${openRisks} of ${data.risks.length} (see "Risks and Assumptions")`],
    ['Defects', defectSummary(data.defects)]
  ];
  const kpiHeader = ws.addRow(['Summary', 'Value']);
  ws.mergeCells(kpiHeader.number, 2, kpiHeader.number, REPORT_WIDTH);
  kpiHeader.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } }; });
  for (const [k, v] of kpis) {
    const row = ws.addRow([k, v]);
    ws.mergeCells(row.number, 2, row.number, REPORT_WIDTH);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).alignment = { vertical: 'top' };
    for (let c = 1; c <= REPORT_WIDTH; c += 1) row.getCell(c).border = { top: border, left: border, bottom: border, right: border };
    if (k === 'Readiness verdict') {
      const good = /^ready$/i.test(v.trim());
      const limited = /limitations/i.test(v);
      row.getCell(2).font = { bold: true, size: 12, color: { argb: good ? 'FF006100' : limited ? 'FF7F6000' : 'FF9C0006' } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: good ? COLORS.Passed : limited ? COLORS.Flaky : COLORS.Failed } };
    }
    row.height = rowHeight([v], [fullWidth - REPORT_COLS[0]]);
  }
  ws.addRow([]);

  // ---- Not executed and why (compact, one row per scenario; full per-browser detail on "Not Executed") ----
  const notRun = notExecutedRows(data, scope);
  const possible = data.scenarios.length * BROWSERS.length;
  const problems = notRun.filter((r) => !['Not automated', 'Out of scope by design'].includes(r.category));
  mergedRow('Not executed and why', { font: { bold: true, size: 13, color: { argb: COLORS.headerText } }, fill: COLORS.header, height: 24 });
  for (const line of plainScopeLines(data, scope, notRun)) mergedRow(richText(line), { indent: 1 });
  const grouped = new Map();
  for (const r of notRun) {
    const key = `${r.id}|${r.category}`;
    const g = grouped.get(key) ?? { ...r, browsers: [] };
    g.browsers.push(r.browser);
    grouped.set(key, g);
  }
  const neHeader = ws.addRow(['Scenario', 'User Journey', 'Priority', 'Category', 'Not run on', 'Reason', '', 'Action']);
  ws.mergeCells(neHeader.number, 6, neHeader.number, 7);
  neHeader.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } }; });
  for (const g of grouped.values()) {
    const row = ws.addRow([g.id, g.journey, g.priority, g.category, g.browsers.join(', '), g.reason, '', g.action]);
    ws.mergeCells(row.number, 6, row.number, 7);
    for (let c = 1; c <= REPORT_WIDTH; c += 1) {
      const cell = row.getCell(c);
      cell.alignment = { wrapText: true, vertical: 'top' };
      cell.border = { top: border, left: border, bottom: border, right: border };
    }
    tint(row.getCell(3));
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOT_EXECUTED_FILL[g.category] ?? COLORS.band } };
    row.height = rowHeight([g.id, g.journey, g.priority, g.category, g.browsers.join(', '), g.reason, g.action],
      [REPORT_COLS[0], REPORT_COLS[1], REPORT_COLS[2], REPORT_COLS[3], REPORT_COLS[4], REPORT_COLS[5] + REPORT_COLS[6], REPORT_COLS[7]]);
  }
  ws.addRow([]);

  // ---- Render the Markdown report ----
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let firstTitleSkipped = false;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---') { i += 1; continue; }

    if (trimmed.startsWith('```')) {
      const block = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) block.push(lines[i++]);
      i += 1;
      for (const codeLine of block) {
        mergedRow(codeLine || ' ', { font: { name: MONO, size: 10 }, fill: 'FFF2F2F2', wrap: true });
      }
      ws.addRow([]);
      continue;
    }

    if (trimmed.startsWith('|')) {
      const block = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) block.push(lines[i++]);
      const rows = block.filter((l) => !/^\|\s*:?-{3,}/.test(l.trim())).map(splitTableRow);
      const cols = Math.min(REPORT_WIDTH, Math.max(...rows.map((r) => r.length)));
      // Give the last table column the remaining width so long text has room.
      const widths = REPORT_COLS.slice(0, cols);
      widths[cols - 1] = REPORT_COLS.slice(cols - 1).reduce((a, b) => a + b, 0);
      rows.forEach((cells, r) => {
        const row = ws.addRow([]);
        for (let c = 0; c < cols; c += 1) {
          const cell = row.getCell(c + 1);
          const value = cells[c] ?? '';
          cell.value = r === 0 ? plain(value) : richText(value);
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = { top: border, left: border, bottom: border, right: border };
          if (r === 0) {
            cell.font = { bold: true, color: { argb: COLORS.headerText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
          } else if (r % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.band } };
          }
          // Colour well-known status words.
          const p = plain(value).trim();
          if (r > 0 && COLORS[p]) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[p] } };
        }
        if (cols < REPORT_WIDTH) {
          ws.mergeCells(row.number, cols, row.number, REPORT_WIDTH);
          row.getCell(cols).border = { top: border, left: border, bottom: border, right: border };
        }
        row.height = rowHeight(cells.slice(0, cols).map(plain), widths);
      });
      ws.addRow([]);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = plain(heading[2]);
      if (level === 1) {
        // The dashboard already carries the title; keep only the first H1 out.
        if (firstTitleSkipped) mergedRow(text, { font: { bold: true, size: 16, color: { argb: COLORS.header } }, height: 26 });
        firstTitleSkipped = true;
      } else if (level === 2) {
        ws.addRow([]);
        mergedRow(text, { font: { bold: true, size: 13, color: { argb: COLORS.headerText } }, fill: COLORS.header, height: 24 });
      } else if (level === 3) {
        mergedRow(text, { font: { bold: true, size: 11, color: { argb: COLORS.header } }, fill: 'FFD9E1F2', height: 20 });
      } else {
        mergedRow(text, { font: { bold: true, italic: true, color: { argb: COLORS.header } }, height: 18 });
      }
      i += 1;
      continue;
    }

    const bullet = line.match(/^(\s*)(?:[-*]|(\d+)\.)\s+(.*)$/);
    if (bullet) {
      const depth = Math.floor(bullet[1].length / 2);
      const marker = bullet[2] ? `${bullet[2]}. ` : depth ? '◦ ' : '• ';
      const value = richText(marker + bullet[3]);
      mergedRow(value, { indent: 1 + depth * 2 });
      i += 1;
      continue;
    }

    // Paragraph: join soft-wrapped lines.
    const para = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(\s*([-*]|\d+\.)\s|#|\||```|---)/.test(lines[i])) para.push(lines[i++].trim());
    mergedRow(richText(para.join(' ')));
  }
  return ws;
}

// ---------- "Not Executed" sheet: full accounting of every scenario x browser that did not run or did not pass ----------

const NOT_EXECUTED_FILL = {
  'Not automated': 'FFD9D2E9',
  'Out of scope by design': 'FFEDEDED',
  'Failed in latest run': COLORS.Failed,
  'Flaky in latest run': COLORS.Flaky,
  'Skipped (should have run)': COLORS.Failed,
  'Never run (should have run)': COLORS.Failed
};

function readableReason(reason, category) {
  const value = String(reason ?? '').trim();
  if (!value) return 'Reason not recorded.';

  if (category === 'Out of scope by design') {
    const match = value.match(/^([^:]+):\s*(.*)$/s);
    if (match) return `Coverage: ${match[1].trim()}\nReason: ${match[2].trim()}`;
    return `Coverage decision: ${value}`;
  }

  if (category === 'Not automated') {
    const match = value.match(/^([^:]+):\s*(.*)$/s);
    if (match) return `Status: ${match[1].trim()}\nDetails: ${match[2].trim()}`;
    return `Status: ${value}`;
  }

  return value
    .replace(/\.\s+(?=[A-Z])/g, '.\n')
    .replace(/;\s+(?=[A-Z])/g, ';\n');
}

// Every (scenario, browser) pair that is not an executed Passed result, with category, reason and action.
function notExecutedRows(data, scope) {
  const rows = [];
  for (const s of data.scenarios) {
    const coverage = coverageOf(s);
    const latest = s.automationStatus === 'Automated' ? latestPerBrowser(s, data.executions) : new Map();
    for (const b of BROWSERS) {
      const base = { id: s.id, journey: s.journey, priority: s.priority, browser: b, ref: s.requirementRef ?? '' };
      if (s.automationStatus !== 'Automated') {
        rows.push({
          ...base,
          category: 'Not automated',
          detail: s.automationStatus,
          reason: readableReason(s.failureNotes, 'Not automated'),
          coverage: 'None',
          action: s.automationStatus === 'Blocked' ? 'Remove the blocker described in the reason, then automate'
            : s.automationStatus === 'Manual' ? 'Run manually, or automate once the missing dependency is approved'
              : s.automationStatus === 'Planned' ? 'Implement the test'
                : 'Run manually; automation is not feasible'
        });
      } else if (!coverage.includes(b)) {
        rows.push({
          ...base,
          category: 'Out of scope by design',
          detail: `Runs on ${coverage.join(', ')} only`,
          reason: readableReason(s.scopeReason, 'Out of scope by design'),
          coverage: `Runs on ${coverage.join(', ')}`,
          action: 'None: intentional, not a failure'
        });
      } else {
        const r = latest.get(b);
        const status = r?.status;
        if (status === 'Passed') continue;
        const category = !r ? 'Never run (should have run)'
          : status === 'Failed' ? 'Failed in latest run'
            : status === 'Flaky' ? 'Flaky in latest run'
              : 'Skipped (should have run)';
        rows.push({
          ...base,
          category,
          detail: r ? `${status} on ${r.runAt}` : 'No result recorded',
          reason: readableReason(
            r?.error || (r ? 'Skipped although the browser is in this scenario\'s coverage' : 'Not executed in any synced run'),
            category
          ),
          coverage: '',
          action: !r ? 'Run the suite and sync the workbook'
            : status === 'Failed' && knownDefects(data, s.id).length
              ? `Defect ${knownDefects(data, s.id).join(', ')}: the test checks the correct behaviour and fails until the site is fixed (see "Defects")`
            : status === 'Failed' ? 'Investigate the failure (screenshot link in "Execution Results")'
              : status === 'Flaky' ? 'Investigate the instability; it passed only on retry'
                : 'Check why it was skipped (see the run\'s summary.md "Not run in this run")'
        });
      }
    }
  }
  return rows;
}

function addNotExecutedSheet(wb, data, scope) {
  const ws = wb.addWorksheet('Not Executed', { properties: { tabColor: { argb: 'FF7030A0' } } });
  const widths = [12, 38, 10, 11, 28, 26, 70, 30, 36, 14];
  ws.columns = widths.map((width) => ({ width }));
  ws.views = [{ showGridLines: false }];
  const span = widths.length;
  const fullWidth = widths.reduce((a, b) => a + b, 0);
  const border = { style: 'thin', color: { argb: COLORS.border } };
  const rows = notExecutedRows(data, scope);
  const count = (c) => rows.filter((r) => r.category === c).length;
  const problems = rows.filter((r) => !['Not automated', 'Out of scope by design'].includes(r.category));
  const possible = data.scenarios.length * BROWSERS.length;
  const notAutomatedPairs = scope.notAutomated.length * BROWSERS.length;
  const outOfScopePairs = scope.limited.reduce((n, s) => n + (BROWSERS.length - coverageOf(s).length), 0);

  const text = (value, font = {}, fill) => {
    const row = ws.addRow([]);
    ws.mergeCells(row.number, 1, row.number, span);
    const cell = row.getCell(1);
    cell.value = value;
    cell.font = font;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    const visible = typeof value === 'string' ? value : (value?.richText ?? []).map((r) => r.text).join('');
    row.height = rowHeight([visible], [fullWidth]);
  };
  const band = (value) => text(value, { bold: true, size: 12, color: { argb: COLORS.headerText } }, COLORS.header);

  text('Not executed, out of scope and unable to execute', { bold: true, size: 16, color: { argb: COLORS.header } });
  text('Every scenario/browser combination that is not an executed, passing test, and why. Rebuilt from the catalogue and the latest results on every workbook build.',
    { italic: true, color: { argb: 'FF595959' } });
  ws.addRow([]);

  band(scope.notAutomated.length ? `Why ${scope.automated.length} of ${scope.total} scenarios run` : `All ${scope.total} scenarios run`);
  text(scope.notAutomated.length
    ? `${scope.automated.length} of ${scope.total} scenarios are automated. Not automated: ` +
      scope.notAutomated.map((s) => `${s.id} (${s.automationStatus.toLowerCase()}): ${firstSentence(s.failureNotes)}`).join(' ')
    : `Every scenario in the catalogue is automated and runs.`);
  ws.addRow([]);

  band(scope.expectedExecutions === possible
    ? `A full run is ${scope.expectedExecutions} tests (${scope.total} scenarios x ${BROWSERS.length} browsers, nothing left out)`
    : `Why a full run is ${scope.expectedExecutions} tests, not ${possible} (${scope.total} scenarios x ${BROWSERS.length} browsers)`);
  const math = [
    ['Possible tests', `${scope.total} scenarios x ${BROWSERS.length} browsers`, possible],
    ['minus not automated', `${scope.notAutomated.length} scenarios x ${BROWSERS.length} browsers`, -notAutomatedPairs],
    ['minus out of scope by design', `${scope.limited.length} scenarios that run on fewer browsers`, -outOfScopePairs],
    ['= Executed per full run', BROWSERS.map((b) => `${b} ${scope.inScope(b).length}`).join(', '), scope.expectedExecutions]
  ];
  const mh = ws.addRow(['Step', '', 'Count']);
  ws.mergeCells(mh.number, 1, mh.number, 2);
  ws.mergeCells(mh.number, 3, mh.number, span);
  for (const [label, how, n] of math) {
    const row = ws.addRow([label, '', `${n}   (${how})`]);
    ws.mergeCells(row.number, 1, row.number, 2);
    ws.mergeCells(row.number, 3, row.number, span);
    row.getCell(1).font = { bold: label.startsWith('=') };
    row.getCell(3).font = { bold: label.startsWith('=') };
    for (let c = 1; c <= span; c += 1) row.getCell(c).border = { top: border, left: border, bottom: border, right: border };
  }
  mh.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } }; });
  ws.addRow([]);

  band('Per browser');
  const bh = ws.addRow(['Browser', '', 'Executed', 'Passed', 'Not passing', 'Not automated', 'Out of scope by design', 'Total scenarios']);
  ws.mergeCells(bh.number, 1, bh.number, 2);
  bh.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } }; c.alignment = { wrapText: true }; });
  for (const b of BROWSERS) {
    const inScope = scope.inScope(b);
    const passed = inScope.filter((s) => latestPerBrowser(s, data.executions).get(b)?.status === 'Passed').length;
    const row = ws.addRow([b, '', inScope.length, passed, inScope.length - passed, scope.notAutomated.length, scope.automated.length - inScope.length, scope.total]);
    ws.mergeCells(row.number, 1, row.number, 2);
    for (let c = 1; c <= 8; c += 1) row.getCell(c).border = { top: border, left: border, bottom: border, right: border };
    if (inScope.length - passed) row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.Failed } };
  }
  ws.addRow([]);

  band('Latest results');
  if (!problems.length) {
    text('All tests passed in the latest results.', { bold: true, color: { argb: 'FF006100' } }, COLORS.Passed);
  } else {
    // Same grouped, plain-language lines as the Delivery Report (skip the scenario/browser lines and the pointer).
    for (const line of plainScopeLines(data, scope, rows).filter((l) => !/^• \*\*(Scenarios|Browsers):/.test(l) && !l.includes('sheet "Not Executed"'))) {
      text(richText(line), {});
    }
    text('Every failing test is listed in the table below.', { italic: true, color: { argb: 'FF595959' } });
  }
  ws.addRow([]);

  band(`Every scenario/browser not executed or not passing (${rows.length} rows: ${count('Not automated')} not automated, ${count('Out of scope by design')} out of scope by design, ${problems.length} problems)`);
  const header = ['Scenario ID', 'User Journey', 'Priority', 'Browser', 'Category', 'Detail', 'Reason', 'Covered elsewhere', 'Action', 'Requirement'];
  const hr = ws.addRow(header);
  hr.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
  const order = ['Failed in latest run', 'Flaky in latest run', 'Skipped (should have run)', 'Never run (should have run)', 'Not automated', 'Out of scope by design'];
  rows.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.id.localeCompare(b.id) || BROWSERS.indexOf(a.browser) - BROWSERS.indexOf(b.browser));
  const tableStart = hr.number;
  for (const r of rows) {
    const values = [r.id, r.journey, r.priority, r.browser, r.category, r.detail, r.reason, r.coverage, r.action, r.ref];
    const row = ws.addRow(values);
    row.eachCell({ includeEmpty: true }, (c) => { c.alignment = { wrapText: true, vertical: 'top' }; c.border = { top: border, left: border, bottom: border, right: border }; });
    tint(row.getCell(3));
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOT_EXECUTED_FILL[r.category] ?? COLORS.band } };
    row.height = rowHeight(values, widths);
  }
  ws.autoFilter = { from: { row: tableStart, column: 1 }, to: { row: tableStart, column: span } };
  return ws;
}

// Open defects whose failing check lives in this scenario (defect.failingScenario).
function knownDefects(data, scenarioId) {
  const closed = new Set(['Fixed', 'Verified', 'Closed', 'Rejected']);
  return (data.defects ?? []).filter((d) => d.failingScenario === scenarioId && !closed.has(d.status)).map((d) => d.id);
}

// "DWS-047: Failed" for the scenario holding the defect's check, or why there is none.
function testResult(data, defect) {
  if (!defect.failingScenario) return 'No automated check';
  const s = data.scenarios.find((x) => x.id === defect.failingScenario);
  return s ? `${s.id}: ${s.executionStatus ?? 'Not Run'}` : `${defect.failingScenario}: not in catalogue`;
}

// "3 open (1 High, 2 Medium); 0 closed", counted from data.defects.
function defectSummary(defects) {
  if (!defects.length) return 'None logged (see "Defects")';
  const closed = new Set(['Fixed', 'Verified', 'Closed', 'Rejected']);
  const open = defects.filter((d) => !closed.has(d.status));
  const bySeverity = DEFECT_SEVERITIES.map((s) => [s, open.filter((d) => d.severity === s).length]).filter(([, n]) => n);
  return `${open.length} open${bySeverity.length ? ` (${bySeverity.map(([s, n]) => `${n} ${s}`).join(', ')})` : ''}; ${defects.length - open.length} closed (see "Defects")`;
}

// One row per logged defect, with steps, expected vs actual, and links to evidence screenshots.
function addDefectsSheet(wb, app, data) {
  const ws = wb.addWorksheet('Defects', { properties: { tabColor: { argb: 'FFC00000' } } });
  if (!data.defects.length) {
    ws.addRow(['No defects logged. Add entries to "defects" in scenarios.json and run build.']);
    return;
  }
  const workbookDir = path.dirname(paths(app).workbook);
  addTable(ws, [
    'Defect ID', 'Title', 'Severity', 'Status', 'Category', 'Risk Ref', 'Related Scenarios', 'Test Result', 'Environment',
    'Steps to Reproduce', 'Expected Result', 'Actual Result', 'Basis for Expected Result', 'Evidence',
    'Found On', 'Reported To', 'Next Action'
  ], data.defects.map((d) => [
    d.id, d.title, d.severity, d.status, d.category ?? '', d.riskRef ?? '', (d.scenarios ?? []).join(', '), testResult(data, d),
    d.environment ?? '',
    d.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'), d.expected, d.actual, d.expectedBasis ?? '',
    (d.evidence ?? []).map((e) => e.label).join('\n'),
    d.foundOn ?? '', d.reportedTo ?? '', d.nextAction ?? ''
  ]), [11, 36, 10, 14, 14, 9, 18, 26, 30, 52, 40, 44, 36, 30, 12, 22, 36]);
  ws.eachRow((row, i) => {
    if (i === 1) return;
    tint(row.getCell(3));
    const status = data.scenarios.find((s) => s.id === data.defects[i - 2].failingScenario)?.executionStatus;
    if (status && COLORS[status]) row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS[status] } };
    // A cell holds one hyperlink: link the first screenshot; every label stays listed in the cell text.
    const first = (data.defects[i - 2].evidence ?? []).find((e) => e.path);
    if (first) {
      row.getCell(14).value = { text: row.getCell(14).value, hyperlink: path.relative(workbookDir, first.path).replaceAll('\\', '/') };
      row.getCell(14).font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });
  ws.dataValidations?.add?.(`C2:C${data.defects.length + 1}`, { type: 'list', allowBlank: false, formulae: [`"${DEFECT_SEVERITIES.join(',')}"`] });
  ws.dataValidations?.add?.(`D2:D${data.defects.length + 1}`, { type: 'list', allowBlank: false, formulae: [`"${DEFECT_STATUSES.join(',')}"`] });
}

// ---------- Clean 3-sheet workbook: Summary, Test Cases, Defects (all projects) ----------
// Plain language only. A failed test is "Failed" and names the defect it found; nothing is called
// "known" or "expected". Browsers a test case does not cover are "Not tested", with the reason.

const isOpen = (d) => !['Closed', 'Rejected'].includes(d.status);
const BROWSER_NAME = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' };
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const GREY = 'FFEDEDED';

function openDefectsFor(data, scenarioId) {
  return (data.defects ?? []).filter((d) => isOpen(d) && ((d.scenarios ?? []).includes(scenarioId) || d.failingScenario === scenarioId));
}

// One test case on one browser.
function resultOf(data, s, b) {
  if (s.automationStatus !== 'Automated') return { text: 'Not automated', fill: GREY, kind: 'notAutomated' };
  if (!coverageOf(s).includes(b)) return { text: 'Not tested', fill: GREY, kind: 'notTested' };
  const r = latestPerBrowser(s, data.executions).get(b);
  if (!r) return { text: 'Not run yet', fill: GREY, kind: 'notRun' };
  if (r.status === 'Passed') return { text: 'Passed', fill: COLORS.Passed, kind: 'passed', runAt: r.runAt };
  if (r.status === 'Failed') return { text: 'Failed', fill: COLORS.Failed, kind: 'failed', error: r.error, runAt: r.runAt };
  if (r.status === 'Flaky') return { text: 'Passed on retry', fill: COLORS.Flaky, kind: 'flaky', runAt: r.runAt };
  // A skip is not a failure: the test did not run on this browser (for example an old browser limit).
  return { text: 'Not run', fill: GREY, kind: 'notRun', runAt: r.runAt };
}

const firstLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().split(/(?<=\.)\s/)[0].slice(0, 220);
const appTitle = (app) => app.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const dateOf = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'not run yet');
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: COLORS.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

function headerRow(ws, values) {
  const row = ws.addRow(values);
  row.eachCell((c) => { c.font = { bold: true, color: { argb: COLORS.headerText } }; c.fill = fill(COLORS.header); c.alignment = { vertical: 'middle', wrapText: true }; c.border = box; });
  row.height = 22;
  return row;
}

function bodyRow(ws, values, widths) {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (c, i) => { if (i <= values.length) { c.alignment = { vertical: 'top', wrapText: true }; c.border = box; } });
  row.height = rowHeight(values.map((v) => (v && typeof v === 'object' ? v.text ?? '' : v)), widths);
  return row;
}

function addSummarySheet(wb, app, data) {
  const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF1F3864' } } });
  const widths = [16, 44, 18, 14, 14, 50];
  ws.columns = widths.map((width) => ({ width }));
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const total = widths.reduce((a, b) => a + b, 0);
  const line = (value, font = {}, background) => {
    const row = ws.addRow([value]);
    ws.mergeCells(row.number, 1, row.number, widths.length);
    const c = row.getCell(1);
    c.font = font; c.alignment = { wrapText: true, vertical: 'top' };
    if (background) c.fill = fill(background);
    row.height = rowHeight([value], [total]);
  };
  const section = (title) => { ws.addRow([]); line(title, { bold: true, size: 13, color: { argb: COLORS.headerText } }, COLORS.header); };

  const automated = data.scenarios.filter((s) => s.automationStatus === 'Automated');
  const cells = data.scenarios.flatMap((s) => BROWSERS.map((b) => ({ s, b, r: resultOf(data, s, b) })));
  const lastRun = data.executions.map((e) => e.runAt).sort().at(-1);
  const failed = cells.filter((c) => c.r.kind === 'failed' || c.r.kind === 'flaky');
  const openDefects = (data.defects ?? []).filter(isOpen);

  line(`${appTitle(app)}: test summary`, { bold: true, size: 18, color: { argb: COLORS.header } });
  line(`Website: ${data.baseUrl ?? ''}    Last test run: ${dateOf(lastRun)}    Test cases approved: ${dateOf(data.approval?.approvedAt)}`, { color: { argb: 'FF595959' } });

  // Result per browser
  section('Result');
  headerRow(ws, ['Browser', 'Test cases', 'Passed', 'Failed', 'Not tested', 'Note']);
  for (const b of BROWSERS) {
    const mine = cells.filter((c) => c.b === b);
    const n = (k) => mine.filter((c) => c.r.kind === k).length;
    const notTested = n('notTested') + n('notAutomated') + n('notRun');
    const failedHere = n('failed') + n('flaky');
    const row = bodyRow(ws, [BROWSER_NAME[b], data.scenarios.length, n('passed'), failedHere, notTested,
      failedHere ? 'See "Failed test cases" below' : notTested ? 'See "Not tested" below' : 'All passed'], widths);
    row.getCell(3).fill = fill(COLORS.Passed);
    if (failedHere) row.getCell(4).fill = fill(COLORS.Failed);
  }
  const passedAll = cells.filter((c) => c.r.kind === 'passed').length;
  const tested = cells.filter((c) => !['notTested', 'notAutomated', 'notRun'].includes(c.r.kind)).length;
  const totalRow = bodyRow(ws, ['Total', `${data.scenarios.length} x 3 browsers`, passedAll, failed.length, cells.length - tested,
    `${tested} tests ran in the last run`], widths);
  totalRow.eachCell((c) => { c.font = { bold: true }; });

  // Outcome in plain words
  section('Outcome');
  const failedCases = [...new Map(failed.map((c) => [c.s.id, c.s])).values()];
  const withDefect = failedCases.filter((s) => openDefectsFor(data, s.id).length);
  const withoutDefect = failedCases.filter((s) => !openDefectsFor(data, s.id).length);
  if (!failedCases.length) line('All tested test cases passed on every browser they were run on.', { bold: true, color: { argb: 'FF006100' } }, COLORS.Passed);
  else {
    line(`${failedCases.length} of ${automated.length} test cases failed. ${withDefect.length} of them found a defect in the website (listed below and on the "Defects" sheet).` +
      (withoutDefect.length ? ` ${withoutDefect.length} failed without a logged defect and must be investigated.` : ''), { bold: true });
  }
  line(`${openDefects.length} open defect${openDefects.length === 1 ? '' : 's'}: ` +
    (['Critical', 'High', 'Medium', 'Low'].map((sev) => [sev, openDefects.filter((d) => d.severity === sev).length]).filter(([, n]) => n).map(([sev, n]) => `${n} ${sev}`).join(', ') || 'none') + '.');

  // Failed test cases
  if (failedCases.length) {
    section('Failed test cases');
    headerRow(ws, ['Test case', 'What it checks', 'Failed on', 'Defect', '', 'Defect title']);
    for (const s of failedCases) {
      const browsers = failed.filter((c) => c.s.id === s.id).map((c) => BROWSER_NAME[c.b]);
      const defects = openDefectsFor(data, s.id);
      const row = bodyRow(ws, [s.id, s.journey, browsers.length === 3 ? 'All 3 browsers' : browsers.join(', '),
        defects.map((d) => d.id).join(', ') || 'None yet', '', defects.map((d) => d.title).join('; ') || 'Investigate: no defect logged'], widths);
      ws.mergeCells(row.number, 4, row.number, 5);
      row.height = rowHeight([s.journey, defects.map((d) => d.title).join('; ')], [widths[1], widths[5]]);
      row.getCell(4).fill = fill(defects.length ? COLORS.Failed : COLORS.Flaky);
    }
  }

  // Not tested and why
  const gaps = data.scenarios.filter((s) => BROWSERS.some((b) => ['notTested', 'notAutomated', 'notRun'].includes(resultOf(data, s, b).kind)));
  section('Not tested and why');
  if (!gaps.length) line('Nothing was left out: every test case ran on Chromium, Firefox and WebKit.', { color: { argb: 'FF006100' } }, COLORS.Passed);
  else {
    headerRow(ws, ['Test case', 'What it checks', 'Not tested on', 'Why', '', '']);
    for (const s of gaps) {
      const missing = BROWSERS.filter((b) => ['notTested', 'notAutomated', 'notRun'].includes(resultOf(data, s, b).kind)).map((b) => BROWSER_NAME[b]);
      const reason = s.automationStatus !== 'Automated' ? `Not automated: ${firstLine(s.failureNotes)}`
        : !s.scopeReason ? 'Not run yet' : firstLine(s.scopeReason.replace(/^Test-safety limit \([^)]*\):\s*/i, ''));
      const row = bodyRow(ws, [s.id, s.journey, missing.length === 3 ? 'All 3 browsers' : missing.join(', '), reason, '', ''], widths);
      ws.mergeCells(row.number, 4, row.number, 6);
      row.height = rowHeight([s.journey, reason], [widths[1], widths[3] + widths[4] + widths[5]]);
    }
    line('Website compatibility on these browsers is not verified for the test cases above.', { italic: true, color: { argb: 'FF595959' } });
  }

  section('How to read this workbook');
  line('Test Cases: every test case with its steps, the expected result and the result on Chromium, Firefox and WebKit.');
  line('Defects: every problem found in the website, what happens, what should happen and why it counts as a defect.');
  return ws;
}

function addTestCasesSheet(wb, data) {
  const ws = wb.addWorksheet('Test Cases', { properties: { tabColor: { argb: 'FF2E75B6' } } });
  const widths = [9, 16, 36, 9, 50, 46, 11, 11, 11, 10, 40];
  ws.columns = widths.map((width) => ({ width }));
  headerRow(ws, ['ID', 'Area', 'Test case', 'Priority', 'Steps', 'Expected result', 'Chromium', 'Firefox', 'WebKit', 'Defect', 'Notes']);
  for (const s of data.scenarios) {
    const results = BROWSERS.map((b) => resultOf(data, s, b));
    const defects = openDefectsFor(data, s.id);
    const notes = [];
    if (s.automationStatus !== 'Automated') notes.push(`Not automated: ${firstLine(s.failureNotes)}`);
    else if (results.some((r) => r.kind === 'notTested')) notes.push(`Not tested on ${BROWSERS.filter((b, i) => results[i].kind === 'notTested').map((b) => BROWSER_NAME[b]).join(', ')}: ${firstLine(s.scopeReason?.replace(/^Test-safety limit \([^)]*\):\s*/i, ''))}`);
    if (results.some((r) => r.kind === 'failed') && !defects.length) notes.push(`Failed, no defect logged yet: ${firstLine(results.find((r) => r.kind === 'failed').error)}`);
    const steps = (s.steps ?? []).map((st, i) => `${i + 1}. ${st}`).join('\n');
    const row = bodyRow(ws, [s.id, s.feature, s.journey, s.priority, steps, s.expected, ...results.map((r) => r.text),
      defects.map((d) => d.id).join(', '), notes.join(' ')], widths);
    tint(row.getCell(4));
    results.forEach((r, i) => { row.getCell(7 + i).fill = fill(r.fill); row.getCell(7 + i).alignment = { vertical: 'top', horizontal: 'center', wrapText: true }; });
  }
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } };
  return ws;
}

function addCleanDefectsSheet(wb, app, data) {
  const ws = wb.addWorksheet('Defects', { properties: { tabColor: { argb: 'FFC00000' } } });
  const widths = [9, 34, 9, 13, 44, 36, 36, 40, 10, 16, 26, 11];
  ws.columns = widths.map((width) => ({ width }));
  headerRow(ws, ['ID', 'Defect', 'Severity', 'Status', 'What happens', 'What should happen', 'Why it is a defect',
    'Steps to see it', 'Test case', 'Browsers', 'Evidence', 'Found on']);
  const workbookDir = path.dirname(paths(app).workbook);
  const status = (d) => (d.status === 'New' ? 'Open' : d.status === 'Rejected' ? 'Rejected (not a defect)' : d.status);
  const browsersFor = (d) => {
    const ids = [...new Set([...(d.scenarios ?? []), d.failingScenario].filter(Boolean))];
    const failing = new Set();
    for (const id of ids) {
      const s = data.scenarios.find((x) => x.id === id);
      if (s) for (const b of BROWSERS) if (resultOf(data, s, b).kind === 'failed') failing.add(BROWSER_NAME[b]);
    }
    return failing.size === 3 ? 'All 3 browsers' : failing.size ? [...failing].join(', ') : '';
  };
  const sorted = [...(data.defects ?? [])].sort((a, b) =>
    (isOpen(a) ? 0 : 1) - (isOpen(b) ? 0 : 1) || (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.id.localeCompare(b.id));
  let separatorDone = false;
  for (const d of sorted) {
    if (!isOpen(d) && !separatorDone) {
      const sep = ws.addRow(['Closed or rejected (kept for the record)']);
      ws.mergeCells(sep.number, 1, sep.number, widths.length);
      sep.getCell(1).font = { bold: true, color: { argb: 'FF595959' } };
      sep.getCell(1).fill = fill(GREY);
      separatorDone = true;
    }
    const steps = (d.steps ?? []).map((st, i) => `${i + 1}. ${st}`).join('\n');
    const evidence = (d.evidence ?? []).filter((e) => e.path);
    const evidenceText = evidence.length ? evidence.map((e) => e.label).join('\n') : (d.evidence ?? []).map((e) => e.label).join('\n');
    const row = bodyRow(ws, [d.id, d.title, d.severity, status(d), d.actual, d.expected, d.expectedBasis, steps,
      [...new Set([...(d.scenarios ?? []), d.failingScenario].filter(Boolean))].join(', '), browsersFor(d) || '-', evidenceText, d.foundOn ?? ''], widths);
    if (evidence.length) {
      row.getCell(11).value = { text: evidenceText, hyperlink: path.relative(workbookDir, evidence[0].path).replaceAll('\\', '/') };
      row.getCell(11).font = { color: { argb: 'FF0563C1' }, underline: true };
    }
    row.getCell(3).fill = fill(d.severity === 'High' || d.severity === 'Critical' ? COLORS.High : d.severity === 'Medium' ? COLORS.Medium : COLORS.Low);
    if (!isOpen(d)) row.eachCell((c) => { c.font = { ...(c.font ?? {}), color: { argb: 'FF7F7F7F' } }; });
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } };
  return ws;
}

async function build(app, data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'E2E automation agent';
  wb.created = new Date();
  addSummarySheet(wb, app, data);
  addTestCasesSheet(wb, data);
  addCleanDefectsSheet(wb, app, data);
  await wb.xlsx.writeFile(paths(app).workbook);
  console.log(`build: wrote ${paths(app).workbook.replaceAll('\\', '/')} (Summary, Test Cases, Defects; ${data.scenarios.length} test cases, ${(data.defects ?? []).length} defects)`);
}

// ---------- Rename scenario IDs (e.g. DWS-061 -> TC-61), keeping each number ----------
// Updates the catalogue (scenarios, executions, defects, risks, test data, stored report, approval) and the
// app's code and plan files. Approval is carried over only for scenarios whose content did not change.
async function renameIds(app, data, prefix, digits) {
  if (!/^[A-Z][A-Z0-9]*$/.test(prefix)) throw new Error('--prefix must be upper-case letters/digits, e.g. TC');
  const map = new Map();
  for (const s of data.scenarios) {
    const m = s.id.match(/^([A-Z][A-Z0-9]*)-0*(\d+)$/);
    if (!m) throw new Error(`cannot parse id ${s.id}`);
    const next = `${prefix}-${m[2].padStart(digits, '0')}`;
    if ([...map.values()].includes(next)) throw new Error(`id collision: ${s.id} -> ${next}`);
    map.set(s.id, next);
  }
  const oldPrefixes = [...new Set([...map.keys()].map((id) => id.split('-')[0]))];
  const pattern = new RegExp(`\\b(${oldPrefixes.join('|')})-0*(\\d+)\\b`, 'g');
  // Numbers are kept, so retired scenarios in the history (e.g. a removed DWS-068) map the same way.
  const swap = (text) => text.replace(pattern, (whole, pre, num) => `${prefix}-${String(Number(num)).padStart(digits, '0')}`);

  // Approval: unchanged content keeps its approval under the new id; changed content stays pending.
  const before = Object.fromEntries(data.scenarios.map((s) => [s.id, scenarioFingerprint(s)]));
  const approved = data.approval?.scenarios ?? null;

  const renamed = JSON.parse(swap(JSON.stringify(data)));
  if (renamed.code) renamed.code = prefix;
  if (approved) {
    renamed.approval.scenarios = {};
    for (const s of renamed.scenarios) {
      const oldId = [...map].find(([, v]) => v === s.id)[0];
      if (approved[oldId] && approved[oldId] === before[oldId]) renamed.approval.scenarios[s.id] = scenarioFingerprint(s);
      else if (approved[oldId]) renamed.approval.scenarios[s.id] = 'changed-before-rename';
    }
  }
  Object.assign(data, renamed);
  await saveCatalogue(app, data);

  const roots = [path.join('tests', app), path.join('pages', app), path.join('test-plans', app),
    path.join('fixtures', `${app}.fixture.ts`), path.join('test-data', `${app}.data.ts`)];
  let filesChanged = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const files = root.endsWith('.ts') ? [root] : (await readdir(root, { recursive: true, withFileTypes: true }))
      .filter((e) => e.isFile() && /\.(ts|md)$/.test(e.name)).map((e) => path.join(e.parentPath ?? e.path, e.name));
    for (const f of files) {
      const text = await readFile(f, 'utf8');
      const next = swap(text);
      if (next !== text) { await writeFile(f, next); filesChanged += 1; }
    }
  }
  console.log(`rename-ids: ${map.size} scenarios renamed (${[...map][0].join(' -> ')} ... ${[...map].at(-1).join(' -> ')}); ${filesChanged} code/plan files updated`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { command, app } = args;
  const data = await loadCatalogue(app);
  let ok = true;
  if (command === 'validate' || command === 'all') ok = await validate(app, data);
  if (command === 'sync' || command === 'all') {
    if (existsSync(await resolveResults(app)) || command === 'sync') {
      await sync(app, data);
      await saveCatalogue(app, data);
    }
  }
  if (command === 'build' || command === 'all') await build(app, data);
  if (command === 'scope') printScope(data);
  if (command === 'review') {
    printReview(data);
    if (approvalPending(approvalDiff(data))) process.exitCode = 3; // 3 = user approval needed
  }
  if (command === 'rename-ids') await renameIds(app, data, args.prefix ?? 'TC', args.digits ?? 2);
  if (command === 'approve') {
    data.approval = {
      approvedAt: new Date().toISOString(),
      scenarios: Object.fromEntries(data.scenarios.map((s) => [s.id, scenarioFingerprint(s)]))
    };
    await saveCatalogue(app, data);
    console.log(`approve: recorded user approval of ${data.scenarios.length} scenarios at ${data.approval.approvedAt}`);
  }
  if (command === 'report') {
    if (args.from) {
      // Store the Markdown delivery report in the catalogue; the workbook's first sheet is rendered from it.
      data.deliveryReport = (await readFile(args.from, 'utf8')).split(String.fromCharCode(13)).join('');
      if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(data.deliveryReport.replace(/[\w.+-]+@example\.(test|com)/gi, ''))) {
        throw new Error('The report contains an e-mail address; remove account values before storing it');
      }
      await saveCatalogue(app, data);
      await build(app, data);
      console.log(`report: stored ${data.deliveryReport.length} characters from ${args.from} in ${paths(app).catalogue}`);
    }
    if (args.print) process.stdout.write(data.deliveryReport ?? '');
  }
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
