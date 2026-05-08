import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  parseMarker,
  compareState,
  checkRationale,
  analyzeWhyCheck,
  parseCheckin,
  enumerateCheckinFiles,
} from './pr-plumbing.ts';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/pr-plumbing.ts');
const AUTOSAVE_SCRIPT = join(process.cwd(), '.claude/scripts/trout/autosave.ts');

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

test('parseMarker: plural valid', () => {
  assert.deepEqual(parseMarker('<!-- project-pr-checkins: 01,02,03 -->'), [1, 2, 3]);
});

test('parseMarker: plural with whitespace tolerance', () => {
  assert.deepEqual(parseMarker('<!--  project-pr-checkins:  01 , 02 ,  03  -->'), [1, 2, 3]);
});

test('parseMarker: singular valid', () => {
  assert.deepEqual(parseMarker('<!-- project-pr-checkin: 04 -->'), [4]);
});

test('parseMarker: missing → null', () => {
  assert.equal(parseMarker('# Just a body, no marker'), null);
});

test('parseMarker: empty plural list → null', () => {
  assert.equal(parseMarker('<!-- project-pr-checkins:  -->'), null);
});

test('parseMarker: malformed (alpha) → null', () => {
  assert.equal(parseMarker('<!-- project-pr-checkins: abc,02 -->'), null);
});

test('parseMarker: malformed singular → null', () => {
  assert.equal(parseMarker('<!-- project-pr-checkin: 0 -->'), null);
});

test('parseMarker: marker not at start of body still parsed', () => {
  const body = '## Summary\n\n<!-- project-pr-checkins: 7 -->\n\nrest';
  assert.deepEqual(parseMarker(body), [7]);
});

test('compareState: M==D → fresh', () => {
  assert.equal(compareState([1, 2, 3], [1, 2, 3]), 'fresh');
});

test('compareState: M⊂D → stale', () => {
  assert.equal(compareState([1, 2], [1, 2, 3]), 'stale');
});

test('compareState: M⊃D → drift', () => {
  assert.equal(compareState([1, 2, 3, 4], [1, 2, 3]), 'drift');
});

test('compareState: partial overlap → drift', () => {
  assert.equal(compareState([1, 4], [1, 2, 3]), 'drift');
});

test('compareState: M=null → stale (rewrite)', () => {
  assert.equal(compareState(null, [1, 2]), 'stale');
});

test('checkRationale: contains "because"', () => {
  assert.equal(checkRationale('We do this because of compliance'), true);
});

test('checkRationale: contains "to ensure"', () => {
  assert.equal(checkRationale('Refactor to ensure idempotence'), true);
});

test('checkRationale: case insensitive', () => {
  assert.equal(checkRationale('Address the leak in main'), true);
});

test('checkRationale: no rationale words', () => {
  assert.equal(checkRationale('Add a button to the header'), false);
});

test('analyzeWhyCheck: all thin → thin', () => {
  const result = analyzeWhyCheck(null, null, 'Phase 1', ['Add tokens', 'Move files']);
  assert.equal(result.thin, true);
});

test('analyzeWhyCheck: substantive plan context → not thin', () => {
  const longContext = 'A long enough motivation paragraph that explains the underlying constraint for this entire effort and the prior incident that motivated it.';
  const result = analyzeWhyCheck(longContext, null, 'Phase 1', ['Add tokens']);
  assert.equal(result.thin, false);
  assert.equal(result.sourceSummary.planContext, longContext);
});

test('analyzeWhyCheck: substantive phase lead → not thin', () => {
  const lead = 'Significantly longer phase lead paragraph that provides context beyond the title';
  const result = analyzeWhyCheck(null, lead, 'Phase 1', ['Add tokens']);
  assert.equal(result.thin, false);
  assert.equal(result.sourceSummary.phaseLead, lead);
});

test('analyzeWhyCheck: any rationale goal → not thin', () => {
  const result = analyzeWhyCheck(null, null, 'Phase 1', ['Move files', 'Add gate to prevent the leak']);
  assert.equal(result.thin, false);
  assert.equal(result.sourceSummary.checkinGoalsRationale, true);
});

// ---------------------------------------------------------------------------
// Checkin enumeration tests
// ---------------------------------------------------------------------------

test('enumerateCheckinFiles: filters NN.md, sorts numerically', () => {
  const root = mkdtempSync(join(tmpdir(), 'prp-enum-'));
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, '01.md'), 'a');
    writeFileSync(join(root, '03.md'), 'b');
    writeFileSync(join(root, '02.md'), 'c');
    writeFileSync(join(root, 'notes.md'), 'd');
    writeFileSync(join(root, '99-broken.md'), 'e');
    writeFileSync(join(root, '00.md'), 'f'); // 0 is rejected
    const result = enumerateCheckinFiles(root);
    assert.deepEqual(result.map((r) => r.number), [1, 2, 3]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('enumerateCheckinFiles: missing dir → empty', () => {
  const root = mkdtempSync(join(tmpdir(), 'prp-enum-empty-'));
  try {
    assert.deepEqual(enumerateCheckinFiles(join(root, 'nope')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseCheckin: extracts Phase, Unit, Goal', () => {
  const root = mkdtempSync(join(tmpdir(), 'prp-parse-'));
  try {
    const file = join(root, '07.md');
    writeFileSync(file, [
      '# Checkin 07',
      '',
      '**Phase**: 1.5 — Substrate primitive cleanup',
      '**Unit**: Extract pr-plumbing',
      '',
      '## Contract',
      '',
      '**Goal**: Author the script and tests so future invocations have a deterministic plumbing surface.',
      '',
      '**Acceptance criteria**:',
    ].join('\n'));
    const meta = parseCheckin(file);
    assert.equal(meta.number, 7);
    assert.equal(meta.phase, '1.5 — Substrate primitive cleanup');
    assert.equal(meta.unit, 'Extract pr-plumbing');
    assert.match(meta.goal, /Author the script and tests/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integration test infrastructure
// ---------------------------------------------------------------------------

type RunResult = { stdout: string; stderr: string; status: number };

type Fixture = {
  root: string;
  projectDir: string;
  slug: string;
  branch: string;
  bareRemote: string;
  mocksDir: string;
  cleanup: () => void;
};

function buildMockGh(): string {
  // Node script that handles `gh pr list/view/create/edit` based on env vars.
  return `#!/usr/bin/env node
const args = process.argv.slice(2);
const sub = args[0] + ' ' + args[1];
const env = process.env;
function out(s) { process.stdout.write(s); }
function err(s, code = 1) { process.stderr.write(s); process.exit(code); }
if (sub === 'pr list') {
  out((env.GH_PR_LIST_RESPONSE ?? '[]') + '\\n');
  process.exit(0);
}
if (sub === 'pr view') {
  const body = env.GH_PR_VIEW_BODY ?? '';
  out(JSON.stringify({ body }) + '\\n');
  process.exit(0);
}
if (sub === 'pr create') {
  const url = env.GH_PR_CREATE_URL ?? 'https://github.com/owner/repo/pull/42';
  out(url + '\\n');
  process.exit(0);
}
if (sub === 'pr edit') {
  const code = Number(env.GH_PR_EDIT_EXIT_CODE ?? 0);
  if (code !== 0) err('mock gh pr edit failure\\n', code);
  process.exit(0);
}
err('mock gh: unsupported subcommand: ' + args.join(' ') + '\\n', 2);
`;
}

function buildMockGit(realGitPath: string): string {
  // Node script that intercepts `git push` (for retry tests) and forwards
  // everything else to real git. Real-push tests should NOT set
  // GIT_PUSH_FAIL_COUNT, so push falls through to real git against the
  // bare remote.
  return `#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const args = process.argv.slice(2);
const env = process.env;
function forward() {
  try {
    const stdout = execFileSync(${JSON.stringify(realGitPath)}, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    process.stdout.write(stdout);
    process.exit(0);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    process.exit(e.status ?? 1);
  }
}
if (args[0] === 'push' && env.GIT_PUSH_FAIL_COUNT) {
  const counterFile = env.GIT_PUSH_COUNTER_FILE;
  let count = 0;
  if (counterFile && existsSync(counterFile)) {
    count = Number(readFileSync(counterFile, 'utf-8')) || 0;
  }
  count += 1;
  if (counterFile) writeFileSync(counterFile, String(count));
  if (count <= Number(env.GIT_PUSH_FAIL_COUNT)) {
    process.stderr.write('fatal: Could not resolve host: github.com (mock failure ' + count + ')\\n');
    process.exit(128);
  }
}
forward();
`;
}

function setupFixture(opts: { slug?: string; branch?: string } = {}): Fixture {
  const slug = opts.slug ?? '2026-05-02-agent-guilds';
  const branch = opts.branch ?? 'ev.test.branch';
  const root = mkdtempSync(join(tmpdir(), 'prp-fixture-'));
  // Determine real git path (must be done before mocks shim PATH).
  const realGitPath = execFileSync('which', ['git'], { encoding: 'utf-8' }).trim();
  // Set up working repo
  mkdirSync(join(root, 'projects', slug, 'checkins', branch), { recursive: true });
  writeFileSync(join(root, 'projects', slug, 'MANIFEST.md'), `# Project: Test\n\n## Events\n\n| When | Event | Detail |\n|------|-------|--------|\n`);
  writeFileSync(join(root, 'projects', slug, 'PLAN.md'), `# Plan\n\n## Context\n\nA testing context paragraph long enough to count as substantive prose for the why-check heuristic.\n\n### Phase 1.5: Substrate primitive cleanup\n\nThis is the phase lead paragraph.\n`);
  writeFileSync(join(root, 'projects', slug, 'config.md'), `# Config\n\n## PR settings\n- Base branch: main\n`);
  // .gitignore excludes test-only artifacts (mocks dir, body files)
  writeFileSync(join(root, '.gitignore'), '.mocks/\nbody.md\n.push-counter\n');
  // Init git, configure
  execFileSync(realGitPath, ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync(realGitPath, ['config', 'user.email', 't@t'], { cwd: root });
  execFileSync(realGitPath, ['config', 'user.name', 't'], { cwd: root });
  execFileSync(realGitPath, ['config', 'commit.gpgsign', 'false'], { cwd: root });
  execFileSync(realGitPath, ['add', '.'], { cwd: root });
  execFileSync(realGitPath, ['commit', '-q', '-m', 'init'], { cwd: root });
  // Set up bare remote and add as origin
  const bareRemote = mkdtempSync(join(tmpdir(), 'prp-bare-'));
  execFileSync(realGitPath, ['init', '-q', '--bare'], { cwd: bareRemote });
  execFileSync(realGitPath, ['remote', 'add', 'origin', bareRemote], { cwd: root });
  execFileSync(realGitPath, ['remote', 'set-url', 'origin', 'https://github.com/owner/repo.git', '--push'], { cwd: root });
  // Actually we need a real push target — keep set-url pointing at the bare,
  // but parseRepoFromGitRemote needs to extract owner/repo. Use a hack:
  // configure remote.origin.url to a github-style URL but remote.origin.pushurl
  // to the bare path.
  execFileSync(realGitPath, ['config', 'remote.origin.url', 'https://github.com/owner/repo.git'], { cwd: root });
  execFileSync(realGitPath, ['config', 'remote.origin.pushurl', bareRemote], { cwd: root });
  // Create the test branch
  execFileSync(realGitPath, ['checkout', '-q', '-b', branch], { cwd: root });
  // Set up mocks dir
  const mocksDir = join(root, '.mocks');
  mkdirSync(mocksDir, { recursive: true });
  writeFileSync(join(mocksDir, 'gh'), buildMockGh(), { mode: 0o755 });
  writeFileSync(join(mocksDir, 'git'), buildMockGit(realGitPath), { mode: 0o755 });
  chmodSync(join(mocksDir, 'gh'), 0o755);
  chmodSync(join(mocksDir, 'git'), 0o755);
  return {
    root,
    projectDir: join(root, 'projects', slug),
    slug,
    branch,
    bareRemote,
    mocksDir,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(bareRemote, { recursive: true, force: true });
    },
  };
}

function runScript(
  args: string[],
  fixture: Fixture,
  envExtra: Record<string, string> = {},
): RunResult {
  const env = {
    ...process.env,
    PATH: `${fixture.mocksDir}:${process.env.PATH}`,
    PR_PLUMBING_FAST_BACKOFF: '1',
    ...envExtra,
  };
  const res = spawnSync('node', [SCRIPT, ...args], {
    cwd: fixture.root,
    encoding: 'utf-8',
    env,
  });
  return { stdout: res.stdout ?? '', stderr: res.stderr ?? '', status: res.status ?? 1 };
}

function writeCheckin(fixture: Fixture, n: number, opts: { goal?: string } = {}): void {
  const padded = String(n).padStart(2, '0');
  const goal = opts.goal ?? `Test goal ${n}`;
  const content = [
    `# Checkin ${padded}`,
    '',
    `**Phase**: 1.5 — Substrate primitive cleanup`,
    `**Unit**: Test unit ${n}`,
    '',
    `## Contract`,
    '',
    `**Goal**: ${goal}`,
    '',
  ].join('\n');
  writeFileSync(
    join(fixture.projectDir, 'checkins', fixture.branch, `${padded}.md`),
    content,
  );
}

// ---------------------------------------------------------------------------
// Integration: inspect
// ---------------------------------------------------------------------------

test('inspect: no PR + no checkins → state new, disk empty', () => {
  const f = setupFixture();
  try {
    const res = runScript(['inspect', f.slug, f.branch], f, { GH_PR_LIST_RESPONSE: '[]' });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.state, 'new');
    assert.deepEqual(json.disk, []);
    assert.equal(json.markerSet, null);
    assert.equal(json.pr, null);
    assert.deepEqual(json.repo, { owner: 'owner', name: 'repo' });
  } finally { f.cleanup(); }
});

test('inspect: PR with matching marker → fresh', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    writeCheckin(f, 2);
    const res = runScript(['inspect', f.slug, f.branch], f, {
      GH_PR_LIST_RESPONSE: JSON.stringify([{ number: 99, url: 'https://github.com/owner/repo/pull/99' }]),
      GH_PR_VIEW_BODY: '<!-- project-pr-checkins: 01,02 -->\n\n## Body',
    });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.state, 'fresh');
    assert.deepEqual(json.disk, [1, 2]);
    assert.deepEqual(json.markerSet, [1, 2]);
    assert.equal(json.pr.number, 99);
  } finally { f.cleanup(); }
});

test('inspect: PR with subset marker → stale', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    writeCheckin(f, 2);
    writeCheckin(f, 3);
    const res = runScript(['inspect', f.slug, f.branch], f, {
      GH_PR_LIST_RESPONSE: JSON.stringify([{ number: 99, url: 'https://github.com/owner/repo/pull/99' }]),
      GH_PR_VIEW_BODY: '<!-- project-pr-checkins: 01,02 -->',
    });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.state, 'stale');
  } finally { f.cleanup(); }
});

test('inspect: PR with marker referencing nonexistent checkin → drift', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    const res = runScript(['inspect', f.slug, f.branch], f, {
      GH_PR_LIST_RESPONSE: JSON.stringify([{ number: 99, url: 'https://github.com/owner/repo/pull/99' }]),
      GH_PR_VIEW_BODY: '<!-- project-pr-checkins: 01,02 -->',
    });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.state, 'drift');
  } finally { f.cleanup(); }
});

test('inspect: PR with missing marker → stale (rewrite path)', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    const res = runScript(['inspect', f.slug, f.branch], f, {
      GH_PR_LIST_RESPONSE: JSON.stringify([{ number: 99, url: 'https://github.com/owner/repo/pull/99' }]),
      GH_PR_VIEW_BODY: '## A body with no marker',
    });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.state, 'stale');
    assert.equal(json.markerSet, null);
  } finally { f.cleanup(); }
});

test('inspect: why-check substantive (PLAN context present)', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    const res = runScript(['inspect', f.slug, f.branch], f, { GH_PR_LIST_RESPONSE: '[]' });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse(res.stdout);
    assert.equal(json.whyCheck.thin, false);
  } finally { f.cleanup(); }
});

// ---------------------------------------------------------------------------
// Integration: commit
// ---------------------------------------------------------------------------

test('commit: no-op when working tree clean', () => {
  const f = setupFixture();
  try {
    const res = runScript(['commit', f.slug, f.branch, '--message=x'], f);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^no-op/);
  } finally { f.cleanup(); }
});

test('commit: stages substrate paths and pushes by default', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    writeFileSync(join(f.root, 'someCode.ts'), 'export const x = 1;\n');
    const res = runScript(['commit', f.slug, f.branch, '--message=test commit'], f);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /pushed$/m);
    // Verify both files are in the new commit
    const files = execFileSync('git', ['show', '--stat', '--name-only', '--pretty=format:', 'HEAD'], { cwd: f.root, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    assert.ok(files.includes(`projects/${f.slug}/checkins/${f.branch}/01.md`), `expected checkin file in commit: ${files.join(', ')}`);
    assert.ok(files.includes('someCode.ts'));
  } finally { f.cleanup(); }
});

test('commit: --no-push commits but does not push', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    const res = runScript(['commit', f.slug, f.branch, '--message=local-only', '--no-push'], f);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /commit-only$/m);
    // Local has the commit
    const headLog = execFileSync('git', ['log', '--oneline', '-1'], { cwd: f.root, encoding: 'utf-8' });
    assert.match(headLog, /local-only/);
    // Bare remote does NOT have it (no push happened)
    const remoteLog = spawnSync('git', ['--git-dir', f.bareRemote, 'log', '--oneline', f.branch], { encoding: 'utf-8' });
    assert.notEqual(remoteLog.status, 0, 'bare remote should not yet have the branch');
  } finally { f.cleanup(); }
});

test('commit: excludes settings.local.json and next-env.d.ts', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    mkdirSync(join(f.root, '.claude'), { recursive: true });
    writeFileSync(join(f.root, '.claude/settings.local.json'), '{}\n');
    writeFileSync(join(f.root, 'next-env.d.ts'), '// next env\n');
    writeFileSync(join(f.root, 'normal.ts'), 'ok\n');
    const res = runScript(['commit', f.slug, f.branch, '--message=test'], f);
    assert.equal(res.status, 0, res.stderr);
    // Verify excluded files are NOT in the commit
    const files = execFileSync('git', ['show', '--stat', '--name-only', '--pretty=format:', 'HEAD'], { cwd: f.root, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    assert.ok(!files.includes('.claude/settings.local.json'), 'settings.local.json should be excluded');
    assert.ok(!files.includes('next-env.d.ts'), 'next-env.d.ts should be excluded');
    assert.ok(files.includes('normal.ts'));
  } finally { f.cleanup(); }
});

test('commit: rejects empty --message', () => {
  const f = setupFixture();
  try {
    const res = runScript(['commit', f.slug, f.branch, '--message='], f);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /--message is required/);
  } finally { f.cleanup(); }
});

// ---------------------------------------------------------------------------
// Integration: push
// ---------------------------------------------------------------------------

test('push: succeeds against bare remote', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    runScript(['commit', f.slug, f.branch, '--message=preflight', '--no-push'], f);
    const res = runScript(['push', f.branch], f);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^pushed/);
  } finally { f.cleanup(); }
});

test('push: retries on transient network errors', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    runScript(['commit', f.slug, f.branch, '--message=preflight', '--no-push'], f);
    const counterFile = join(f.root, '.push-counter');
    const res = runScript(['push', f.branch], f, {
      GIT_PUSH_FAIL_COUNT: '2',
      GIT_PUSH_COUNTER_FILE: counterFile,
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^pushed/);
    // 2 transient failures + 1 success = 3 attempts
    assert.equal(readFileSync(counterFile, 'utf-8'), '3');
  } finally { f.cleanup(); }
});

test('push: surfaces failure after retry budget exhausted', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    runScript(['commit', f.slug, f.branch, '--message=preflight', '--no-push'], f);
    const res = runScript(['push', f.branch], f, {
      GIT_PUSH_FAIL_COUNT: '99',
    });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /push-failed|Could not resolve host/);
  } finally { f.cleanup(); }
});

// ---------------------------------------------------------------------------
// Integration: submit
// ---------------------------------------------------------------------------

test('submit: creates new PR + autosaves + commits MANIFEST + pushes', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    runScript(['commit', f.slug, f.branch, '--message=preflight'], f);
    const bodyFile = join(f.root, 'body.md');
    writeFileSync(bodyFile, '# PR body\n');
    const res = runScript(
      ['submit', f.slug, f.branch, '--title=Test PR', `--body-file=${bodyFile}`],
      f,
      {
        GH_PR_LIST_RESPONSE: '[]',
        GH_PR_CREATE_URL: 'https://github.com/owner/repo/pull/42',
      },
    );
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^pr: created #42/);
    // Verify last commit is the tracking commit
    const lastCommitMsg = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: f.root, encoding: 'utf-8' }).trim();
    assert.match(lastCommitMsg, /Track PR #42 opened from checkin 01 in MANIFEST/);
    // Verify MANIFEST got an event line (autosave was called)
    const manifest = readFileSync(join(f.projectDir, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /pr-opened/);
    // Verify MANIFEST is fully committed (atomicity invariant: no uncommitted MANIFEST)
    const manifestStatus = execFileSync('git', ['status', '--porcelain', '--', `projects/${f.slug}/MANIFEST.md`], { cwd: f.root, encoding: 'utf-8' });
    assert.equal(manifestStatus.trim(), '', `MANIFEST has uncommitted changes after submit: ${manifestStatus}`);
  } finally { f.cleanup(); }
});

test('submit: edits existing PR + autosaves + commits MANIFEST + pushes', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    writeCheckin(f, 2);
    runScript(['commit', f.slug, f.branch, '--message=preflight'], f);
    const bodyFile = join(f.root, 'body.md');
    writeFileSync(bodyFile, '# PR body v2\n');
    const res = runScript(
      ['submit', f.slug, f.branch, '--title=Test PR v2', `--body-file=${bodyFile}`],
      f,
      {
        GH_PR_LIST_RESPONSE: JSON.stringify([{ number: 13, url: 'https://github.com/owner/repo/pull/13' }]),
        GH_PR_VIEW_BODY: '<!-- project-pr-checkins: 01 -->',
      },
    );
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^pr: updated #13/);
    const lastCommitMsg = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: f.root, encoding: 'utf-8' }).trim();
    assert.match(lastCommitMsg, /Track PR #13 re-author for checkins 01,02 in MANIFEST/);
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: f.root, encoding: 'utf-8' });
    assert.equal(status.trim(), '', `working tree not clean after submit: ${status}`);
  } finally { f.cleanup(); }
});

test('submit: missing body file → fails fast', () => {
  const f = setupFixture();
  try {
    const res = runScript(
      ['submit', f.slug, f.branch, '--title=x', `--body-file=${join(f.root, 'nope.md')}`],
      f,
      { GH_PR_LIST_RESPONSE: '[]' },
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /body file not found/);
  } finally { f.cleanup(); }
});

test('submit: gh create failure surfaces and does not autosave', () => {
  const f = setupFixture();
  try {
    writeCheckin(f, 1);
    runScript(['commit', f.slug, f.branch, '--message=preflight'], f);
    const bodyFile = join(f.root, 'body.md');
    writeFileSync(bodyFile, '# body\n');
    // Mock gh create to fail by removing GH_PR_CREATE_URL and simulating failure via a separate env var.
    // Simplest path: build a custom mock that exits non-zero on create.
    writeFileSync(join(f.mocksDir, 'gh'), `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0]==='pr' && a[1]==='list') { process.stdout.write('[]\\n'); process.exit(0); }
if (a[0]==='pr' && a[1]==='create') { process.stderr.write('mock gh create failure\\n'); process.exit(1); }
process.exit(2);
`, { mode: 0o755 });
    chmodSync(join(f.mocksDir, 'gh'), 0o755);
    const res = runScript(
      ['submit', f.slug, f.branch, '--title=x', `--body-file=${bodyFile}`],
      f,
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /gh-create-failed|mock gh create failure/);
    // MANIFEST should NOT have a pr-opened event
    const manifest = readFileSync(join(f.projectDir, 'MANIFEST.md'), 'utf-8');
    assert.doesNotMatch(manifest, /pr-opened/);
  } finally { f.cleanup(); }
});
