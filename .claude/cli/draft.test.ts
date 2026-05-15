import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  VERBS,
  parseInvocation,
  formatHelp,
  formatUnknownVerbError,
  dispatch,
} from './draft.ts';
import type { DraftCliContext } from './draft.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRAFT_ENTRY = join(__dirname, 'draft.ts');
const BIN_DRAFT = join(__dirname, '..', '..', 'bin', 'draft');

function makeCtx(): DraftCliContext {
  const root = mkdtempSync(join(tmpdir(), 'draft-dispatch-test-'));
  return {
    projectsRoot: root,
    today: '2026-05-15',
    gitRunner: {
      isCommitted: () => false,
      addAndCommit: () => undefined,
    },
  };
}

// ---------- Pure helper tests ----------

test('parseInvocation: no args → help', () => {
  expect(parseInvocation([])).toEqual({ kind: 'help' });
});

test('parseInvocation: --help → help', () => {
  expect(parseInvocation(['--help'])).toEqual({ kind: 'help' });
});

test('parseInvocation: -h → help', () => {
  expect(parseInvocation(['-h'])).toEqual({ kind: 'help' });
});

test('parseInvocation: known verb → verb with rest', () => {
  expect(parseInvocation(['plan', 'adopt-biome', '--plan-file=p.md'])).toEqual({
    kind: 'verb',
    verb: 'plan',
    rest: ['adopt-biome', '--plan-file=p.md'],
  });
});

test('parseInvocation: unknown verb → unknown', () => {
  expect(parseInvocation(['xyzzy'])).toEqual({ kind: 'unknown', verb: 'xyzzy' });
});

test('parseInvocation: --help after verb still routes to help', () => {
  expect(parseInvocation(['plan', '--help'])).toEqual({ kind: 'help' });
});

test('formatHelp lists every entry in VERBS', () => {
  const help = formatHelp();
  for (const name of Object.keys(VERBS)) {
    expect(help).toContain(name);
  }
  expect(help).toContain('draft');
});

test('formatUnknownVerbError emits structured JSON with candidates', () => {
  const stderr = formatUnknownVerbError('xyzzy');
  const parsed = JSON.parse(stderr);
  expect(parsed.error).toBe('unknown-verb');
  expect(parsed.candidates).toEqual(Object.keys(VERBS));
});

test('dispatch: help → stdout + exit 0', () => {
  const result = dispatch({ kind: 'help' }, makeCtx());
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBeDefined();
  expect(result.stderr).toBeUndefined();
});

test('dispatch: unknown → stderr + exit 1', () => {
  const result = dispatch({ kind: 'unknown', verb: 'xyzzy' }, makeCtx());
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBeDefined();
  expect(result.stdout).toBeUndefined();
});

test('dispatch: plan verb routes to planVerb (missing-args surfaces)', () => {
  // plan is now implemented (D4). Calling with no rest args produces a
  // structured missing-args error, NOT not-implemented — proves the
  // dispatch is routing through DRAFT_VERBS.plan rather than the
  // stub branch.
  const result = dispatch({ kind: 'verb', verb: 'plan', rest: [] }, makeCtx());
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('missing-args');
});

test('dispatch: revise verb routes to reviseVerb (missing-args surfaces)', () => {
  // revise is now implemented (D5). Calling with no rest args produces
  // a structured missing-args error, NOT not-implemented — proves the
  // dispatch is routing through DRAFT_VERBS.revise.
  const result = dispatch({ kind: 'verb', verb: 'revise', rest: [] }, makeCtx());
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('missing-args');
});

test('dispatch: read verb routes to readVerb (missing-args surfaces)', () => {
  const result = dispatch({ kind: 'verb', verb: 'read', rest: [] }, makeCtx());
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('missing-args');
});

// ---------- Smoke tests via subprocess (entry-point integration) ----------

test('node entry: --help prints help and exits 0', () => {
  const result = spawnSync('node', [DRAFT_ENTRY, '--help'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('draft');
  for (const name of Object.keys(VERBS)) {
    expect(result.stdout).toContain(name);
  }
});

test('node entry: no args prints help and exits 0', () => {
  const result = spawnSync('node', [DRAFT_ENTRY], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Usage:');
});

test('node entry: unknown verb prints structured error and exits 1', () => {
  const result = spawnSync('node', [DRAFT_ENTRY, 'xyzzy'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  const parsed = JSON.parse(result.stderr.trim());
  expect(parsed.error).toBe('unknown-verb');
});

test('bin/draft shim invokes the entry identically', () => {
  const result = spawnSync(BIN_DRAFT, ['--help'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('draft');
  for (const name of Object.keys(VERBS)) {
    expect(result.stdout).toContain(name);
  }
});
