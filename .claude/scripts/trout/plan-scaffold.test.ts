// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/plan-scaffold.ts');
const NODE_BIN = process.execPath;

type RunResult = { stdout: string; stderr: string; status: number };

function run(args: string[], cwd: string): RunResult {
  try {
    const stdout = execFileSync(NODE_BIN, [SCRIPT, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
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

const SLUG = '2026-05-09-sample';
const PLAN_CONTENT = '# Sample\n\n## Context\n\nA sample project.\n';
const CONFIG_CONTENT = '# Project config\n\n## Verification\n- npm run lint\n\n## PR settings\n- Base branch: main\n';
const DEFAULT_INIT = {
  title: 'Sample',
  started: '2026-05-09',
  strategy: 'Do the thing.',
  phases: [{ name: 'Phase one' }],
};

type FixtureFiles = { planFile: string; configFile: string; manifestInitFile: string };

function makeFixture(opts: {
  plan?: string;
  config?: string;
  manifestInit?: unknown;
  manifestInitRaw?: string;
} = {}): { root: string; cleanup: () => void } & FixtureFiles {
  const root = mkdtempSync(join(tmpdir(), 'plan-scaffold-test-'));
  const planFile = join(root, 'plan.md');
  const configFile = join(root, 'config.md');
  const manifestInitFile = join(root, 'manifest-init.json');
  writeFileSync(planFile, opts.plan ?? PLAN_CONTENT);
  writeFileSync(configFile, opts.config ?? CONFIG_CONTENT);
  const initBody = opts.manifestInitRaw ?? JSON.stringify(opts.manifestInit ?? DEFAULT_INIT);
  writeFileSync(manifestInitFile, initBody);
  return {
    root,
    planFile,
    configFile,
    manifestInitFile,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function defaultArgs(slug: string, fx: FixtureFiles): string[] {
  return [slug, `--plan-file=${fx.planFile}`, `--config-file=${fx.configFile}`, `--manifest-init-file=${fx.manifestInitFile}`];
}

const TIMESTAMP_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

test('happy path: writes all three artifacts and creates subdirs', () => {
  const fx = makeFixture();
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^plan-scaffold-written: projects\/2026-05-09-sample\/\n$/);
    const projectPath = join(fx.root, 'projects', SLUG);
    assert.equal(readFileSync(join(projectPath, 'PLAN.md'), 'utf-8'), PLAN_CONTENT);
    assert.equal(readFileSync(join(projectPath, 'config.md'), 'utf-8'), CONFIG_CONTENT);
    const manifest = readFileSync(join(projectPath, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /\| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| project-initialized \| — \|/);
    assert.ok(existsSync(join(projectPath, 'sessions')));
    assert.ok(existsSync(join(projectPath, 'checkins')));
  } finally {
    fx.cleanup();
  }
});

test('happy path: dependencies render correctly with multiple phases', () => {
  const fx = makeFixture({
    manifestInit: {
      title: 'Multi',
      started: '2026-05-09',
      strategy: 'Multi-phase project.',
      phases: [
        { name: 'Phase one' },
        { name: 'Phase two', dependencies: ['Phase 1 must merge first'] },
        { name: 'Phase three' },
      ],
    },
  });
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const manifest = readFileSync(join(fx.root, 'projects', SLUG, 'MANIFEST.md'), 'utf-8');
    assert.match(manifest, /## Dependencies\n\n- Phase 2: Phase 1 must merge first\n/);
    assert.doesNotMatch(manifest, /^- Phase 1:/m);
    assert.doesNotMatch(manifest, /^- Phase 3:/m);
  } finally {
    fx.cleanup();
  }
});

test('manifest output: golden assertion matches autosave-runInit template byte-for-byte', () => {
  const fx = makeFixture({
    manifestInit: {
      title: 'Sample',
      started: '2026-05-09',
      strategy: 'Do the thing.',
      phases: [
        { name: 'Phase one' },
        { name: 'Phase two', dependencies: ['Phase 1'] },
      ],
    },
  });
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const actual = readFileSync(join(fx.root, 'projects', SLUG, 'MANIFEST.md'), 'utf-8')
      .replace(TIMESTAMP_RE, '<TIMESTAMP>');
    const expected = `# Project: Sample

**Slug**: 2026-05-09-sample
**Started**: 2026-05-09
**Status**: active
**Current branch**: —
**Latest checkin**: —

## Strategy

Do the thing.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Phase one | not-started | — | — | — |
| 2 | Phase two | not-started | — | — | — |

## Dependencies

- Phase 2: Phase 1

## Current state

Project initialized. No work started yet.

## Events

| When | Event | Detail |
|------|-------|--------|
| <TIMESTAMP> | project-initialized | — |
`;
    assert.equal(actual, expected);
  } finally {
    fx.cleanup();
  }
});

test('error: project dir already exists', () => {
  const fx = makeFixture();
  try {
    mkdirSync(join(fx.root, 'projects', SLUG), { recursive: true });
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /project directory already exists: projects\/2026-05-09-sample\//);
  } finally {
    fx.cleanup();
  }
});

test('error: slug shape invalid (missing date prefix)', () => {
  const fx = makeFixture();
  try {
    const result = run(defaultArgs('my-project', fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /slug must match YYYY-MM-DD-<kebab>/);
  } finally {
    fx.cleanup();
  }
});

test('error: slug shape invalid (uppercase)', () => {
  const fx = makeFixture();
  try {
    const result = run(defaultArgs('2026-05-09-MyProject', fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /slug must match YYYY-MM-DD-<kebab>/);
  } finally {
    fx.cleanup();
  }
});

test('error: slug shape invalid (trailing dash)', () => {
  const fx = makeFixture();
  try {
    const result = run(defaultArgs('2026-05-09-my-project-', fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /slug must match YYYY-MM-DD-<kebab>/);
  } finally {
    fx.cleanup();
  }
});

test('error: --plan-file non-existent', () => {
  const fx = makeFixture();
  try {
    const result = run(
      [SLUG, '--plan-file=/tmp/does-not-exist-plan-scaffold-test.md', `--config-file=${fx.configFile}`, `--manifest-init-file=${fx.manifestInitFile}`],
      fx.root,
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--plan-file not found/);
  } finally {
    fx.cleanup();
  }
});

test('error: --config-file non-existent', () => {
  const fx = makeFixture();
  try {
    const result = run(
      [SLUG, `--plan-file=${fx.planFile}`, '--config-file=/tmp/does-not-exist-config-scaffold-test.md', `--manifest-init-file=${fx.manifestInitFile}`],
      fx.root,
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--config-file not found/);
  } finally {
    fx.cleanup();
  }
});

test('error: --manifest-init-file non-existent', () => {
  const fx = makeFixture();
  try {
    const result = run(
      [SLUG, `--plan-file=${fx.planFile}`, `--config-file=${fx.configFile}`, '--manifest-init-file=/tmp/does-not-exist-init-scaffold-test.json'],
      fx.root,
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--manifest-init-file not found/);
  } finally {
    fx.cleanup();
  }
});

test('error: --manifest-init-file malformed JSON', () => {
  const fx = makeFixture({ manifestInitRaw: '{not json' });
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /manifest-init JSON parse error/);
  } finally {
    fx.cleanup();
  }
});

test('error: --manifest-init-file missing title', () => {
  const fx = makeFixture({ manifestInit: { started: '2026-05-09', strategy: 'x', phases: [] } });
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /manifest-init JSON missing required field: title/);
  } finally {
    fx.cleanup();
  }
});

test('error: --manifest-init-file phases not an array', () => {
  const fx = makeFixture({ manifestInit: { title: 'X', started: '2026-05-09', strategy: 'x', phases: 'not an array' } });
  try {
    const result = run(defaultArgs(SLUG, fx), fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /manifest-init.phases must be an array/);
  } finally {
    fx.cleanup();
  }
});
