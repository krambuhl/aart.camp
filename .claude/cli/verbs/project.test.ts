import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  copyFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRead, projectList, projectStatus } from './project.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;
let projectPath: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-project-'));
  projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  // Add an archived project too (with manifest marker)
  const archivePath = join(projectsRoot, 'archive', '2026-04-01-old');
  mkdirSync(archivePath, { recursive: true });
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(archivePath, 'manifest.json'),
  );
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('projectRead: returns manifest JSON for valid slug', () => {
  const result = projectRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout as string);
  expect(parsed.slug).toBe('2026-05-15-loom-cli');
  expect(parsed.phases).toHaveLength(4);
});

test('projectRead: --pretty pretty-prints', () => {
  const result = projectRead(['test-loom', '--pretty'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  // Pretty-print uses 2-space indent → multi-line output with whitespace
  expect((result.stdout as string).includes('\n')).toBe(true);
});

test('projectRead: missing slug returns missing-slug error', () => {
  const result = projectRead([], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('missing-slug');
});

test('projectRead: nonexistent slug returns project-not-found error', () => {
  const result = projectRead(['does-not-exist'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('project-not-found');
});

test('projectList: lists active projects as JSON', () => {
  const result = projectList([], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe('2026-05-15-test-loom');
});

test('projectList: --archived lists archive instead', () => {
  const result = projectList(['--archived'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe('2026-04-01-old');
});

test('projectStatus: returns terse summary when cwd is inside a project', () => {
  // Simulate being inside the project by passing cwdOverride
  const result = projectStatus([], { projectsRoot, cwdOverride: projectPath });
  expect(result.exitCode).toBe(0);
  const summary = JSON.parse(result.stdout as string);
  expect(summary.slug).toBe('2026-05-15-test-loom');
  expect(summary.status).toBe('active');
});

test('projectStatus: returns not-in-project error when cwd is elsewhere', () => {
  const result = projectStatus([], { projectsRoot, cwdOverride: tmpdir() });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('not-in-project');
});
