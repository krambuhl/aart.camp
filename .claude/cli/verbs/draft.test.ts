import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planVerb, DRAFT_VERBS } from './draft.ts';
import type { GitRunner } from '../lib/draft-git.ts';

let projectsRoot: string;
let planFile: string;
let interviewFile: string;
let gitCalls: Array<{ method: string; args: unknown[] }>;
let committedPaths: Set<string>;
let gitRunner: GitRunner;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'draft-plan-test-'));
  // Source files to copy from
  const srcDir = mkdtempSync(join(tmpdir(), 'draft-plan-src-'));
  planFile = join(srcDir, 'plan.md');
  interviewFile = join(srcDir, 'interview.md');
  writeFileSync(planFile, '# PLAN\n\nSome plan content.\n');
  writeFileSync(interviewFile, '# INTERVIEW\n\nSome interview trail.\n');

  // Stub git runner: records calls, treats `committedPaths` as the
  // set of files that have been committed at least once.
  gitCalls = [];
  committedPaths = new Set();
  gitRunner = {
    isCommitted(repoRoot: string, filePath: string): boolean {
      gitCalls.push({ method: 'isCommitted', args: [repoRoot, filePath] });
      return committedPaths.has(filePath);
    },
    addAndCommit(repoRoot: string, paths: string[], message: string): void {
      gitCalls.push({ method: 'addAndCommit', args: [repoRoot, paths, message] });
      for (const p of paths) committedPaths.add(p);
    },
  };
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

function makeTroutProject(slug: string): string {
  const path = join(projectsRoot, slug);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'MANIFEST.md'), '# Project\n');
  return path;
}

const baseCtx = () => ({
  projectsRoot,
  today: '2026-05-15',
  gitRunner,
});

// ---------- DRAFT_VERBS registry ----------

test('DRAFT_VERBS registers plan as the only implemented verb', () => {
  expect(typeof DRAFT_VERBS.plan).toBe('function');
});

// ---------- Happy paths ----------

test('planVerb: happy path writes both files and commits', () => {
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
    ],
    baseCtx(),
  );

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBeDefined();
  const payload = JSON.parse(result.stdout as string);
  expect(payload.slug).toBe('2026-05-15-adopt-biome');
  expect(payload.path).toBe(join(projectsRoot, '2026-05-15-adopt-biome'));
  expect(payload.committed).toBe(true);

  // Files copied
  expect(
    readFileSync(join(payload.path, 'PLAN.md'), 'utf8'),
  ).toContain('# PLAN');
  expect(
    readFileSync(join(payload.path, 'INTERVIEW.md'), 'utf8'),
  ).toContain('# INTERVIEW');

  // git addAndCommit called once with both files + a draft-plan message
  const addCalls = gitCalls.filter((c) => c.method === 'addAndCommit');
  expect(addCalls.length).toBe(1);
  const [, , message] = addCalls[0]?.args ?? [];
  expect(message).toContain('draft plan');
  expect(message).toContain('2026-05-15-adopt-biome');
});

test('planVerb: --no-commit writes files but skips git', () => {
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout as string);
  expect(payload.committed).toBe(false);
  // Files still copied
  expect(existsSync(join(payload.path, 'PLAN.md'))).toBe(true);
  expect(existsSync(join(payload.path, 'INTERVIEW.md'))).toBe(true);
  // No addAndCommit call
  expect(gitCalls.filter((c) => c.method === 'addAndCommit').length).toBe(0);
});

test('planVerb: --pretty produces indented JSON output', () => {
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--pretty',
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.stdout).toContain('\n');
  expect(result.stdout).toContain('  "slug"');
});

// ---------- Slug-resolution / collision ----------

test('planVerb: derives slug from a topic via createSlug(topic, today)', () => {
  const result = planVerb(
    [
      'CLI: plan & revise!',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  const payload = JSON.parse(result.stdout as string);
  expect(payload.slug).toBe('2026-05-15-cli-plan-revise');
});

test('planVerb: full slug matching existing project throws project-already-exists', () => {
  makeTroutProject('2026-05-15-adopt-biome');
  const result = planVerb(
    [
      '2026-05-15-adopt-biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('project-already-exists');
});

test('planVerb: topic that derives to existing slug throws project-already-exists', () => {
  makeTroutProject('2026-05-15-adopt-biome');
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('project-already-exists');
});

// ---------- Directory exists but no PLAN.md ----------

test('planVerb: dir-exists-no-PLAN succeeds and writes files', () => {
  // Directory exists but has no MANIFEST.md (so it's not a trout
  // project) and no PLAN.md
  const targetDir = join(projectsRoot, '2026-05-15-adopt-biome');
  mkdirSync(targetDir, { recursive: true });
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.exitCode).toBe(0);
  expect(existsSync(join(targetDir, 'PLAN.md'))).toBe(true);
});

// ---------- PLAN.md exists ----------

test('planVerb: uncommitted PLAN.md is overwritten (recovery case)', () => {
  const targetDir = join(projectsRoot, '2026-05-15-adopt-biome');
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, 'PLAN.md'), 'stale content');
  // committedPaths is empty → isCommitted returns false
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.exitCode).toBe(0);
  expect(readFileSync(join(targetDir, 'PLAN.md'), 'utf8')).toContain('# PLAN');
});

test('planVerb: committed PLAN.md throws plan-exists-committed', () => {
  const targetDir = join(projectsRoot, '2026-05-15-adopt-biome');
  mkdirSync(targetDir, { recursive: true });
  const planMdPath = join(targetDir, 'PLAN.md');
  writeFileSync(planMdPath, 'committed plan');
  // Mark it committed in the stub
  committedPaths.add(planMdPath);
  const result = planVerb(
    [
      'Adopt Biome',
      `--plan-file=${planFile}`,
      `--interview-file=${interviewFile}`,
      '--no-commit',
    ],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('plan-exists-committed');
  expect(payload.message).toMatch(/revise/);
});

// ---------- Missing args ----------

test('planVerb: missing positional throws missing-args', () => {
  const result = planVerb(
    [`--plan-file=${planFile}`, `--interview-file=${interviewFile}`],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('planVerb: missing --plan-file throws missing-args', () => {
  const result = planVerb(
    ['Adopt Biome', `--interview-file=${interviewFile}`],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('planVerb: missing --interview-file throws missing-args', () => {
  const result = planVerb(
    ['Adopt Biome', `--plan-file=${planFile}`],
    baseCtx(),
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});
