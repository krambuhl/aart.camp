import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

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
  assert.match(res.stderr, /multiple projects match "test"/);
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
