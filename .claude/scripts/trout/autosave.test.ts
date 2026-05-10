// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/autosave.ts');

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

function makeFixture(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'autosave-test-'));
  mkdirSync(join(root, 'projects'), { recursive: true });
  mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
  writeFileSync(join(root, 'projects', 'CONVENTIONS.md'), CONVENTIONS_MD_FIXTURE);
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function makeProject(root: string, dirname: string): string {
  const path = join(root, 'projects', dirname);
  mkdirSync(join(path, 'sessions'), { recursive: true });
  mkdirSync(join(path, 'checkins'), { recursive: true });
  writeFileSync(join(path, 'MANIFEST.md'), MANIFEST_FIXTURE);
  return path;
}

const CONVENTIONS_MD_FIXTURE = `# Project substrate conventions

## Event vocabulary

| Event | Detail format | Emitter |
|-------|---------------|---------|
| \`project-initialized\` | — | x |
| \`checkin-created\` | a | x |
| \`pr-opened\` | b | x |
| \`pr-merged\` | c | x |
| \`note\` | d | x |
| \`session-saved\` | e | x |

## Other section
`;

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

test('no args fails with missing-identifier and prints usage hint', () => {
  const fx = makeFixture();
  const res = run([], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /missing project identifier/);
  assert.match(res.stderr, /usage:/);
  fx.cleanup();
});

test('unknown event is rejected and lists vocabulary', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test', '--event=invented-event'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown event "invented-event"/);
  assert.match(res.stderr, /pr-opened/);
  fx.cleanup();
});

test('project resolution: exact slug match', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['2026-01-01-test', '--event=note', '--detail=hi'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /^autosave: 2026-01-01-test note @ /);
  fx.cleanup();
});

test('project resolution: bare-name suffix match', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run(['test', '--event=note', '--detail=hi'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /^autosave: 2026-01-01-test note @ /);
  fx.cleanup();
});

test('project resolution: multiple matches fails with candidates', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  makeProject(fx.root, '2026-02-01-test');
  const res = run(['test', '--event=note'], fx.root);
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
  const res = run(['old', '--event=note'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /archived/);
  fx.cleanup();
});

test('event row append: timestamp, event, and detail formatted into table', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run(['test', '--event=pr-opened', '--detail=#42'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const eventLines = manifest.split('## Events')[1].split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| When'));
  assert.equal(eventLines.length, 2);
  const newRow = eventLines[1];
  assert.match(newRow, /^\| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| pr-opened \| #42 \|$/);
  fx.cleanup();
});

test('event row append: empty detail becomes em-dash', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run(['test', '--event=note'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const lastRow = manifest.split('\n').filter((l) => l.startsWith('|') && l.includes('note')).at(-1);
  assert.match(lastRow!, /\| note \| — \|/);
  fx.cleanup();
});

test('phase-update rewrites a row, preserving unspecified columns', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=checkin-created',
    '--detail=03 on feat/x',
    '--phase-update=1:in-progress:branch=feat/x:checkin=03',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const phase1Row = manifest.split('\n').find((l) => l.startsWith('| 1 |'));
  assert.ok(phase1Row, 'expected phase 1 row');
  assert.match(phase1Row!, /\| 1 \| First \| in-progress \| feat\/x \| 03 \| — \|/);
});

test('phase-update with multiple field updates', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=pr-opened',
    '--detail=#7',
    '--phase-update=1:in-progress:pr=#7 (open)',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const phase1Row = manifest.split('\n').find((l) => l.startsWith('| 1 |'));
  assert.match(phase1Row!, /\| 1 \| First \| in-progress \| feat\/x \| — \| #7 \(open\) \|/);
  fx.cleanup();
});

test('phase-update: invalid status is rejected', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=note',
    '--phase-update=1:nonsense',
  ], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /invalid phase status "nonsense"/);
  fx.cleanup();
});

test('phase-update: unknown phase is rejected', () => {
  const fx = makeFixture();
  makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=note',
    '--phase-update=99:in-progress',
  ], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /phase 99 not found/);
  fx.cleanup();
});

test('checkin-created event updates top-level Latest checkin field', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=checkin-created',
    '--detail=05 on feat/x',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  assert.match(manifest, /\*\*Latest checkin\*\*: checkins\/feat\/x\/05\.md/);
  fx.cleanup();
});

test('current-state replaces the Current state paragraph', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const res = run([
    'test',
    '--event=note',
    '--detail=updating state',
    '--current-state=Phase 1 unit 4: refactoring done; running tests.',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const currentSection = manifest.split('## Current state')[1].split('## Events')[0];
  assert.match(currentSection, /Phase 1 unit 4: refactoring done; running tests\./);
  assert.doesNotMatch(currentSection, /Starting work on phase 1\./);
  fx.cleanup();
});

test('pr-merged auto-flips (open) to (merged) in matching phase row', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const m0 = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8').replace('| — | — |\n| 2 ', '| — | #7 (open) |\n| 2 ');
  writeFileSync(join(proj, 'MANIFEST.md'), m0);
  const res = run(['test', '--event=pr-merged', '--detail=#7'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  const phase1Row = manifest.split('\n').find((l) => l.startsWith('| 1 |'));
  assert.match(phase1Row!, /#7 \(merged\)/);
  fx.cleanup();
});

test('preserves manual edits below Events table', () => {
  const fx = makeFixture();
  const proj = makeProject(fx.root, '2026-01-01-test');
  const m0 = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8') + '\n_Note appended manually by a human; should survive autosave._\n';
  writeFileSync(join(proj, 'MANIFEST.md'), m0);
  const res = run(['test', '--event=note', '--detail=ping'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const manifest = readFileSync(join(proj, 'MANIFEST.md'), 'utf-8');
  assert.match(manifest, /should survive autosave/);
  fx.cleanup();
});
