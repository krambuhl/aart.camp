import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkinList, checkinRead, checkinLatest } from './checkin.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-checkin-'));
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  // Loom marker
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  // Branch with slash → nested dir
  const branchDir = join(projectPath, 'checkins', 'loom-cli', 'phase-1');
  mkdirSync(branchDir, { recursive: true });
  copyFileSync(join(FIXTURES, 'checkin-basic.json'), join(branchDir, '04.json'));
  copyFileSync(join(FIXTURES, 'checkin-flagged.json'), join(branchDir, '07.json'));
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('checkinList: returns all checkins for a project', () => {
  const result = checkinList(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(2);
});

test('checkinList: --branch filters', () => {
  const result = checkinList(
    ['test-loom', '--branch=loom-cli/phase-1'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(2);
});

test('checkinRead: returns one checkin', () => {
  const result = checkinRead(
    ['test-loom', '--branch=loom-cli/phase-1', '--number=04'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const c = JSON.parse(result.stdout as string);
  expect(c.number).toBe('04');
  expect(c.verdict.result).toBe('approved');
});

test('checkinRead: missing --branch returns missing-args', () => {
  const result = checkinRead(['test-loom', '--number=04'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('checkinLatest: returns the highest-numbered for a branch', () => {
  const result = checkinLatest(
    ['test-loom', '--branch=loom-cli/phase-1'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const c = JSON.parse(result.stdout as string);
  expect(c.number).toBe('07');
});

test('checkinLatest: no checkins → no-checkins error', () => {
  const result = checkinLatest(
    ['test-loom', '--branch=nonexistent'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('no-checkins');
});
