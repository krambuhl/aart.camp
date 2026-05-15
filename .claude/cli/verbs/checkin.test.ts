import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkinList,
  checkinRead,
  checkinLatest,
  checkinWrite,
} from './checkin.ts';

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

test('checkinWrite: writes a new checkin and appends checkin-created event', () => {
  // Build a new checkin JSON with a fresh number/branch combo
  const sourceText = readFileSync(
    join(FIXTURES, 'checkin-basic.json'),
    'utf8',
  );
  const sample = JSON.parse(sourceText);
  sample.number = '11';
  sample.branch = 'loom-cli/feature-new';
  const checkinFile = join(projectsRoot, 'incoming-checkin.json');
  writeFileSync(checkinFile, JSON.stringify(sample), 'utf8');

  const result = checkinWrite(
    ['test-loom', `--checkin-file=${checkinFile}`],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const written = JSON.parse(result.stdout as string);
  expect(written.number).toBe('11');
  expect(written.branch).toBe('loom-cli/feature-new');

  // Event must be appended
  const eventsRaw = readFileSync(
    join(projectsRoot, '2026-05-15-test-loom', 'events.jsonl'),
    'utf8',
  );
  const lastLine = eventsRaw.trim().split('\n').pop() as string;
  const event = JSON.parse(lastLine);
  expect(event.event).toBe('checkin-created');
  expect(event.detail.number).toBe('11');
  expect(event.detail.branch).toBe('loom-cli/feature-new');
});

test('checkinWrite: missing --checkin-file returns missing-args', () => {
  const result = checkinWrite(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('checkinWrite: invalid schema_version returns invalid-checkin', () => {
  const badFile = join(projectsRoot, 'bad-checkin.json');
  writeFileSync(badFile, JSON.stringify({ schema_version: 999 }), 'utf8');
  const result = checkinWrite(
    ['test-loom', `--checkin-file=${badFile}`],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('invalid-checkin');
});
