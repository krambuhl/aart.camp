import { test, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  NAMESPACES,
  parseInvocation,
  formatHelp,
  formatUnknownVerbError,
  dispatch,
} from './loom.ts';

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
  const result = dispatch({ kind: 'help' });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBeDefined();
  expect(result.stderr).toBeUndefined();
});

test('dispatch: unknown → stderr + exit 1', () => {
  const result = dispatch({ kind: 'unknown', verb: 'xyzzy' });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBeDefined();
  expect(result.stdout).toBeUndefined();
});

test('dispatch: known namespace (no verb impl yet) → not-implemented error', () => {
  const result = dispatch({ kind: 'verb', namespace: 'project', rest: [] });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBeDefined();
  const parsed = JSON.parse(result.stderr as string);
  expect(parsed.error).toBe('not-implemented');
  expect(parsed.namespace).toBe('project');
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
