// Organizes each run's evidence under artifacts/<suite>/runs/<runId>/:
//
//   screenshots/<browser>/<ID>_<title>_<status>[_retryN]_<n>.png   readable copies
//   summary.md      per-test table: browser, status, duration, screenshot, error
//   (report/, test-results/, results.json are written by Playwright itself)
//
// It also writes artifacts/<suite>/latest.json (pointer to the newest run)
// and keeps only the newest E2E_KEEP_RUNS runs (default 20).
//
// After the run, it saves a permanent copy of the HTML report as
// artifacts/<suite>/html-reports/<runId>.zip. That folder is outside runs/, so
// pruning never deletes it. Set E2E_ARCHIVE_REPORTS=0 to turn this off.
// The zips stay git-ignored: screenshots of signed-in pages can show account values.

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

interface Options {
  runDirectory: string;
  suiteDirectory: string;
  runId: string;
}

interface Row {
  id: string;
  title: string;
  browser: string;
  status: string;
  durationMs: number;
  retry: number;
  screenshots: string[];
  error: string;
  skipReason: string;
}

const ID_PATTERN = /\[([A-Z][A-Z0-9]*-\d{3,})\]/;

function slug(text: string, max = 60): string {
  return text
    .replace(ID_PATTERN, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
    .toLowerCase();
}

function relative(from: string, to: string): string {
  return path.relative(from, to).replaceAll('\\', '/');
}

export default class ArtifactReporter implements Reporter {
  private readonly rows: Row[] = [];
  private readonly used = new Set<string>();
  private startedAt = new Date();

  constructor(private readonly options: Options) {}

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date();
    mkdirSync(this.options.runDirectory, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const browser = test.parent.project()?.name ?? 'default';
    const id = test.title.match(ID_PATTERN)?.[1] ?? '';
    const base = [id, slug(test.title) || 'test', result.status, result.retry ? `retry${result.retry}` : '']
      .filter(Boolean)
      .join('_');
    const folder = path.join(this.options.runDirectory, 'screenshots', browser);

    const screenshots: string[] = [];
    for (const attachment of result.attachments) {
      if (!attachment.contentType.startsWith('image/') || !attachment.path || !existsSync(attachment.path)) continue;
      mkdirSync(folder, { recursive: true });
      const extension = path.extname(attachment.path) || '.png';
      let n = 1;
      let target = path.join(folder, `${base}_${n}${extension}`);
      while (this.used.has(target)) target = path.join(folder, `${base}_${++n}${extension}`);
      this.used.add(target);
      copyFileSync(attachment.path, target);
      screenshots.push(target);
    }

    this.rows.push({
      id,
      title: test.title,
      browser,
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
      screenshots,
      error: (result.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 200),
      // Why a test did not run (test.skip / fixme reason), so every run explains its own skips.
      skipReason:
        result.status === 'skipped'
          ? [...test.annotations, ...result.annotations]
              .filter((a) => a.type === 'skip' || a.type === 'fixme')
              .map((a) => a.description ?? '')
              .find(Boolean) ?? 'Skipped (no reason given)'
          : ''
    });
  }

  onEnd(result: FullResult): void {
    const { runDirectory, suiteDirectory, runId } = this.options;
    mkdirSync(runDirectory, { recursive: true });

    const counts = (browser: string, status: string) =>
      this.rows.filter((r) => r.browser === browser && r.status === status).length;
    const browsers = [...new Set(this.rows.map((r) => r.browser))];
    const cell = (text: string) => text.replaceAll('|', '\\|');

    const lines = [
      `# Test run ${runId}`,
      '',
      `- Suite: \`${path.basename(suiteDirectory)}\``,
      `- Base URL: ${process.env.BASE_URL ?? '(not set)'}`,
      `- Started: ${this.startedAt.toISOString()}`,
      `- Overall status: **${result.status}**`,
      `- HTML report: [report/index.html](report/index.html)`,
      '',
      '| Browser | Passed | Failed | Timed out | Skipped |',
      '| --- | --- | --- | --- | --- |',
      ...browsers.map(
        (b) => `| ${b} | ${counts(b, 'passed')} | ${counts(b, 'failed')} | ${counts(b, 'timedOut')} | ${counts(b, 'skipped')} |`
      ),
      '',
      '| ID | Test | Browser | Status | Duration (s) | Screenshot | Error |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...this.rows.map((r) => {
        const shots = r.screenshots
          .map((s, i) => `[${i + 1}](${encodeURI(relative(runDirectory, s))})`)
          .join(' ');
        const status = r.retry ? `${r.status} (retry ${r.retry})` : r.status;
        return `| ${r.id} | ${cell(r.title)} | ${r.browser} | ${status} | ${(r.durationMs / 1000).toFixed(1)} | ${shots} | ${cell(r.error)} |`;
      }),
      ''
    ];

    // Explain every test that did not run, grouped by reason.
    const skipped = this.rows.filter((r) => r.status === 'skipped');
    if (skipped.length) {
      const byReason = new Map<string, Row[]>();
      for (const r of skipped) byReason.set(r.skipReason, [...(byReason.get(r.skipReason) ?? []), r]);
      lines.push(
        `## Not run in this run (${skipped.length} skipped)`,
        '',
        'Skips are intentional unless the reason says otherwise; they are not failures.',
        '',
        '| Reason | Count | Tests (browser) |',
        '| --- | --- | --- |',
        ...[...byReason].map(([reason, rows]) =>
          `| ${cell(reason)} | ${rows.length} | ${rows.map((r) => `${r.id || cell(r.title)} (${r.browser})`).join(', ')} |`),
        ''
      );
    }
    writeFileSync(path.join(runDirectory, 'summary.md'), lines.join('\n'));

    writeFileSync(
      path.join(suiteDirectory, 'latest.json'),
      `${JSON.stringify({ runId, runDirectory: runDirectory.replaceAll('\\', '/'), status: result.status, finishedAt: new Date().toISOString() }, null, 2)}\n`
    );

    this.prune();
    console.log(`\nArtifacts saved to ${runDirectory.replaceAll('\\', '/')} (summary.md, screenshots/, report/, test-results/)`);
  }

  // Runs after every reporter's onEnd, so Playwright's HTML report is complete by now.
  async onExit(): Promise<void> {
    if (process.env.E2E_ARCHIVE_REPORTS === '0') return;
    const { runDirectory, suiteDirectory, runId } = this.options;
    const target = await archiveReport(path.join(runDirectory, 'report'), path.join(suiteDirectory, 'html-reports'), runId);
    if (target) console.log(`HTML report kept as ${target.replaceAll('\\', '/')}`);
  }

  private prune(): void {
    const keep = Math.max(1, Number(process.env.E2E_KEEP_RUNS ?? 20) || 20);
    const runsRoot = path.dirname(this.options.runDirectory);
    if (!existsSync(runsRoot)) return;
    const runs = readdirSync(runsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== this.options.runId)
      .map((d) => d.name)
      .sort();
    const excess = runs.length - (keep - 1);
    for (const name of runs.slice(0, Math.max(0, excess))) {
      rmSync(path.join(runsRoot, name), { recursive: true, force: true });
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

/**
 * Zips a Playwright HTML report folder into <archiveDir>/<name>.zip (paths inside the zip are
 * relative to the report folder). Returns the zip path, or null when there is no report
 * (for example a run started with --reporter=..., which replaces the HTML reporter).
 */
export async function archiveReport(reportDir: string, archiveDir: string, name: string): Promise<string | null> {
  if (!existsSync(path.join(reportDir, 'index.html'))) return null;
  const zip = new JSZip();
  const addDir = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) addDir(full);
      else zip.file(relative(reportDir, full), readFileSync(full));
    }
  };
  addDir(reportDir);
  mkdirSync(archiveDir, { recursive: true });
  const target = path.join(archiveDir, `${name}.zip`);
  await new Promise<void>((resolve, reject) => {
    zip
      .generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } })
      .pipe(createWriteStream(target))
      .on('finish', () => resolve())
      .on('error', reject);
  });
  return target;
}
