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

function makeLoomOnlyProject(root: string, slug: string): void {
  const path = join(root, slug);
  mkdirSync(path, { recursive: true });
  // Loom-only: manifest.json but no PLAN.md. This is an unusual
  // state (loom is meant to be paired with draft), but possible if
  // someone scaffolded loom directly without ever writing a PLAN.
  writeFileSync(join(path, 'manifest.json'), '{}');
}

function makeLoomDraftProject(root: string, slug: string): void {
  const path = join(root, slug);
  mkdirSync(path, { recursive: true });
  // Loom + draft: both markers. This is the post-trout default —
  // loom owns execution, draft owns planning, both live in the same
  // dir and both resolvers see the project.
  writeFileSync(join(path, 'manifest.json'), '{}');
  writeFileSync(join(path, 'PLAN.md'), '# Plan\n');
}

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'draft-project-test-'));
  // Active trout projects
  makeTroutProject(projectsRoot, '2026-05-10-project-a');
  makeTroutProject(projectsRoot, '2026-05-15-draft-cli');
  // Active loom-only project (no PLAN.md): does NOT resolve via
  // draft (PLAN.md is the marker draft cares about)
  makeLoomOnlyProject(projectsRoot, '2026-05-15-loom-cli');
  // Active loom + draft project (both markers): SHOULD resolve via
  // draft, since loom + draft are paired halves of one project
  makeLoomDraftProject(projectsRoot, '2026-05-15-trout-sunset');
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

test('resolveTroutProject: loom-only project (no PLAN.md) does NOT resolve', () => {
  // 2026-05-15-loom-cli has manifest.json but no PLAN.md.
  // Without PLAN.md, draft has nothing to read or revise, so the
  // project is invisible to draft regardless of loom's state.
  expect(() => resolveTroutProject('loom-cli', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('resolveTroutProject: loom + draft project (both markers) DOES resolve', () => {
  // 2026-05-15-trout-sunset has manifest.json AND PLAN.md. This is
  // the post-trout default state — draft and loom coexist on the
  // same project. Draft must see it.
  const p = resolveTroutProject('trout-sunset', projectsRoot);
  expect(p).toBe(join(projectsRoot, '2026-05-15-trout-sunset'));
});

test('resolveTroutProject: bare directory without PLAN.md does NOT resolve', () => {
  // 2026-05-20-bare has no PLAN.md and no manifest.json.
  expect(() => resolveTroutProject('bare', projectsRoot)).toThrow(
    /project-not-found/,
  );
});

test('listTroutProjects: enumerates active draft-readable projects (incl. loom+draft)', () => {
  // Includes:
  //   - draft-only / trout-managed projects (PLAN.md without manifest.json)
  //   - loom + draft projects (PLAN.md with manifest.json)
  // Excludes:
  //   - loom-only projects (manifest.json without PLAN.md)
  //   - bare dirs (neither marker)
  const list = listTroutProjects(projectsRoot);
  expect(list.map((p) => p.slug).sort()).toEqual([
    '2026-05-10-project-a',
    '2026-05-15-draft-cli',
    '2026-05-15-trout-sunset',
  ]);
});

test('listTroutProjects: --archived enumerates the trout archive', () => {
  const list = listTroutProjects(projectsRoot, { archived: true });
  expect(list.map((p) => p.slug)).toEqual(['2026-04-01-old-project']);
});
