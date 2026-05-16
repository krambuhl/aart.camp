import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, beforeEach, afterEach } from 'vitest';
import { findingsVerb } from './findings.ts';
import type { GuildCliContext } from './index.ts';

let root: string;
let ctx: GuildCliContext;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'findings-verb-test-'));
  mkdirSync(join(root, 'projects', 'demo'), { recursive: true });
  ctx = { cwd: root };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function jsonlPath(slug = 'demo'): string {
  return join(root, 'projects', slug, '.guild-findings.jsonl');
}

function readJsonl(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

test('append: creates the JSONL file with one row on first call', () => {
  const res = findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-a11y',
      '--code=img-without-alt',
      '--evidence=Bare <img> at Card.tsx:42',
      '--severity=blocking',
      '--branch=feat/x',
      '--unit=02',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toMatch(/^findings-append: 1 row appended/);
  const rows = readJsonl(jsonlPath());
  expect(rows.length).toBe(1);
  expect(rows[0].slug).toBe('demo');
  expect(rows[0].evaluator).toBe('evaluator-a11y');
  expect(rows[0].code).toBe('img-without-alt');
  expect(rows[0].evidence).toBe('Bare <img> at Card.tsx:42');
  expect(rows[0].severity).toBe('blocking');
  expect(rows[0].branch).toBe('feat/x');
  expect(rows[0].unit).toBe('02');
  expect(typeof rows[0].ts).toBe('string');
  expect(rows[0].ts as string).toMatch(/\d{4}-\d{2}-\d{2}T/);
  expect(typeof rows[0].signature).toBe('string');
  expect((rows[0].signature as string).length).toBe(40);
});

test('append: appends to existing file (does not overwrite)', () => {
  findingsVerb(
    ['append', '--slug=demo', '--evaluator=evaluator-a11y', '--code=A', '--evidence=alpha'],
    ctx,
  );
  findingsVerb(
    ['append', '--slug=demo', '--evaluator=evaluator-a11y', '--code=B', '--evidence=beta'],
    ctx,
  );
  const rows = readJsonl(jsonlPath());
  expect(rows.length).toBe(2);
  expect(rows[0].code).toBe('A');
  expect(rows[1].code).toBe('B');
});

test('append: identical evaluator+code+evidence yields identical signature', () => {
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=#000 at Sketch.module.css:17',
    ],
    ctx,
  );
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=#000 at Sketch.module.css:17',
    ],
    ctx,
  );
  const rows = readJsonl(jsonlPath());
  expect(rows.length).toBe(2);
  expect(rows[0].signature).toBe(rows[1].signature);
});

test('append: signature is independent of whitespace and case in evidence', () => {
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=#000 at Sketch.module.css:17',
    ],
    ctx,
  );
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=',
    ],
    ctx,
  );
  const rows = readJsonl(jsonlPath());
  expect(rows[0].signature).not.toBe(rows[1].signature);
});

test('append: optional severity defaults to blocking', () => {
  findingsVerb(
    ['append', '--slug=demo', '--evaluator=evaluator-x', '--code=c', '--evidence=e'],
    ctx,
  );
  const rows = readJsonl(jsonlPath());
  expect(rows[0].severity).toBe('blocking');
});

test('count: returns 0 for missing file', () => {
  const res = findingsVerb(
    [
      'count',
      '--slug=demo',
      '--evaluator=evaluator-a11y',
      '--code=img-without-alt',
      '--evidence=anything',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(0);
  expect(res.stdout).toBe('0');
});

test('count: returns the number of rows matching the computed signature', () => {
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=match',
    ],
    ctx,
  );
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=match',
    ],
    ctx,
  );
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=other',
      '--evidence=match',
    ],
    ctx,
  );
  findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=evaluator-other',
      '--code=raw-hex',
      '--evidence=match',
    ],
    ctx,
  );

  const matching = findingsVerb(
    [
      'count',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=raw-hex',
      '--evidence=match',
    ],
    ctx,
  );
  expect(matching.stdout).toBe('2');

  const distractor = findingsVerb(
    [
      'count',
      '--slug=demo',
      '--evaluator=evaluator-tokens',
      '--code=other',
      '--evidence=match',
    ],
    ctx,
  );
  expect(distractor.stdout).toBe('1');
});

test('count: does not count rows from a different slug', () => {
  mkdirSync(join(root, 'projects', 'other'), { recursive: true });
  findingsVerb(
    ['append', '--slug=demo', '--evaluator=e', '--code=c', '--evidence=x'],
    ctx,
  );
  findingsVerb(
    ['append', '--slug=other', '--evaluator=e', '--code=c', '--evidence=x'],
    ctx,
  );
  const res = findingsVerb(
    ['count', '--slug=demo', '--evaluator=e', '--code=c', '--evidence=x'],
    ctx,
  );
  expect(res.stdout).toBe('1');
});

test('append: errors on missing --slug', () => {
  const res = findingsVerb(
    ['append', '--evaluator=e', '--code=c', '--evidence=x'],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: --slug=<slug> is required/);
});

test('append: errors on missing --evaluator', () => {
  const res = findingsVerb(
    ['append', '--slug=demo', '--code=c', '--evidence=x'],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: --evaluator=<name> is required/);
});

test('append: errors when project directory does not exist', () => {
  const res = findingsVerb(
    [
      'append',
      '--slug=does-not-exist',
      '--evaluator=e',
      '--code=c',
      '--evidence=x',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: project directory not found/);
});

test('count: errors on missing required args', () => {
  const res = findingsVerb(['count', '--slug=demo'], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error:/);
});

test('unknown verb errors with usage hint', () => {
  const res = findingsVerb(['surprise'], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: unknown verb 'surprise'/);
});

test('append: severity must be blocking or advisory', () => {
  const res = findingsVerb(
    [
      'append',
      '--slug=demo',
      '--evaluator=e',
      '--code=c',
      '--evidence=x',
      '--severity=loud',
    ],
    ctx,
  );
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: --severity must be 'blocking' or 'advisory'/);
});

test('missing verb errors', () => {
  const res = findingsVerb([], ctx);
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/findings-error: missing verb/);
});
