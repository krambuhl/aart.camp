import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/griot/capture.ts');

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
  const root = mkdtempSync(join(tmpdir(), 'capture-test-'));
  mkdirSync(join(root, 'learnings', 'session-notes'), { recursive: true });
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function writeCheckin(root: string, name: string, content: string): string {
  const path = join(root, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

const SINGLE_CORRECTION_CHECKIN = `# Checkin 01 — feat/x

**Created**: 2026-01-01 09:00
**Phase**: 1 — First
**Unit**: Migrate the widget to a script

## Contract

**Goal**: Move the widget to a script.

**Acceptance criteria**:
- New widget script exists
- Tests pass

## Execution

Step 1 — Authored the script.
Step 2 — Ran the tests.

## Notes for the PR

- A note about the work.
- correction: do not use \`tsx\` chains when Node 24 is available; \`node\` strips types natively.
- Another reviewer note.
`;

const MULTI_CORRECTION_CHECKIN = `# Checkin 02 — feat/x

**Created**: 2026-01-02 10:00
**Phase**: 1 — First
**Unit**: Two corrections in one unit

## Contract

**Goal**: Demonstrate multi-correction handling.

## Execution

Did the work.

## Notes for the PR

- correction: first correction line about pattern A.
- correction: second correction line about pattern B that wraps onto a
  second line for readability and should still be captured as one logical
  correction.
- A non-correction note.
`;

const NO_CORRECTION_CHECKIN = `# Checkin 03 — feat/x

**Created**: 2026-01-03 11:00
**Phase**: 1 — First
**Unit**: No corrections here

## Contract

**Goal**: Boring unit.

## Execution

Did it.

## Notes for the PR

- Just a regular note.
- Another regular note.
`;

const EMPTY_EXECUTION_CHECKIN = `# Checkin 04 — feat/x

**Created**: 2026-01-04 12:00
**Phase**: 1 — First
**Unit**: Empty execution fallback

## Contract

**Goal**: Test the wrong.md fallback path.

## Changes since previous checkin

Some changes were made.

## Evaluator verdict

approved

## Notes for the PR

- correction: this checkin has no Execution section so wrong.md should fall back.
`;

test('missing --from-checkin fails with required-arg message', () => {
  const fx = makeFixture();
  const res = run([], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--from-checkin=<path> is required/);
  assert.match(res.stderr, /usage:/);
  fx.cleanup();
});

test('nonexistent checkin path fails clean', () => {
  const fx = makeFixture();
  const res = run(['--from-checkin=does-not-exist.md'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /checkin not found/);
  fx.cleanup();
});

test('checkin with no correction lines fails informatively', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', NO_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no correction: lines found/);
  fx.cleanup();
});

test('single-correction happy path writes 5 files in <ts>-<slug> folder', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /^captured: learnings\/session-notes\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-migrate-the-widget-to-a/);
  const folders = readdirSync(join(fx.root, 'learnings', 'session-notes'));
  assert.equal(folders.length, 1);
  const folder = join(fx.root, 'learnings', 'session-notes', folders[0]);
  assert.ok(existsSync(join(folder, 'prompt.md')));
  assert.ok(existsSync(join(folder, 'wrong.md')));
  assert.ok(existsSync(join(folder, 'correction.md')));
  assert.ok(existsSync(join(folder, 'full_transcript.md')));
  assert.ok(existsSync(join(folder, 'learning.md')));
  fx.cleanup();
});

test('explicit --slug overrides Unit-derived slug', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`, '--slug=custom-slug-here'], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /-custom-slug-here/);
  fx.cleanup();
});

test('default slug derives from checkin Unit (kebab, capped at 5 tokens)', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /migrate-the-widget-to-a/);
  fx.cleanup();
});

test('correction.md contains the verbatim correction prefixed with "correction:"', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'correction.md'), 'utf-8');
  assert.match(correction, /^correction: do not use `tsx` chains/);
  fx.cleanup();
});

test('prompt.md contains Unit, Goal, and Acceptance criteria', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const prompt = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'prompt.md'), 'utf-8');
  assert.match(prompt, /Migrate the widget to a script/);
  assert.match(prompt, /Move the widget to a script\./);
  assert.match(prompt, /New widget script exists/);
  fx.cleanup();
});

test('full_transcript.md contains the entire checkin content unmodified', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const transcript = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'full_transcript.md'), 'utf-8');
  assert.equal(transcript, SINGLE_CORRECTION_CHECKIN);
  fx.cleanup();
});

test('learning.md is a draft template with correction text + provenance footer', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const learning = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'learning.md'), 'utf-8');
  assert.match(learning, /# Learning draft/);
  assert.match(learning, /do not use `tsx` chains/);
  assert.match(learning, /\/griot-compact/);
  fx.cleanup();
});

test('multi-correction checkin: --correction-text exact match captures the right one', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = run([
    `--from-checkin=${path}`,
    '--correction-text=first correction line about pattern A.',
    '--slug=first',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'correction.md'), 'utf-8');
  assert.match(correction, /^correction: first correction line about pattern A\./);
  fx.cleanup();
});

test('--correction-text matches a wrapped correction after whitespace normalization', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', MULTI_CORRECTION_CHECKIN);
  // Caller passes the joined-line form (no internal newlines); script collapses
  // both sides to single-spaces and matches.
  const res = run([
    `--from-checkin=${path}`,
    '--correction-text=second correction line about pattern B that wraps onto a second line for readability and should still be captured as one logical correction.',
    '--slug=second',
  ], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'correction.md'), 'utf-8');
  assert.match(correction, /^correction: second correction line about pattern B that wraps/);
  fx.cleanup();
});

test('--correction-text not found fails with available list', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`, '--correction-text=does not match anything'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /correction text not found in checkin/);
  assert.match(res.stderr, /available:/);
  assert.match(res.stderr, /first correction line/);
  fx.cleanup();
});

test('multi-correction checkin without --correction-text fails as ambiguous', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /ambiguous: checkin has 2 correction lines/);
  assert.match(res.stderr, /pass --correction-text=/);
  fx.cleanup();
});

test('wrong.md falls back to Changes/Verdict when Execution is empty', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', EMPTY_EXECUTION_CHECKIN);
  const res = run([`--from-checkin=${path}`], fx.root);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const folder = readdirSync(join(fx.root, 'learnings', 'session-notes'))[0];
  const wrong = readFileSync(join(fx.root, 'learnings', 'session-notes', folder, 'wrong.md'), 'utf-8');
  assert.match(wrong, /Execution section was empty; reconstructed/);
  assert.match(wrong, /Changes since previous checkin/);
  assert.match(wrong, /Some changes were made\./);
  assert.match(wrong, /Evaluator verdict/);
  assert.match(wrong, /approved/);
  fx.cleanup();
});

test('folder collision fails rather than overwriting', () => {
  const fx = makeFixture();
  const path = writeCheckin(fx.root, 'checkin.md', SINGLE_CORRECTION_CHECKIN);
  // Pre-create a 5-second window of collision folders. The script computes its own
  // UTC-second timestamp at subprocess start; if we only pre-create the current
  // second's folder, slow CI runners can land the subprocess in a later second and
  // miss the collision. Five seconds covers any reasonable Node startup latency.
  const tsAt = (offsetSeconds: number): string => {
    const d = new Date(Date.now() + offsetSeconds * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
  };
  for (let offset = 0; offset < 5; offset++) {
    mkdirSync(join(fx.root, 'learnings', 'session-notes', `${tsAt(offset)}-collide`), { recursive: true });
  }
  const res = run([`--from-checkin=${path}`, '--slug=collide'], fx.root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /folder already exists/);
  fx.cleanup();
});
