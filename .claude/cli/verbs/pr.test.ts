import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prDiscover } from './pr.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;
const branchDirRel = ['checkins', 'loom-cli', 'test-branch'];

function setupProjectWithCheckins(checkinNumbers: string[]): string {
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  const branchDir = join(projectPath, ...branchDirRel);
  mkdirSync(branchDir, { recursive: true });
  for (const n of checkinNumbers) {
    copyFileSync(
      join(FIXTURES, 'checkin-basic.json'),
      join(branchDir, `${n}.json`),
    );
  }
  return projectPath;
}

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-pr-'));
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('prDiscover: no existing PR returns marker_state=new', () => {
  setupProjectWithCheckins(['01', '02']);
  // Stub gh to return "no PR" (gh exits 1 when no PR matches)
  const ghRunner = () => {
    throw new Error('no pull requests found');
  };
  const result = prDiscover(
    ['test-loom', '--branch=loom-cli/test-branch'],
    { projectsRoot, ghRunner },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.marker_state).toBe('new');
  expect(out.checkins).toEqual([1, 2]);
  expect(out.pr).toBeNull();
});

test('prDiscover: PR body marker matches disk → fresh', () => {
  setupProjectWithCheckins(['01', '02']);
  const ghRunner = () =>
    JSON.stringify({
      number: 42,
      url: 'https://github.com/x/y/pull/42',
      body: '<!-- loom-pr-checkins: 01,02 -->\n\n## Body',
    });
  const result = prDiscover(
    ['test-loom', '--branch=loom-cli/test-branch'],
    { projectsRoot, ghRunner },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.marker_state).toBe('fresh');
  expect(out.pr.number).toBe(42);
});

test('prDiscover: PR marker is subset of disk → stale', () => {
  setupProjectWithCheckins(['01', '02', '03']);
  const ghRunner = () =>
    JSON.stringify({
      number: 42,
      url: 'https://github.com/x/y/pull/42',
      body: '<!-- loom-pr-checkins: 01,02 -->\n\n## Body',
    });
  const result = prDiscover(
    ['test-loom', '--branch=loom-cli/test-branch'],
    { projectsRoot, ghRunner },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.marker_state).toBe('stale');
});

test('prDiscover: PR marker is superset → drift', () => {
  setupProjectWithCheckins(['01']);
  const ghRunner = () =>
    JSON.stringify({
      number: 42,
      url: 'https://github.com/x/y/pull/42',
      body: '<!-- loom-pr-checkins: 01,02,03 -->\n\n## Body',
    });
  const result = prDiscover(
    ['test-loom', '--branch=loom-cli/test-branch'],
    { projectsRoot, ghRunner },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.marker_state).toBe('drift');
});

test('prDiscover: missing --branch returns missing-args', () => {
  setupProjectWithCheckins(['01']);
  const result = prDiscover(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});
