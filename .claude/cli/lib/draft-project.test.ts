import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolveTroutProject, listTroutProjects } from './draft-project.ts';

let projectsRoot: string;

function makeTroutProject(root: string, slug: string): void {
  const path = join(root, slug);
  mkdirSync(path, { recursive: true });
  // Marker file: draft-readable projects carry PLAN.md. (Trout-
  // managed projects also have MANIFEST.md; draft-only projects
  // have just PLAN.md + INTERVIEW.md.)
  writeFileSync(join(path, 'PLAN.md'), '# Plan\n');
}

function makeLoomProject(root: string, slug: string): void {
  const path = join(root, slug);
  mkdirSync(path, { recursive: true });
  // Marker file: loom-managed projects carry manifest.json.
  writeFileSync(join(path, 'manifest.json'), '{}');
}

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'draft-project-test-'));
  // Active trout projects
  makeTroutProject(projectsRoot, '2026-05-10-project-a');
  makeTroutProject(projectsRoot, '2026-05-15-draft-cli');
  // Active loom project (must NOT resolve via resolveTroutProject)
  makeLoomProject(projectsRoot, '2026-05-15-loom-cli');
  // Active non-substrate dir (no PLAN.md, no manifest.json)
  mkdirSync(join(projectsRoot, '2026-05-20-bare'));
  // Archived trout
  makeTroutProject(join(projectsRoot, 'archive'), '2026-04-01-old-project');
  // Non-project noise
  writeFileSync(join(projectsRoot, 'CONVENTIONS.md'), '# noise\n');
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('resolveTroutProject: full slug returns its path', () => {
  const p = resolveTroutProject('2026-05-15-draft-cli', projectsRoot);
  expect(p).toBe(join(projectsRoot, '2026-05-15-draft-cli'));
});

test('resolveTroutProject: date-less suffix returns unique match', () => {
  const p = resolveTroutProject('draft-cli', projectsRoot);
  expect(p).toBe(join(projectsRoot, '2026-05-15-draft-cli'));
});

test('resolveTroutProject: archived slug falls back to archive/', () => {
  const p = resolveTroutProject('old-project', projectsRoot);
  expect(p).toBe(join(projectsRoot, 'archive', '2026-04-01-old-project'));
});

test('resolveTroutProject: relative path resolves to absolute', () => {
  const rel = './2026-05-15-draft-cli';
  const p = resolveTroutProject(join(projectsRoot, rel), projectsRoot);
  expect(p).toBe(resolve(projectsRoot, '2026-05-15-draft-cli'));
});

test('resolveTroutProject: nonexistent slug throws project-not-found', () => {
  expect(() => resolveTroutProject('does-not-exist', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('resolveTroutProject: ambiguous suffix throws slug-ambiguous with candidates', () => {
  // Two trout-marked projects sharing the suffix `-foo`
  makeTroutProject(projectsRoot, '2026-05-20-foo');
  makeTroutProject(projectsRoot, '2026-05-25-foo');
  try {
    resolveTroutProject('foo', projectsRoot);
    throw new Error('expected throw');
  } catch (err: unknown) {
    const e = err as { code: string; candidates?: string[] };
    expect(e.code).toBe('slug-ambiguous');
    expect(e.candidates).toBeDefined();
    expect(e.candidates?.length).toBe(2);
  }
});

test('resolveTroutProject: loom-only project (manifest.json present) does NOT resolve', () => {
  // 2026-05-15-loom-cli was set up as a loom project (manifest.json).
  // Trying to resolve its slug should throw project-not-found.
  expect(() => resolveTroutProject('loom-cli', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('resolveTroutProject: bare directory without PLAN.md does NOT resolve', () => {
  // 2026-05-20-bare has no PLAN.md and no manifest.json.
  expect(() => resolveTroutProject('bare', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('listTroutProjects: enumerates active trout projects only', () => {
  const list = listTroutProjects(projectsRoot);
  expect(list.map((p) => p.slug).sort()).toEqual([
    '2026-05-10-project-a',
    '2026-05-15-draft-cli',
  ]);
});

test('listTroutProjects: --archived enumerates the trout archive', () => {
  const list = listTroutProjects(projectsRoot, { archived: true });
  expect(list.map((p) => p.slug)).toEqual(['2026-04-01-old-project']);
});
