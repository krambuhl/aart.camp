// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// resolve-project.ts is a shared module (no CLI of its own). To test it we
// stamp out a tiny driver script in the fixture cwd that imports the helper
// and prints a JSON record of the outcome — this matches the "spawn in a
// fresh process" pattern used by every other test in this directory and
// avoids leaking module-load state across test cases.

const HELPER_PATH = join(process.cwd(), '.claude/scripts/trout/resolve-project.ts');

const DRIVER_SOURCE = `
import { resolveProject, ProjectResolveError } from '${HELPER_PATH}';
try {
  const path = resolveProject(process.argv[2]);
  process.stdout.write(JSON.stringify({ ok: true, path }));
} catch (err) {
  if (err instanceof ProjectResolveError) {
    process.stdout.write(JSON.stringify({ ok: false, message: err.message, candidates: err.candidates ?? null }));
    process.exit(0);
  }
  throw err;
}
`;

type Outcome = { ok: true; path: string } | { ok: false; message: string; candidates: string[] | null };

function makeFixture(slugs: string[] = ['2026-01-01-sample'], archived: string[] = []): { root: string; driver: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'resolve-project-test-'));
  mkdirSync(join(root, 'projects'), { recursive: true });
  for (const slug of slugs) {
    mkdirSync(join(root, 'projects', slug), { recursive: true });
    writeFileSync(join(root, 'projects', slug, 'PLAN.md'), '# Plan\n');
  }
  if (archived.length > 0) {
    mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
    for (const slug of archived) {
      mkdirSync(join(root, 'projects', 'archive', slug), { recursive: true });
    }
  }
  const driver = join(root, 'driver.mjs');
  writeFileSync(driver, DRIVER_SOURCE);
  return { root, driver, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function call(driver: string, cwd: string, slug: string): Outcome {
  const stdout = execFileSync('node', [driver, slug], { cwd, encoding: 'utf-8' });
  return JSON.parse(stdout) as Outcome;
}

test('absolute path: existing active project resolves', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, join(fx.root, 'projects', '2026-01-01-sample'));
    assert.equal(out.ok, true);
    if (out.ok) assert.equal(out.path, join(fx.root, 'projects', '2026-01-01-sample'));
  } finally {
    fx.cleanup();
  }
});

test('relative path: existing active project resolves', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, './projects/2026-01-01-sample');
    assert.equal(out.ok, true);
    if (out.ok) assert.equal(out.path, join(fx.root, 'projects', '2026-01-01-sample'));
  } finally {
    fx.cleanup();
  }
});

test('absolute path: under archive/ rejects as archived', () => {
  const fx = makeFixture([], ['2026-01-01-sample']);
  try {
    const out = call(fx.driver, fx.root, join(fx.root, 'projects', 'archive', '2026-01-01-sample'));
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /project is archived \(read-only\)/);
  } finally {
    fx.cleanup();
  }
});

test('absolute path: nonexistent rejects as not found', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, join(fx.root, 'projects', 'does-not-exist'));
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /project not found:/);
  } finally {
    fx.cleanup();
  }
});

test('absolute path: file (not directory) rejects', () => {
  const fx = makeFixture();
  try {
    const filePath = join(fx.root, 'projects', '2026-01-01-sample', 'PLAN.md');
    const out = call(fx.driver, fx.root, filePath);
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /is not a directory/);
  } finally {
    fx.cleanup();
  }
});

test('slug: direct match resolves', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, '2026-01-01-sample');
    assert.equal(out.ok, true);
    if (out.ok) assert.equal(out.path, join(fx.root, 'projects', '2026-01-01-sample'));
  } finally {
    fx.cleanup();
  }
});

test('slug: suffix match (dash-prefixed) resolves', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, 'sample');
    assert.equal(out.ok, true);
    if (out.ok) assert.equal(out.path, join(fx.root, 'projects', '2026-01-01-sample'));
  } finally {
    fx.cleanup();
  }
});

test('slug: ambiguous suffix returns candidates', () => {
  const fx = makeFixture(['2026-01-01-sample', '2026-02-01-sample']);
  try {
    const out = call(fx.driver, fx.root, 'sample');
    assert.equal(out.ok, false);
    if (!out.ok) {
      assert.match(out.message, /ambiguous slug "sample"/);
      assert.deepEqual(out.candidates?.sort(), ['2026-01-01-sample', '2026-02-01-sample']);
    }
  } finally {
    fx.cleanup();
  }
});

test('slug: archived project surfaces archived (read-only) error', () => {
  const fx = makeFixture([], ['2026-01-01-sample']);
  try {
    const out = call(fx.driver, fx.root, '2026-01-01-sample');
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /project is archived \(read-only\)/);
  } finally {
    fx.cleanup();
  }
});

test('slug: archive check is preferred over not-found when no active match', () => {
  const fx = makeFixture(['2026-01-01-other'], ['2026-01-01-sample']);
  try {
    const out = call(fx.driver, fx.root, 'sample');
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /project is archived/);
  } finally {
    fx.cleanup();
  }
});

test('slug: nonexistent rejects as not found', () => {
  const fx = makeFixture();
  try {
    const out = call(fx.driver, fx.root, 'does-not-exist');
    assert.equal(out.ok, false);
    if (!out.ok) assert.match(out.message, /project not found: slug "does-not-exist"/);
  } finally {
    fx.cleanup();
  }
});

test('slug: active match preferred over archived when both share suffix', () => {
  const fx = makeFixture(['2026-05-01-sample'], ['2026-04-01-sample']);
  try {
    const out = call(fx.driver, fx.root, 'sample');
    assert.equal(out.ok, true);
    if (out.ok) assert.equal(out.path, join(fx.root, 'projects', '2026-05-01-sample'));
  } finally {
    fx.cleanup();
  }
});
