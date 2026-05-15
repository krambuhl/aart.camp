import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  NAMESPACES,
  parseInvocation,
  formatHelp,
  formatUnknownVerbError,
  dispatch,
} from './loom.ts';
import type { CliContext } from './loom.ts';

function makeCtx(): CliContext {
  return { projectsRoot: mkdtempSync(join(tmpdir(), 'loom-test-')) };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOM_ENTRY = join(__dirname, 'loom.ts');
const BIN_LOOM = join(__dirname, '..', '..', 'bin', 'loom');

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

test('parseInvocation: known namespace → verb', () => {
  expect(parseInvocation(['project', 'read', 'foo'])).toEqual({
    kind: 'verb',
    namespace: 'project',
    rest: ['read', 'foo'],
  });
});

test('parseInvocation: unknown namespace → unknown', () => {
  expect(parseInvocation(['xyzzy'])).toEqual({ kind: 'unknown', verb: 'xyzzy' });
});

test('parseInvocation: --help after namespace still routes to help', () => {
  expect(parseInvocation(['project', '--help'])).toEqual({ kind: 'help' });
});

test('formatHelp lists every namespace from LOOM-CONVENTIONS.md', () => {
  const help = formatHelp();
  for (const name of Object.keys(NAMESPACES)) {
    expect(help).toContain(name);
  }
  expect(help).toContain('loom');
});

test('formatUnknownVerbError emits structured JSON with candidates', () => {
  const stderr = formatUnknownVerbError('xyzzy');
  const parsed = JSON.parse(stderr);
  expect(parsed.error).toBe('unknown-verb');
  expect(parsed.candidates).toEqual(Object.keys(NAMESPACES));
});

test('dispatch: help → stdout + exit 0', () => {
  const ctx = makeCtx();
  const result = dispatch({ kind: 'help' }, ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBeDefined();
  expect(result.stderr).toBeUndefined();
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

test('dispatch: unknown → stderr + exit 1', () => {
  const ctx = makeCtx();
  const result = dispatch({ kind: 'unknown', verb: 'xyzzy' }, ctx);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBeDefined();
  expect(result.stdout).toBeUndefined();
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

test('dispatch: wired namespace, missing verb → missing-verb with candidates', () => {
  const ctx = makeCtx();
  const result = dispatch({ kind: 'verb', namespace: 'project', rest: [] }, ctx);
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('missing-verb');
  expect(parsed.candidates).toContain('read');
  expect(parsed.candidates).toContain('list');
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

test('dispatch: wired namespace, unknown verb → unknown-verb', () => {
  const ctx = makeCtx();
  const result = dispatch(
    { kind: 'verb', namespace: 'project', rest: ['xyzzy'] },
    ctx,
  );
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('unknown-verb');
  expect(parsed.candidates).toContain('read');
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

test('dispatch: verbless namespace (doctor) routes rest as handler args', () => {
  const ctx = makeCtx();
  // Doctor against a nonexistent slug should reach the doctor handler
  // (returning a project-not-found from the resolveProject step),
  // not get rejected as unknown-verb.
  const result = dispatch(
    { kind: 'verb', namespace: 'doctor', rest: ['nonexistent-slug'] },
    ctx,
  );
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('project-not-found');
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

test('dispatch: pr namespace wired (no unwired namespaces remain)', () => {
  const ctx = makeCtx();
  // pr is wired now (Phase 4 unit 01). Missing verb returns missing-verb,
  // not not-implemented.
  const result = dispatch({ kind: 'verb', namespace: 'pr', rest: [] }, ctx);
  expect(result.exitCode).toBe(1);
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('missing-verb');
  expect(parsed.candidates).toContain('discover');
  rmSync(ctx.projectsRoot, { recursive: true, force: true });
});

// ---------- Smoke tests via subprocess (entry-point integration) ----------

test('node entry: --help prints help and exits 0', () => {
  const result = spawnSync('node', [LOOM_ENTRY, '--help'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('loom');
  for (const name of Object.keys(NAMESPACES)) {
    expect(result.stdout).toContain(name);
  }
});

test('node entry: no args prints help and exits 0', () => {
  const result = spawnSync('node', [LOOM_ENTRY], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Usage:');
});

test('node entry: unknown verb prints structured error and exits 1', () => {
  const result = spawnSync('node', [LOOM_ENTRY, 'xyzzy'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  const parsed = JSON.parse(result.stderr.trim());
  expect(parsed.error).toBe('unknown-verb');
});

test('bin/loom shim invokes the entry identically', () => {
  const result = spawnSync(BIN_LOOM, ['--help'], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('loom');
  for (const name of Object.keys(NAMESPACES)) {
    expect(result.stdout).toContain(name);
  }
});
