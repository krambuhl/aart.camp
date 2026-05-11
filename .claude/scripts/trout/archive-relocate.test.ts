// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/archive-relocate.ts');

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

const SAMPLE_MANIFEST = `# Project: Sample

**Slug**: 2026-01-01-sample
**Started**: 2026-01-01
**Status**: active
**Current branch**: ev.sample.phase-1
**Latest checkin**: checkins/ev.sample.phase-1/01.md

## Strategy

Sample.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | First | completed | ev.sample.phase-1 | 01 | #1 (merged) |

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-01-01 09:00 | project-initialized | — |
`;

function makeFixture(opts: { manifestStatus?: string; omitStatus?: boolean; slug?: string; initGit?: boolean } = {}): { root: string; projectPath: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'archive-relocate-test-'));
  const slug = opts.slug ?? '2026-01-01-sample';
  mkdirSync(join(root, 'projects', slug), { recursive: true });
  mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
  let manifest = SAMPLE_MANIFEST;
  if (opts.omitStatus) {
    manifest = manifest.replace(/^\*\*Status\*\*:.*\n/m, '');
  } else if (opts.manifestStatus !== undefined) {
    manifest = manifest.replace('**Status**: active', `**Status**: ${opts.manifestStatus}`);
  }
  writeFileSync(join(root, 'projects', slug, 'MANIFEST.md'), manifest);
  // a stray file inside the project so we can confirm the move carried contents
  writeFileSync(join(root, 'projects', slug, 'PLAN.md'), '# Plan\n');
  if (opts.initGit !== false) {
    const gitInit = spawnSync('git', ['init', '-q'], { cwd: root });
    assert.equal(gitInit.status, 0, 'git init failed in fixture');
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
  }
  return {
    root,
    projectPath: join(root, 'projects', slug),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('happy path: slug form relocates project and flips Status', () => {
  const fx = makeFixture();
  try {
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^relocated: .+\/projects\/2026-01-01-sample → .+\/projects\/archive\/2026-01-01-sample\n$/);
    const newPath = join(fx.root, 'projects', 'archive', '2026-01-01-sample');
    assert.ok(existsSync(newPath), 'destination directory should exist');
    assert.ok(!existsSync(fx.projectPath), 'source directory should be gone');
    const updatedManifest = readFileSync(join(newPath, 'MANIFEST.md'), 'utf-8');
    assert.match(updatedManifest, /^\*\*Status\*\*: archived$/m);
    assert.doesNotMatch(updatedManifest, /^\*\*Status\*\*: active$/m);
    assert.ok(existsSync(join(newPath, 'PLAN.md')), 'PLAN.md should travel with the move');
  } finally {
    fx.cleanup();
  }
});

test('happy path: relative path form', () => {
  const fx = makeFixture();
  try {
    const result = run(['./projects/2026-01-01-sample'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /relocated: /);
    assert.ok(existsSync(join(fx.root, 'projects', 'archive', '2026-01-01-sample')));
  } finally {
    fx.cleanup();
  }
});

test('happy path: absolute path form', () => {
  const fx = makeFixture();
  try {
    const result = run([fx.projectPath], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /relocated: /);
    assert.ok(existsSync(join(fx.root, 'projects', 'archive', '2026-01-01-sample')));
  } finally {
    fx.cleanup();
  }
});

test('happy path: suffix match on slug', () => {
  const fx = makeFixture({ slug: '2026-01-01-sample' });
  try {
    const result = run(['sample'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /2026-01-01-sample/);
  } finally {
    fx.cleanup();
  }
});

test('error: project not found', () => {
  const fx = makeFixture();
  try {
    const result = run(['does-not-exist'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: project not found/);
  } finally {
    fx.cleanup();
  }
});

test('error: project already archived (path form points under archive/)', () => {
  const fx = makeFixture();
  try {
    // pre-relocate to set up
    run(['2026-01-01-sample'], fx.root);
    const archivedPath = join(fx.root, 'projects', 'archive', '2026-01-01-sample');
    const result = run([archivedPath], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: project is archived \(read-only\)/);
  } finally {
    fx.cleanup();
  }
});

test('error: project already archived (slug form, finds it under archive/)', () => {
  const fx = makeFixture();
  try {
    run(['2026-01-01-sample'], fx.root);
    // now slug resolution should report it's archived
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: project is archived \(read-only\)/);
  } finally {
    fx.cleanup();
  }
});

test('error: status is not active (paused)', () => {
  const fx = makeFixture({ manifestStatus: 'paused' });
  try {
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: unexpected status: expected "active", found "paused"/);
    assert.match(result.stderr, /manifest at /);
    // confirm manifest unchanged
    const manifest = readFileSync(join(fx.projectPath, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /\*\*Status\*\*: paused/);
  } finally {
    fx.cleanup();
  }
});

test('error: manifest missing Status field', () => {
  const fx = makeFixture({ omitStatus: true });
  try {
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: manifest missing \*\*Status\*\* field/);
  } finally {
    fx.cleanup();
  }
});

test('error: destination already exists', () => {
  const fx = makeFixture();
  try {
    // pre-create the destination so the move would collide
    mkdirSync(join(fx.root, 'projects', 'archive', '2026-01-01-sample'));
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: destination already exists/);
    // manifest must still say active (we refused before flipping)
    const manifest = readFileSync(join(fx.projectPath, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /\*\*Status\*\*: active/);
  } finally {
    fx.cleanup();
  }
});

test('error: git ls-files precheck fails (no git repo) and leaves manifest untouched', () => {
  const fx = makeFixture({ initGit: false });
  try {
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: git ls-files failed:/);
    // manifest never modified — precheck fails before the Status flip
    const manifest = readFileSync(join(fx.projectPath, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /\*\*Status\*\*: active/);
    assert.doesNotMatch(manifest, /\*\*Status\*\*: archived/);
    assert.ok(statSync(fx.projectPath).isDirectory());
  } finally {
    fx.cleanup();
  }
});

test('error: project has no git-tracked files (repo exists, project never committed)', () => {
  const fx = makeFixture({ initGit: false });
  try {
    // initialise repo but never `git add` the project
    spawnSync('git', ['init', '-q'], { cwd: fx.root });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: fx.root });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: fx.root });
    // empty initial commit so HEAD exists but the project is untracked
    spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: fx.root });
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /archive-relocate-error: project has no git-tracked files/);
    assert.match(result.stderr, /commit project files before archiving/);
    // manifest untouched
    const manifest = readFileSync(join(fx.projectPath, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /\*\*Status\*\*: active/);
    assert.ok(statSync(fx.projectPath).isDirectory());
  } finally {
    fx.cleanup();
  }
});

test('happy path: rename + Status flip land atomically as one staged change', () => {
  const fx = makeFixture();
  try {
    const result = run(['2026-01-01-sample'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    // After archive-relocate, the working tree must be clean — the Status
    // flip should have been staged alongside the rename, not left as an
    // unstaged modification at the new path.
    const status = spawnSync('git', ['status', '--porcelain'], { cwd: fx.root, encoding: 'utf-8' });
    assert.equal(status.status, 0);
    const lines = (status.stdout ?? '').split('\n').filter(Boolean);
    const unstagedMod = lines.find((l) => /^.M /.test(l));
    assert.equal(unstagedMod, undefined, `expected no unstaged modifications; got: ${lines.join(' | ')}`);

    // The staged version of the manifest at the new path must already
    // carry the flipped Status.
    const show = spawnSync(
      'git',
      ['show', ':projects/archive/2026-01-01-sample/MANIFEST.md'],
      { cwd: fx.root, encoding: 'utf-8' },
    );
    assert.equal(show.status, 0, `git show stderr: ${show.stderr}`);
    assert.match(show.stdout, /^\*\*Status\*\*: archived$/m);
    assert.doesNotMatch(show.stdout, /^\*\*Status\*\*: active$/m);
  } finally {
    fx.cleanup();
  }
});

test('error: missing argument', () => {
  const fx = makeFixture();
  try {
    const result = run([], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing project argument/);
  } finally {
    fx.cleanup();
  }
});
