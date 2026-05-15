import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readCheckin,
  listCheckins,
  latestCheckin,
  writeCheckin,
} from './checkin.ts';
import type { Checkin } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectPath: string;
let branchDir: string;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'loom-checkin-test-'));
  projectPath = join(root, '2026-05-15-test-loom');
  // Branch name with slash → nested subdir
  branchDir = join(projectPath, 'checkins', 'loom-cli', 'phase-1');
  mkdirSync(branchDir, { recursive: true });
  copyFileSync(
    join(FIXTURES, 'checkin-basic.json'),
    join(branchDir, '04.json'),
  );
  copyFileSync(
    join(FIXTURES, 'checkin-flagged.json'),
    join(branchDir, '07.json'),
  );
});

afterEach(() => {
  rmSync(dirname(projectPath), { recursive: true, force: true });
});

test('readCheckin loads a checkin.json', () => {
  const c = readCheckin(join(branchDir, '04.json'));
  expect(c.schema_version).toBe(1);
  expect(c.number).toBe('04');
  expect(c.verdict.result).toBe('approved');
});

test('readCheckin throws checkin-not-found on missing file', () => {
  expect(() => readCheckin('/nonexistent/checkin.json')).toThrow(
    /checkin-not-found/,
  );
});

test('listCheckins enumerates by branch', () => {
  const list = listCheckins(projectPath, { branch: 'loom-cli/phase-1' });
  expect(list).toHaveLength(2);
  expect(list.map((c) => c.number).sort()).toEqual(['04', '07']);
});

test('listCheckins with no branch enumerates across branches', () => {
  // Add a second branch
  const otherBranch = join(projectPath, 'checkins', 'feature-x');
  mkdirSync(otherBranch, { recursive: true });
  copyFileSync(join(FIXTURES, 'checkin-basic.json'), join(otherBranch, '01.json'));
  const list = listCheckins(projectPath);
  expect(list.length).toBe(3);
});

test('listCheckins on empty project returns []', () => {
  const emptyProj = mkdtempSync(join(tmpdir(), 'loom-empty-'));
  expect(listCheckins(emptyProj)).toEqual([]);
  rmSync(emptyProj, { recursive: true, force: true });
});

test('latestCheckin returns the highest-numbered one for a branch', () => {
  const c = latestCheckin(projectPath, { branch: 'loom-cli/phase-1' });
  expect(c?.number).toBe('07');
});

test('latestCheckin returns null when branch has no checkins', () => {
  expect(latestCheckin(projectPath, { branch: 'nonexistent' })).toBeNull();
});

test('writeCheckin writes to derived path and round-trips', () => {
  const sample = readCheckin(join(branchDir, '04.json'));
  // Use a branch that has a slash to exercise nested mkdir
  const cWithBranch: Checkin = { ...sample, branch: 'loom-cli/new', number: '01' };
  const written = writeCheckin(projectPath, cWithBranch);
  expect(written.path).toContain('checkins/loom-cli/new/01.json');
  const readBack = readCheckin(written.path);
  expect(readBack.number).toBe('01');
  expect(readBack.branch).toBe('loom-cli/new');
});

test('writeCheckin refuses to overwrite (immutability invariant)', () => {
  const sample = readCheckin(join(branchDir, '04.json'));
  // Align the checkin's branch field with the test setup so the
  // derived path collides with the existing 04.json
  const collision: Checkin = { ...sample, branch: 'loom-cli/phase-1', number: '04' };
  expect(() => writeCheckin(projectPath, collision)).toThrow(/checkin-already-exists/);
});
