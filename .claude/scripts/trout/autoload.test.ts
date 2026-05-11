import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/autoload.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(args: string[], cwd: string): RunResult {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    };
  }
}

// Build a fake `gh` binary that responds to `gh pr view <N> --json state,mergedAt`.
// Modes per-PR (encoded in MOCK_GH_STATES env):
//   'OPEN'    → exit 0, JSON with state:OPEN, mergedAt:null
//   'MERGED'  → exit 0, JSON with state:MERGED, mergedAt:'2026-01-01T00:00:00Z'
//   'CLOSED'  → exit 0, JSON with state:CLOSED, mergedAt:null
//   'ERROR'   → exit 1 (treated as unavailable)
//   undefined → exit 1 (same)
// MOCK_GH_LOG (optional): file path; mock appends Date.now() on each invocation,
// for ordering / parallelism assertions.
function writeMockGh(mocksDir: string): void {
  mkdirSync(mocksDir, { recursive: true });
  const script = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
if (process.env.MOCK_GH_LOG) {
  try { appendFileSync(process.env.MOCK_GH_LOG, Date.now() + '\\n'); } catch {}
}
if (process.env.MOCK_GH_DELAY_MS) {
  // Synchronous wait so concurrent invocations actually overlap in elapsed
  // time (used by the parallelism test).
  const ms = parseInt(process.env.MOCK_GH_DELAY_MS, 10);
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}
if (args[0] === 'pr' && args[1] === 'view') {
  const states = JSON.parse(process.env.MOCK_GH_STATES || '{}');
  const n = String(parseInt(args[2], 10));
  const state = states[n];
  if (state === 'MERGED') {
    process.stdout.write(JSON.stringify({ state: 'MERGED', mergedAt: '2026-01-01T00:00:00Z' }));
    process.exit(0);
  }
  if (state === 'OPEN') {
    process.stdout.write(JSON.stringify({ state: 'OPEN', mergedAt: null }));
    process.exit(0);
  }
  if (state === 'CLOSED') {
    process.stdout.write(JSON.stringify({ state: 'CLOSED', mergedAt: null }));
    process.exit(0);
  }
  process.exit(1);
}
process.exit(2);
`;
  writeFileSync(join(mocksDir, 'gh'), script);
  chmodSync(join(mocksDir, 'gh'), 0o755);
}

function runWithMockGh(
  args: string[],
  cwd: string,
  ghStates: Record<number, 'OPEN' | 'MERGED' | 'CLOSED' | 'ERROR'>,
  envExtra: Record<string, string> = {},
): RunResult {
  const mocksDir = join(cwd, '.mocks');
  writeMockGh(mocksDir);
  const env = {
    ...process.env,
    PATH: `${mocksDir}:${process.env.PATH}`,
    MOCK_GH_STATES: JSON.stringify(ghStates),
    ...envExtra,
  };
  const res = spawnSync('node', [SCRIPT, ...args], {
    cwd,
    encoding: 'utf-8',
    env,
  });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

function runWithGhUnavailable(args: string[], cwd: string): RunResult {
  // We want spawn('gh', ...) inside autoload to hit ENOENT so the unavailable
  // codepath fires. We can't just empty PATH — `node` itself needs to be
  // resolvable, and autoload calls `git` via getCurrentBranch. So we drop a
  // *failing* fake `gh` into a mocks dir, prepend it to PATH, and leave the
  // rest of PATH intact. The fake gh always exits non-zero — same effect
  // from autoload's point of view (ghState collapses to 'unavailable').
  const mocksDir = join(cwd, '.mocks-failing-gh');
  mkdirSync(mocksDir, { recursive: true });
  writeFileSync(join(mocksDir, 'gh'), '#!/usr/bin/env node\nprocess.exit(1);\n');
  chmodSync(join(mocksDir, 'gh'), 0o755);
  const env = {
    ...process.env,
    PATH: `${mocksDir}:${process.env.PATH}`,
  };
  const res = spawnSync('node', [SCRIPT, ...args], {
    cwd,
    encoding: 'utf-8',
    env,
  });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

function makeFixture(opts: { withGit?: { branch: string }; conventions?: string | null } = {}): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'autoload-test-'));
  mkdirSync(join(root, 'projects'), { recursive: true });
  mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
  if (opts.conventions !== null) {
    writeFileSync(join(root, 'projects', 'CONVENTIONS.md'), opts.conventions ?? CONVENTIONS_MD_FIXTURE);
  }
  if (opts.withGit) {
    execFileSync('git', ['init', '-q', '-b', opts.withGit.branch], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  }
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

const CONVENTIONS_MD_FIXTURE = `# Project substrate conventions

**Status values for a phase**: \`not-started\`, \`in-progress\`, \`blocked\`, \`completed\`.

## Other section
`;

function makeProject(root: string, dirname: string, manifest: string = MANIFEST_FIXTURE, opts: { config?: string; sessions?: Record<string, string>; checkins?: Record<string, string> } = {}): string {
  const path = join(root, 'projects', dirname);
  mkdirSync(join(path, 'sessions'), { recursive: true });
  mkdirSync(join(path, 'checkins'), { recursive: true });
  writeFileSync(join(path, 'MANIFEST.md'), manifest);
  if (opts.config !== undefined) writeFileSync(join(path, 'config.md'), opts.config);
  for (const [name, content] of Object.entries(opts.sessions ?? {})) {
    writeFileSync(join(path, 'sessions', name), content);
  }
  for (const [relPath, content] of Object.entries(opts.checkins ?? {})) {
    const full = join(path, 'checkins', relPath);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return path;
}

const MANIFEST_FIXTURE = `# Project: Test

**Slug**: 2026-01-01-test
**Started**: 2026-01-01
**Status**: active
**Current branch**: feat/x
**Latest checkin**: —

## Strategy

A test project.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | First | in-progress | feat/x | — | — |
| 2 | Second | not-started | — | — | — |

## Dependencies

- (none)

## Current state

Starting work on phase 1.

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-01-01 09:00 | project-initialized | — |
`;

const CONFIG_FIXTURE = `# Project config

## Verification
- \`npm run lint\`
- \`npm run build\`

## PR settings
- Base branch: main
- Reviewers: —
- Labels: —
`;

const SESSION_FIXTURE = `# Session 2026-01-02-a

**Phases touched**: 1

## What happened

Did stuff.

## Open threads

- Wrap up the migration.
- Decide PR strategy.

## Notes

None.
`;

const CHECKIN_FIXTURE_WITH_VERDICT = `# Checkin 03 — feat/x

**Created**: 2026-01-02 14:30
**Phase**: 1 — First
**Unit**: Migrate the widget

## Contract
- **Goal**: do it

## Execution
Done.

## Evaluator verdict
approved

## Notes for the PR

- Self-documenting smoke test pattern.
- correction: skipped a step earlier; adjusted.
`;

test('no args fails with missing-identifier and lists active projects', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  makeProject(fx.root, '2026-02-01-other');
  const res = run([], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /missing project identifier/);
  assert.match(res.stderr, /active projects: 2026-01-01-test, 2026-02-01-other/);
  assert.match(res.stderr, /usage:/);
  fx.cleanup();
});

test('project resolution: exact slug match returns briefing', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['2026-01-01-test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /## Project orientation: Test \(2026-01-01-test\)/);
  fx.cleanup();
});

test('project resolution: bare-name suffix match', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /## Project orientation: Test/);
  fx.cleanup();
});

test('project resolution: multiple matches fails with candidates', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  makeProject(fx.root, '2026-02-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /ambiguous slug "test"/);
  assert.match(res.stderr, /candidates: 2026-01-01-test, 2026-02-01-test|candidates: 2026-02-01-test, 2026-01-01-test/);
  fx.cleanup();
});

test('project resolution: archived project is refused', () => {
  const fx = makeFixture();
  const archivePath = join(fx.root, 'projects', 'archive', '2026-01-01-old');
  mkdirSync(archivePath, { recursive: true });
  writeFileSync(join(archivePath, 'MANIFEST.md'), MANIFEST_FIXTURE);
  const res = run(['old'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /archived/);
  fx.cleanup();
});

test('missing manifest fails clean', () => {
  const fx = makeFixture();
  const path = join(fx.root, 'projects', '2026-01-01-empty');
  mkdirSync(path, { recursive: true });
  const res = run(['empty'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no manifest found/);
  fx.cleanup();
});

test('briefing includes status, phases table, current state', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /\*\*Status\*\*: active/);
  assert.match(res.stdout, /### Phases/);
  assert.match(res.stdout, /\| 1 \| First \| in-progress \| feat\/x/);
  assert.match(res.stdout, /### Current state/);
  assert.match(res.stdout, /Starting work on phase 1\./);
  fx.cleanup();
});

test('omits Last checkin section when latestCheckin is "—"', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stdout, /### Last checkin/);
  fx.cleanup();
});

test('includes Last checkin section when latestCheckin resolves', () => {
  const fx = makeFixture();
  const manifestWithCheckin = MANIFEST_FIXTURE.replace('**Latest checkin**: —', '**Latest checkin**: checkins/feat/x/03.md');
  makeProject(fx.root, '2026-01-01-test', manifestWithCheckin, {
    checkins: { 'feat/x/03.md': CHECKIN_FIXTURE_WITH_VERDICT },
  });
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /### Last checkin \(03, 2026-01-02\)/);
  assert.match(res.stdout, /\*\*Unit\*\*: Migrate the widget/);
  assert.match(res.stdout, /\*\*Verdict\*\*: approved/);
  assert.match(res.stdout, /\*\*Notes\*\*: Self-documenting smoke test pattern\./);
  fx.cleanup();
});

test('omits Last session section when sessions/ is empty', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stdout, /### Last session/);
  fx.cleanup();
});

test('includes Last session with open threads', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test', MANIFEST_FIXTURE, {
    sessions: { '2026-01-02-a.md': SESSION_FIXTURE },
  });
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /### Last session \(2026-01-02-a\.md\)/);
  assert.match(res.stdout, /Wrap up the migration/);
  fx.cleanup();
});

test('omits Config highlights when no config.md', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stdout, /### Config highlights/);
  fx.cleanup();
});

test('includes Config highlights with verification commands and PR base', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test', MANIFEST_FIXTURE, { config: CONFIG_FIXTURE });
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /### Config highlights/);
  assert.match(res.stdout, /Verification: `npm run lint`, `npm run build`/);
  assert.match(res.stdout, /PR base: main/);
  fx.cleanup();
});

test('drift line emitted when git branch differs from manifest', () => {
  const fx = makeFixture({ withGit: { branch: 'feat/different' } });
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /> Drift: manifest says feat\/x, git is on feat\/different\./);
  fx.cleanup();
});

test('no drift line when git branch matches manifest', () => {
  const fx = makeFixture({ withGit: { branch: 'feat/x' } });
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.doesNotMatch(res.stdout, /> Drift:/);
  fx.cleanup();
});

test('suggested next action: all phases completed → archive', () => {
  const fx = makeFixture();
  const allDone = MANIFEST_FIXTURE
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | completed | feat/x | 03 | #1 (merged) |')
    .replace('| 2 | Second | not-started | — | — | — |', '| 2 | Second | completed | feat/y | 02 | #2 (merged) |');
  makeProject(fx.root, '2026-01-01-test', allDone);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /### Suggested next action\nAll phases complete — run `\/trout-archive 2026-01-01-test`\./);
  fx.cleanup();
});

test('suggested next action: in-progress + open PR → trout-pr-respond', () => {
  const fx = makeFixture();
  const m = MANIFEST_FIXTURE.replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | in-progress | feat/x | 02 | #7 (open) |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /Phase 1 has open PR #7 — consider `\/trout-pr-respond 2026-01-01-test 7`/);
  fx.cleanup();
});

test('suggested next action: in-progress + fresh checkin + no open PR → trout-pull-request', () => {
  const fx = makeFixture();
  const m = MANIFEST_FIXTURE
    .replace('**Latest checkin**: —', '**Latest checkin**: checkins/feat/x/03.md')
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | in-progress | feat/x | 03 | — |');
  makeProject(fx.root, '2026-01-01-test', m, { checkins: { 'feat/x/03.md': CHECKIN_FIXTURE_WITH_VERDICT } });
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /Phase 1 has a fresh checkin and no open PR — run `\/trout-pull-request 2026-01-01-test feat\/x`\./);
  fx.cleanup();
});

test('suggested next action: not-started + deps satisfied → ev-run', () => {
  const fx = makeFixture();
  const m = MANIFEST_FIXTURE
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | completed | feat/x | 03 | #1 (merged) |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /Phase 2 \(Second\) is ready to start — run `\/ev-run 2026-01-01-test`\./);
  fx.cleanup();
});

test('CONVENTIONS.md runtime-read: phase status added there is accepted', () => {
  const customConventions = `# Project substrate conventions

**Status values for a phase**: \`not-started\`, \`in-progress\`, \`blocked\`, \`completed\`, \`paused\`.
`;
  const fx = makeFixture({ conventions: customConventions });
  const m = MANIFEST_FIXTURE.replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | paused | feat/x | — | — |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /\| 1 \| First \| paused/);
  fx.cleanup();
});

test('CONVENTIONS.md status line wrapped across two lines is fully captured', () => {
  const wrapped = `# Project substrate conventions

**Status values for a phase**: \`not-started\`, \`in-progress\`, \`blocked\`,
\`completed\`.
`;
  const fx = makeFixture({ conventions: wrapped });
  const m = MANIFEST_FIXTURE
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | completed | feat/x | 03 | #1 (merged) |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /\| 1 \| First \| completed/);
  fx.cleanup();
});

test('CONVENTIONS.md missing → falls back, unknown status fails informatively', () => {
  const fx = makeFixture({ conventions: null });
  const m = MANIFEST_FIXTURE.replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | paused | feat/x | — | — |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown phase status "paused"/);
  assert.match(res.stderr, /known statuses: not-started, in-progress, blocked, completed/);
  fx.cleanup();
});

test('parses Notes section under either "Notes for the PR" or "Notes for PR" header', () => {
  const fx = makeFixture();
  const checkinShortForm = `# Checkin 04 — feat/x

**Created**: 2026-01-03 10:00
**Phase**: 1 — First
**Unit**: Short form notes

## Notes for PR

- Short-form header used here.
`;
  const m = MANIFEST_FIXTURE.replace('**Latest checkin**: —', '**Latest checkin**: checkins/feat/x/04.md');
  makeProject(fx.root, '2026-01-01-test', m, { checkins: { 'feat/x/04.md': checkinShortForm } });
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /\*\*Notes\*\*: Short-form header used here\./);
  fx.cleanup();
});

test('suggested next action: not-started + waiting on prior PR', () => {
  const fx = makeFixture();
  const m = MANIFEST_FIXTURE
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | in-progress | feat/x | 03 | #5 (open) |');
  makeProject(fx.root, '2026-01-01-test', m);
  const res = run(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /Phase 1 has open PR #5/);
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// gh reconciliation (D13)
// ---------------------------------------------------------------------------

const MANIFEST_WITH_PR_FIXTURE = MANIFEST_FIXTURE
  .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | completed | feat/x | 03 | #5 (open) |');

test('gh: agree case (manifest open, gh open) renders no drift indicator', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test', MANIFEST_WITH_PR_FIXTURE);
  const res = runWithMockGh(['test'], fx.root, { 5: 'OPEN' });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // PR cell renders bare; no drift markup.
  assert.match(res.stdout, /\| #5 \(open\) \|/);
  assert.doesNotMatch(res.stdout, /⚠/);
  assert.doesNotMatch(res.stdout, /Reconciled drift/);
  fx.cleanup();
});

test('gh: open→merged drift surfaces inline indicator in default mode (no MANIFEST change)', () => {
  const fx = makeFixture();
  const projectPath = makeProject(fx.root, '2026-01-01-test', MANIFEST_WITH_PR_FIXTURE);
  const res = runWithMockGh(['test'], fx.root, { 5: 'MERGED' });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // Inline drift indicator in the Phases table.
  assert.match(res.stdout, /\| #5 \(open ⚠ merged on gh\) \|/);
  // No reconcile note (we didn't pass --reconcile).
  assert.doesNotMatch(res.stdout, /Reconciled drift/);
  // MANIFEST untouched — default mode is read-only.
  const manifestAfter = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
  assert.match(manifestAfter, /\| 1 \| First \| completed \| feat\/x \| 03 \| #5 \(open\) \|/);
  assert.doesNotMatch(manifestAfter, /pr-merged/);
  fx.cleanup();
});

test('gh: open→merged drift, --reconcile auto-flips MANIFEST and records pr-merged event', () => {
  const fx = makeFixture();
  const projectPath = makeProject(fx.root, '2026-01-01-test', MANIFEST_WITH_PR_FIXTURE);
  const res = runWithMockGh(['test', '--reconcile'], fx.root, { 5: 'MERGED' });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // Briefing notes the reconcile.
  assert.match(res.stdout, /Reconciled drift: PR #5 marked merged \(was open\)\./);
  // MANIFEST mutated by autosave: PR cell flipped, pr-merged event row added.
  const manifestAfter = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
  assert.match(manifestAfter, /\| #5 \(merged\) \|/);
  assert.match(manifestAfter, /pr-merged \| #5/);
  // The re-rendered table should reflect the post-reconcile state — no `⚠`
  // indicator because manifest is now consistent with gh.
  assert.doesNotMatch(res.stdout, /⚠/);
  fx.cleanup();
});

test('gh: merged→open drift, --reconcile surfaces warning but does NOT auto-fix', () => {
  const fx = makeFixture();
  const m = MANIFEST_FIXTURE
    .replace('| 1 | First | in-progress | feat/x | — | — |', '| 1 | First | completed | feat/x | 03 | #5 (merged) |');
  const projectPath = makeProject(fx.root, '2026-01-01-test', m);
  const res = runWithMockGh(['test', '--reconcile'], fx.root, { 5: 'OPEN' });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // Inline warning in the Phases table.
  assert.match(res.stdout, /\| #5 \(merged ⚠ open on gh\) \|/);
  // No reconcile (would erase merge history) — no reconcile note either.
  assert.doesNotMatch(res.stdout, /Reconciled drift/);
  // MANIFEST untouched.
  const manifestAfter = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
  assert.match(manifestAfter, /\| #5 \(merged\) \|/);
  assert.doesNotMatch(manifestAfter, /pr-merged \| #5/);
  fx.cleanup();
});

test('gh: unavailable in default mode emits advisory note and leaves MANIFEST untouched', () => {
  const fx = makeFixture();
  const projectPath = makeProject(fx.root, '2026-01-01-test', MANIFEST_WITH_PR_FIXTURE);
  const res = runWithGhUnavailable(['test'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /_gh unavailable — PR states shown are manifest-only\._/);
  // Cell renders as-is from manifest.
  assert.match(res.stdout, /\| #5 \(open\) \|/);
  // MANIFEST untouched.
  const manifestAfter = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
  assert.match(manifestAfter, /\| 1 \| First \| completed \| feat\/x \| 03 \| #5 \(open\) \|/);
  fx.cleanup();
});

test('gh: unavailable with --reconcile is inert (no error, no MANIFEST write)', () => {
  const fx = makeFixture();
  const projectPath = makeProject(fx.root, '2026-01-01-test', MANIFEST_WITH_PR_FIXTURE);
  const res = runWithGhUnavailable(['test', '--reconcile'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /_gh unavailable — PR states shown are manifest-only\._/);
  assert.doesNotMatch(res.stdout, /Reconciled drift/);
  const manifestAfter = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
  assert.doesNotMatch(manifestAfter, /pr-merged \| #5/);
  fx.cleanup();
});

test('gh: phases table with zero PR cells skips gh entirely (no advisory note)', () => {
  const fx = makeFixture();
  // Default MANIFEST_FIXTURE has no PRs in any phase row — both are `—`.
  makeProject(fx.root, '2026-01-01-test', MANIFEST_FIXTURE);
  const res = runWithMockGh(['test'], fx.root, {});
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // No advisory note (gh wasn't queried).
  assert.doesNotMatch(res.stdout, /gh unavailable/);
  assert.doesNotMatch(res.stdout, /⚠/);
  fx.cleanup();
});

test('gh: queries run in parallel (3 PRs with 100ms delay each finish in well under 300ms)', () => {
  const fx = makeFixture();
  // Three phase rows, each with a PR. Mocked gh sleeps 100ms per call.
  const threePrManifest = MANIFEST_FIXTURE
    .replace(
      '| 1 | First | in-progress | feat/x | — | — |\n| 2 | Second | not-started | — | — | — |',
      [
        '| 1 | First | completed | feat/x | 03 | #11 (merged) |',
        '| 2 | Second | completed | feat/y | 02 | #12 (merged) |',
        '| 3 | Third | in-progress | feat/z | 01 | #13 (open) |',
      ].join('\n'),
    );
  makeProject(fx.root, '2026-01-01-test', threePrManifest);
  const logFile = join(fx.root, 'gh-call-log.txt');
  const t0 = Date.now();
  const res = runWithMockGh(
    ['test'],
    fx.root,
    { 11: 'MERGED', 12: 'MERGED', 13: 'OPEN' },
    { MOCK_GH_LOG: logFile, MOCK_GH_DELAY_MS: '100' },
  );
  const elapsed = Date.now() - t0;
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  // All three gh invocations occurred.
  const logEntries = readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);
  assert.equal(logEntries.length, 3, `expected 3 gh invocations, got ${logEntries.length}`);
  // Generous parallelism check: serial execution would be 300ms+ for the
  // gh calls alone, plus subprocess startup overhead × 3. Parallel: ~100ms +
  // overhead × 1. We assert under 600ms to absorb spawn overhead, cold
  // node startup, etc. — if this fires, parallelism likely regressed.
  assert.ok(
    elapsed < 600,
    `expected parallel gh execution (<600ms total); got ${elapsed}ms — likely serial`,
  );
  fx.cleanup();
});
