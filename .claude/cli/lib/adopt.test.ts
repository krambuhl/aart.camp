import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeLoomSubstrate,
  synthesizeManifestInit,
  synthesizeConfig,
  slugToTitle,
} from './adopt.ts';

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'adopt-test-'));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

// ---------- slugToTitle ----------

test('slugToTitle: strips date prefix and title-cases the kebab suffix', () => {
  expect(slugToTitle('2026-05-15-trout-sunset')).toBe('Trout Sunset');
});

test('slugToTitle: handles slug without date prefix', () => {
  expect(slugToTitle('foo-bar-baz')).toBe('Foo Bar Baz');
});

test('slugToTitle: single-word slug', () => {
  expect(slugToTitle('2026-05-15-foo')).toBe('Foo');
});

test('slugToTitle: collapses empty segments from doubled hyphens', () => {
  // Defensive — invalid slugs shouldn't reach here, but the helper
  // shouldn't emit `Foo  Bar` if they do.
  expect(slugToTitle('foo--bar')).toBe('Foo Bar');
});

// ---------- synthesizeManifestInit ----------

test('synthesizeManifestInit: builds defaults from slug + today', () => {
  const init = synthesizeManifestInit('2026-05-15-test', '2026-05-15');
  expect(init.title).toBe('Test');
  expect(init.started).toBe('2026-05-15');
  expect(init.strategy).toBe('interactive');
  expect(init.phases).toEqual([
    { number: 1, name: 'Phase 1', status: 'not-started' },
  ]);
});

// ---------- synthesizeConfig ----------

test('synthesizeConfig: produces a minimal valid config', () => {
  const cfg = synthesizeConfig();
  expect(cfg.schema_version).toBe(1);
  expect(cfg.base_branch).toBe('main');
  expect(cfg.reviewers).toEqual([]);
  expect(cfg.labels).toEqual([]);
  expect(cfg.verification).toEqual([]);
  expect(cfg.worker_bindings).toEqual({});
});

// ---------- writeLoomSubstrate ----------

test('writeLoomSubstrate: writes manifest, config, events, and dirs', () => {
  writeLoomSubstrate({
    projectDir,
    slug: '2026-05-15-sub',
    config: synthesizeConfig(),
    manifestInit: synthesizeManifestInit('2026-05-15-sub', '2026-05-15'),
  });

  expect(existsSync(join(projectDir, 'manifest.json'))).toBe(true);
  expect(existsSync(join(projectDir, 'config.json'))).toBe(true);
  expect(existsSync(join(projectDir, 'events.jsonl'))).toBe(true);
  expect(existsSync(join(projectDir, 'checkins'))).toBe(true);
  expect(existsSync(join(projectDir, 'sessions'))).toBe(true);

  const m = JSON.parse(
    readFileSync(join(projectDir, 'manifest.json'), 'utf8'),
  );
  expect(m.schema_version).toBe(1);
  expect(m.slug).toBe('2026-05-15-sub');
  expect(m.title).toBe('Sub');
  expect(m.status).toBe('active');
  expect(m.current_branch).toBeNull();

  // events.jsonl has exactly one project-initialized line
  const events = readFileSync(join(projectDir, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  expect(events.length).toBe(1);
  expect(events[0].event).toBe('project-initialized');
});

test('writeLoomSubstrate: idempotent re-creation of dirs (mkdirSync recursive)', () => {
  // Pre-create checkins/ to ensure mkdirSync recursive doesn't throw.
  mkdirSync(join(projectDir, 'checkins'));
  writeLoomSubstrate({
    projectDir,
    slug: '2026-05-15-sub',
    config: synthesizeConfig(),
    manifestInit: synthesizeManifestInit('2026-05-15-sub', '2026-05-15'),
  });
  expect(existsSync(join(projectDir, 'checkins'))).toBe(true);
  expect(existsSync(join(projectDir, 'sessions'))).toBe(true);
});
