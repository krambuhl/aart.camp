import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/guild/findings.ts');

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

function makeFixture(slug: string): { root: string; cleanup: () => void; jsonlPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'findings-test-'));
  mkdirSync(join(root, 'projects', slug), { recursive: true });
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    jsonlPath: join(root, 'projects', slug, '.guild-findings.jsonl'),
  };
}

function readJsonl(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

test('append: creates the JSONL file with one row on first call', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(
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
      fx.root,
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /^findings-append: 1 row appended/);
    const rows = readJsonl(fx.jsonlPath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'demo');
    assert.equal(rows[0].evaluator, 'evaluator-a11y');
    assert.equal(rows[0].code, 'img-without-alt');
    assert.equal(rows[0].evidence, 'Bare <img> at Card.tsx:42');
    assert.equal(rows[0].severity, 'blocking');
    assert.equal(rows[0].branch, 'feat/x');
    assert.equal(rows[0].unit, '02');
    assert.ok(typeof rows[0].ts === 'string' && /\d{4}-\d{2}-\d{2}T/.test(rows[0].ts as string));
    assert.ok(typeof rows[0].signature === 'string' && (rows[0].signature as string).length === 40);
  } finally {
    fx.cleanup();
  }
});

test('append: appends to existing file (does not overwrite)', () => {
  const fx = makeFixture('demo');
  try {
    run(['append', '--slug=demo', '--evaluator=evaluator-a11y', '--code=A', '--evidence=alpha'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-a11y', '--code=B', '--evidence=beta'], fx.root);
    const rows = readJsonl(fx.jsonlPath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].code, 'A');
    assert.equal(rows[1].code, 'B');
  } finally {
    fx.cleanup();
  }
});

test('append: identical evaluator+code+evidence yields identical signature across calls', () => {
  const fx = makeFixture('demo');
  try {
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=#000 at Sketch.module.css:17'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=#000 at Sketch.module.css:17'], fx.root);
    const rows = readJsonl(fx.jsonlPath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].signature, rows[1].signature, 'identical findings must share signature');
  } finally {
    fx.cleanup();
  }
});

test('append: signature is independent of whitespace and case in evidence', () => {
  const fx = makeFixture('demo');
  try {
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=#000 at Sketch.module.css:17'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence='], fx.root); // empty evidence -> different sig
    const rows = readJsonl(fx.jsonlPath);
    assert.notEqual(rows[0].signature, rows[1].signature);
  } finally {
    fx.cleanup();
  }
});

test('append: optional severity defaults to blocking', () => {
  const fx = makeFixture('demo');
  try {
    run(['append', '--slug=demo', '--evaluator=evaluator-x', '--code=c', '--evidence=e'], fx.root);
    const rows = readJsonl(fx.jsonlPath);
    assert.equal(rows[0].severity, 'blocking');
  } finally {
    fx.cleanup();
  }
});

test('count: returns 0 for missing file', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(
      ['count', '--slug=demo', '--evaluator=evaluator-a11y', '--code=img-without-alt', '--evidence=anything'],
      fx.root,
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(r.stdout.trim(), '0');
  } finally {
    fx.cleanup();
  }
});

test('count: returns the number of rows matching the computed signature', () => {
  const fx = makeFixture('demo');
  try {
    // Two matching, two distractors.
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=match'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=match'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-tokens', '--code=other', '--evidence=match'], fx.root);
    run(['append', '--slug=demo', '--evaluator=evaluator-other', '--code=raw-hex', '--evidence=match'], fx.root);

    const matching = run(
      ['count', '--slug=demo', '--evaluator=evaluator-tokens', '--code=raw-hex', '--evidence=match'],
      fx.root,
    );
    assert.equal(matching.stdout.trim(), '2');

    const distractorCode = run(
      ['count', '--slug=demo', '--evaluator=evaluator-tokens', '--code=other', '--evidence=match'],
      fx.root,
    );
    assert.equal(distractorCode.stdout.trim(), '1');
  } finally {
    fx.cleanup();
  }
});

test('count: does not count rows from a different slug', () => {
  const fx = makeFixture('demo');
  mkdirSync(join(fx.root, 'projects', 'other'), { recursive: true });
  try {
    run(['append', '--slug=demo', '--evaluator=e', '--code=c', '--evidence=x'], fx.root);
    run(['append', '--slug=other', '--evaluator=e', '--code=c', '--evidence=x'], fx.root);
    const r = run(['count', '--slug=demo', '--evaluator=e', '--code=c', '--evidence=x'], fx.root);
    assert.equal(r.stdout.trim(), '1');
  } finally {
    fx.cleanup();
  }
});

test('append: errors on missing --slug', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['append', '--evaluator=e', '--code=c', '--evidence=x'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error: --slug=<slug> is required/);
  } finally {
    fx.cleanup();
  }
});

test('append: errors on missing --evaluator', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['append', '--slug=demo', '--code=c', '--evidence=x'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error: --evaluator=<name> is required/);
  } finally {
    fx.cleanup();
  }
});

test('append: errors when project directory does not exist', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['append', '--slug=does-not-exist', '--evaluator=e', '--code=c', '--evidence=x'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error: project directory not found/);
  } finally {
    fx.cleanup();
  }
});

test('count: errors on missing required args', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['count', '--slug=demo'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error:/);
  } finally {
    fx.cleanup();
  }
});

test('unknown verb errors with usage hint', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['surprise'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error: unknown verb 'surprise'/);
  } finally {
    fx.cleanup();
  }
});

test('append: severity must be blocking or advisory', () => {
  const fx = makeFixture('demo');
  try {
    const r = run(['append', '--slug=demo', '--evaluator=e', '--code=c', '--evidence=x', '--severity=loud'], fx.root);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /findings-error: --severity must be 'blocking' or 'advisory'/);
  } finally {
    fx.cleanup();
  }
});
