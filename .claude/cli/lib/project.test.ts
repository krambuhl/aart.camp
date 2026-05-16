import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolveProject, listProjects, createSlug } from './project.ts';

let projectsRoot: string;

function makeLoomProject(root: string, slug: string): void {
  const path = join(root, slug);
  mkdirSync(path, { recursive: true });
  // Marker file: loom-managed projects carry manifest.json. Filtering
  // by this marker excludes any directory without it (e.g. draft-only
  // projects that haven't been adopted yet).
  writeFileSync(join(path, 'manifest.json'), '{}');
}

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-project-test-'));
  // Active projects
  makeLoomProject(projectsRoot, '2026-05-10-project-a');
  makeLoomProject(projectsRoot, '2026-05-15-loom-cli');
  // Archived
  makeLoomProject(join(projectsRoot, 'archive'), '2026-04-01-old-project');
  // Add some non-project entries that should be ignored
  writeFileSync(join(projectsRoot, 'CONVENTIONS.md'), '# noise\n');
  // Add a bare project (no manifest.json) — must NOT appear in
  // listProjects output. Exercises the manifest-marker filter.
  mkdirSync(join(projectsRoot, '2026-05-12-bare-only'));
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('resolveProject: full slug returns its path', () => {
  const p = resolveProject('2026-05-15-loom-cli', projectsRoot);
  expect(p).toBe(join(projectsRoot, '2026-05-15-loom-cli'));
});

test('resolveProject: date-less suffix returns unique match', () => {
  const p = resolveProject('loom-cli', projectsRoot);
  expect(p).toBe(join(projectsRoot, '2026-05-15-loom-cli'));
});

test('resolveProject: archived slug falls back to archive/', () => {
  const p = resolveProject('old-project', projectsRoot);
  expect(p).toBe(join(projectsRoot, 'archive', '2026-04-01-old-project'));
});

test('resolveProject: relative path resolves to absolute', () => {
  const rel = './2026-05-15-loom-cli';
  const p = resolveProject(join(projectsRoot, rel), projectsRoot);
  expect(p).toBe(resolve(projectsRoot, '2026-05-15-loom-cli'));
});

test('resolveProject: nonexistent slug throws project-not-found', () => {
  expect(() => resolveProject('does-not-exist', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('resolveProject: ambiguous suffix throws slug-ambiguous with candidates', () => {
  // Two loom-marked projects sharing the suffix `-foo`
  makeLoomProject(projectsRoot, '2026-05-20-foo');
  makeLoomProject(projectsRoot, '2026-05-25-foo');
  try {
    resolveProject('foo', projectsRoot);
    throw new Error('expected throw');
  } catch (err: unknown) {
    const e = err as { code: string; candidates?: string[] };
    expect(e.code).toBe('slug-ambiguous');
    expect(e.candidates).toBeDefined();
    expect(e.candidates?.length).toBe(2);
  }
});

test('listProjects: filters out projects without manifest.json', () => {
  const list = listProjects(projectsRoot);
  for (const p of list) {
    expect(p.slug).not.toBe('2026-05-12-bare-only');
  }
});

test('listProjects: enumerates active projects only by default', () => {
  const list = listProjects(projectsRoot);
  expect(list.map((p) => p.slug).sort()).toEqual([
    '2026-05-10-project-a',
    '2026-05-15-loom-cli',
  ]);
});

test('listProjects: --archived enumerates the archive instead', () => {
  const list = listProjects(projectsRoot, { archived: true });
  expect(list.map((p) => p.slug)).toEqual(['2026-04-01-old-project']);
});

// ----- createSlug -----

const slugShape = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;

test('createSlug: happy path lowercases and joins with date', () => {
  const s = createSlug('Adopt Biome', '2026-05-15');
  expect(s).toBe('2026-05-15-adopt-biome');
  expect(s).toMatch(slugShape);
});

test('createSlug: collapses runs of non-alphanumeric chars to single hyphen', () => {
  expect(createSlug('CLI: plan & revise!', '2026-05-15')).toBe(
    '2026-05-15-cli-plan-revise',
  );
  expect(createSlug('hello  world', '2026-05-15')).toBe(
    '2026-05-15-hello-world',
  );
});

test('createSlug: trims leading and trailing punctuation', () => {
  expect(createSlug('--draft-cli--', '2026-05-15')).toBe(
    '2026-05-15-draft-cli',
  );
  expect(createSlug('   spaced   ', '2026-05-15')).toBe('2026-05-15-spaced');
});

test('createSlug: empty topic throws invalid-topic', () => {
  expect(() => createSlug('', '2026-05-15')).toThrow(/invalid-topic/);
});

test('createSlug: whitespace-only topic throws invalid-topic', () => {
  expect(() => createSlug('   ', '2026-05-15')).toThrow(/invalid-topic/);
});

test('createSlug: all-special-chars topic throws invalid-topic', () => {
  expect(() => createSlug('!!!', '2026-05-15')).toThrow(/invalid-topic/);
  expect(() => createSlug('---', '2026-05-15')).toThrow(/invalid-topic/);
});

test('createSlug: single-character slug fails SLUG_RE — throws invalid-topic', () => {
  // SLUG_RE requires the slug part to be 2+ chars (start AND end with [a-z0-9]).
  expect(() => createSlug('a', '2026-05-15')).toThrow(/invalid-topic/);
});

test('createSlug: malformed date throws invalid-date', () => {
  expect(() => createSlug('valid topic', '05/15/2026')).toThrow(/invalid-date/);
  expect(() => createSlug('valid topic', '2026-5-15')).toThrow(/invalid-date/);
  expect(() => createSlug('valid topic', '')).toThrow(/invalid-date/);
  expect(() => createSlug('valid topic', '2026-05-15T00:00:00')).toThrow(
    /invalid-date/,
  );
});
