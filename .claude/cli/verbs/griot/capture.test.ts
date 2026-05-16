import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, beforeEach, afterEach } from 'vitest';
import { captureVerb } from './capture.ts';
import type { GriotCliContext } from './index.ts';

let root: string;
let ctx: GriotCliContext;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'capture-verb-test-'));
  mkdirSync(join(root, 'learnings', 'session-notes'), { recursive: true });
  ctx = { cwd: root };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeCheckin(name: string, content: string): string {
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
  const res = captureVerb([], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/--from-checkin=<path> is required/);
  expect(res.stderr).toMatch(/usage:/);
});

test('nonexistent checkin path fails clean', () => {
  const res = captureVerb(['--from-checkin=does-not-exist.md'], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/checkin not found/);
});

test('checkin with no correction lines fails informatively', () => {
  const path = writeCheckin('checkin.md', NO_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/no correction: lines found/);
});

test('single-correction happy path writes 6 files (5 MD + state.json) in <ts>-<slug> folder', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toMatch(/^captured: learnings\/session-notes\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-migrate-the-widget-to-a/);
  const folders = readdirSync(join(root, 'learnings', 'session-notes'));
  expect(folders.length).toBe(1);
  const folder = join(root, 'learnings', 'session-notes', folders[0]);
  expect(existsSync(join(folder, 'state.json'))).toBe(true);
  expect(existsSync(join(folder, 'prompt.md'))).toBe(true);
  expect(existsSync(join(folder, 'wrong.md'))).toBe(true);
  expect(existsSync(join(folder, 'correction.md'))).toBe(true);
  expect(existsSync(join(folder, 'full_transcript.md'))).toBe(true);
  expect(existsSync(join(folder, 'learning.md'))).toBe(true);
});

test('from-checkin writes state.json with classification: unclassified', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const stateRaw = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'state.json'),
    'utf-8',
  );
  const state = JSON.parse(stateRaw);
  expect(state).toEqual({
    classification: 'unclassified',
    evaluator: null,
    code: null,
    'frequency-count': null,
    'file-line': null,
    status: 'captured',
    promoted_as: null,
  });
});

test('from-checkin: learning.md is pure prose, no YAML frontmatter', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const learning = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'learning.md'),
    'utf-8',
  );
  expect(learning.startsWith('---\n')).toBe(false);
  expect(learning).toMatch(/^# Learning draft/);
});

test('explicit --slug overrides Unit-derived slug', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb(
    [`--from-checkin=${path}`, '--slug=custom-slug-here'],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toMatch(/-custom-slug-here/);
});

test('default slug derives from checkin Unit (kebab, capped at 5 tokens)', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toMatch(/migrate-the-widget-to-a/);
});

test('correction.md contains the verbatim correction prefixed with "correction:"', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'correction.md'),
    'utf-8',
  );
  expect(correction).toMatch(/^correction: do not use `tsx` chains/);
});

test('prompt.md contains Unit, Goal, and Acceptance criteria', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const prompt = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'prompt.md'),
    'utf-8',
  );
  expect(prompt).toMatch(/Migrate the widget to a script/);
  expect(prompt).toMatch(/Move the widget to a script\./);
  expect(prompt).toMatch(/New widget script exists/);
});

test('full_transcript.md contains the entire checkin content unmodified', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const transcript = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'full_transcript.md'),
    'utf-8',
  );
  expect(transcript).toBe(SINGLE_CORRECTION_CHECKIN);
});

test('learning.md is a draft template with correction text + provenance footer', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const learning = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'learning.md'),
    'utf-8',
  );
  expect(learning).toMatch(/# Learning draft/);
  expect(learning).toMatch(/do not use `tsx` chains/);
  expect(learning).toMatch(/\/griot-compact/);
});

test('multi-correction checkin: --correction-text exact match captures the right one', () => {
  const path = writeCheckin('checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = captureVerb(
    [
      `--from-checkin=${path}`,
      '--correction-text=first correction line about pattern A.',
      '--slug=first',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'correction.md'),
    'utf-8',
  );
  expect(correction).toMatch(/^correction: first correction line about pattern A\./);
});

test('--correction-text matches a wrapped correction after whitespace normalization', () => {
  const path = writeCheckin('checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = captureVerb(
    [
      `--from-checkin=${path}`,
      '--correction-text=second correction line about pattern B that wraps onto a second line for readability and should still be captured as one logical correction.',
      '--slug=second',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const correction = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'correction.md'),
    'utf-8',
  );
  expect(correction).toMatch(/^correction: second correction line about pattern B that wraps/);
});

test('--correction-text not found fails with available list', () => {
  const path = writeCheckin('checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = captureVerb(
    [`--from-checkin=${path}`, '--correction-text=does not match anything'],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/correction text not found in checkin/);
  expect(res.stderr).toMatch(/available:/);
  expect(res.stderr).toMatch(/first correction line/);
});

test('multi-correction checkin without --correction-text fails as ambiguous', () => {
  const path = writeCheckin('checkin.md', MULTI_CORRECTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/ambiguous: checkin has 2 correction lines/);
  expect(res.stderr).toMatch(/pass --correction-text=/);
});

test('wrong.md falls back to Changes/Verdict when Execution is empty', () => {
  const path = writeCheckin('checkin.md', EMPTY_EXECUTION_CHECKIN);
  const res = captureVerb([`--from-checkin=${path}`], ctx);
  expect(res.exitCode).toBe(0);
  const folder = readdirSync(join(root, 'learnings', 'session-notes'))[0];
  const wrong = readFileSync(
    join(root, 'learnings', 'session-notes', folder, 'wrong.md'),
    'utf-8',
  );
  expect(wrong).toMatch(/Execution section was empty; reconstructed/);
  expect(wrong).toMatch(/Changes since previous checkin/);
  expect(wrong).toMatch(/Some changes were made\./);
  expect(wrong).toMatch(/Evaluator verdict/);
  expect(wrong).toMatch(/approved/);
});

test('--evaluator-finding=recurring writes state.json with classification fields and pure-prose learning.md', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=recurring',
      '--evaluator-name=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=#000 at Sketch.module.css:17',
      '--frequency-count=3',
      '--slug=recurring-tokens-raw-hex',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toMatch(/^captured: learnings\/session-notes\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-recurring-tokens-raw-hex/);
  const folders = readdirSync(join(root, 'learnings', 'session-notes'));
  expect(folders.length).toBe(1);
  const folder = join(root, 'learnings', 'session-notes', folders[0]);
  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state).toEqual({
    classification: 'recurring',
    evaluator: 'evaluator-tokens',
    code: 'raw-hex',
    'frequency-count': 3,
    'file-line': null,
    status: 'captured',
    promoted_as: null,
  });
  const learning = readFileSync(join(folder, 'learning.md'), 'utf-8');
  expect(learning.startsWith('---\n')).toBe(false);
  expect(learning).toMatch(/^# Learning draft/);
  expect(learning).toMatch(/Recurring evaluator finding/);
  expect(learning).toMatch(/#000 at Sketch.module.css:17/);
});

test('--evaluator-finding=generator-antipattern writes state.json with classification fields and pure-prose learning.md', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=generator-antipattern',
      '--evaluator-name=evaluator-css-architecture',
      '--code=css-arch-specificity-fight',
      '--evidence=`.card .button` selector reaches into inner primitive',
      '--slug=gen-antipattern-card-reach',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  const folders = readdirSync(join(root, 'learnings', 'session-notes'));
  const folder = join(root, 'learnings', 'session-notes', folders[0]);
  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state.classification).toBe('generator-antipattern');
  expect(state.evaluator).toBe('evaluator-css-architecture');
  expect(state.code).toBe('css-arch-specificity-fight');
  expect(state['frequency-count']).toBe(null);
  expect(state.status).toBe('captured');
  expect(state.promoted_as).toBe(null);
  const learning = readFileSync(join(folder, 'learning.md'), 'utf-8');
  expect(learning.startsWith('---\n')).toBe(false);
  expect(learning).toMatch(/Generator antipattern/);
});

test('--evaluator-finding=recurring requires --frequency-count', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=recurring',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
      '--slug=missing-freq',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/--frequency-count=<N> is required when --evaluator-finding=recurring/);
});

test('--evaluator-finding=catalog-gap errors with not-yet-supported', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=catalog-gap',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/capture-error: not-yet-supported: catalog-gap/);
});

test('--evaluator-finding=evaluator-conflict errors with not-yet-supported', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=evaluator-conflict',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/capture-error: not-yet-supported: evaluator-conflict/);
});

test('--evaluator-finding=sanctioned-exception errors with not-yet-supported', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=sanctioned-exception',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/capture-error: not-yet-supported: sanctioned-exception/);
});

test('--evaluator-finding=unknown errors with valid-classifications hint', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=invented',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/capture-error: unknown classification 'invented'/);
});

test('--evaluator-finding requires --evaluator-name, --code, --evidence', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=recurring',
      '--code=c',
      '--evidence=x',
      '--frequency-count=3',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/--evaluator-name=<name> is required with --evaluator-finding/);
});

test('--evaluator-finding and --from-checkin are mutually exclusive', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  const res = captureVerb(
    [
      `--from-checkin=${path}`,
      '--evaluator-finding=recurring',
      '--evaluator-name=e',
      '--code=c',
      '--evidence=x',
      '--frequency-count=3',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/--evaluator-finding and --from-checkin are mutually exclusive/);
});

test('--evaluator-finding=recurring with --file-line populates state.json and learning body Source line', () => {
  const res = captureVerb(
    [
      '--evaluator-finding=recurring',
      '--evaluator-name=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=#000',
      '--frequency-count=4',
      '--file-line=components/Sketch.module.css:17',
      '--slug=recurring-with-file-line',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  const folders = readdirSync(join(root, 'learnings', 'session-notes'));
  const folder = join(root, 'learnings', 'session-notes', folders[0]);
  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state['file-line']).toBe('components/Sketch.module.css:17');
  const learning = readFileSync(join(folder, 'learning.md'), 'utf-8');
  expect(learning).toMatch(/Source: `components\/Sketch.module.css:17`/);
});

test('folder collision fails rather than overwriting', () => {
  const path = writeCheckin('checkin.md', SINGLE_CORRECTION_CHECKIN);
  // Pre-create a 5-second window of collision folders so a slow runner that
  // lands the verb call in a later second still hits the collision.
  const tsAt = (offsetSeconds: number): string => {
    const d = new Date(Date.now() + offsetSeconds * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
  };
  for (let offset = 0; offset < 5; offset++) {
    mkdirSync(
      join(root, 'learnings', 'session-notes', `${tsAt(offset)}-collide`),
      { recursive: true },
    );
  }
  const res = captureVerb([`--from-checkin=${path}`, '--slug=collide'], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/folder already exists/);
});
