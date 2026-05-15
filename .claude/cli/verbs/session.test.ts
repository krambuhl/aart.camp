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
  sessionList,
  sessionRead,
  sessionCorrections,
  sessionWrite,
} from './session.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-session-'));
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  const sessionsDir = join(projectPath, 'sessions');
  mkdirSync(sessionsDir);
  copyFileSync(
    join(FIXTURES, 'session-basic.json'),
    join(sessionsDir, '2026-05-15-a.json'),
  );
  // Add a checkin with corrections for sessionCorrections testing
  const branchDir = join(projectPath, 'checkins', 'loom-cli', 'phase-1');
  mkdirSync(branchDir, { recursive: true });
  copyFileSync(join(FIXTURES, 'checkin-basic.json'), join(branchDir, '04.json'));
  copyFileSync(
    join(FIXTURES, 'checkin-flagged.json'),
    join(branchDir, '07.json'),
  );
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('sessionList: enumerates session files', () => {
  const result = sessionList(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
});

test('sessionRead: returns one session', () => {
  const result = sessionRead(
    ['test-loom', '--filename=2026-05-15-a.json'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const s = JSON.parse(result.stdout as string);
  expect(s.date).toBe('2026-05-15');
});

test('sessionRead: missing --filename returns missing-args', () => {
  const result = sessionRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('sessionWrite: writes session and appends session-saved event', () => {
  const sample = JSON.parse(
    readFileSync(join(FIXTURES, 'session-basic.json'), 'utf8'),
  );
  sample.date = '2026-07-01';
  sample.letter = 'a';
  const sessionFile = join(projectsRoot, 'incoming-session.json');
  writeFileSync(sessionFile, JSON.stringify(sample), 'utf8');

  const result = sessionWrite(
    ['test-loom', `--session-file=${sessionFile}`],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const written = JSON.parse(result.stdout as string);
  expect(written.filename).toBe('2026-07-01-a.json');

  const eventsRaw = readFileSync(
    join(projectsRoot, '2026-05-15-test-loom', 'events.jsonl'),
    'utf8',
  );
  const lastLine = eventsRaw.trim().split('\n').pop() as string;
  const event = JSON.parse(lastLine);
  expect(event.event).toBe('session-saved');
  expect(event.detail.filename).toBe('2026-07-01-a.json');
});

test('sessionWrite: missing --session-file returns missing-args', () => {
  const result = sessionWrite(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('sessionCorrections: gathers correction lines from checkins', () => {
  // checkin-flagged.json has one correction in execution.corrections[]
  const result = sessionCorrections(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const corrections = JSON.parse(result.stdout as string);
  expect(Array.isArray(corrections)).toBe(true);
  expect(corrections.length).toBeGreaterThan(0);
  // Each entry should have the source checkin info
  const first = corrections[0];
  expect(first).toHaveProperty('checkin');
  expect(first).toHaveProperty('branch');
  expect(first).toHaveProperty('text');
});
