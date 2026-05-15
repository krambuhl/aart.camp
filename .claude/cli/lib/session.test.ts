import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession, listSessions, writeSession } from './session.ts';
import type { Session } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectPath: string;
let sessionsDir: string;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'loom-session-test-'));
  projectPath = join(root, '2026-05-15-test-loom');
  sessionsDir = join(projectPath, 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  copyFileSync(
    join(FIXTURES, 'session-basic.json'),
    join(sessionsDir, '2026-05-15-a.json'),
  );
});

afterEach(() => {
  rmSync(dirname(projectPath), { recursive: true, force: true });
});

test('readSession loads a session.json', () => {
  const s = readSession(join(sessionsDir, '2026-05-15-a.json'));
  expect(s.schema_version).toBe(1);
  expect(s.date).toBe('2026-05-15');
  expect(s.letter).toBe('a');
});

test('readSession throws session-not-found on missing file', () => {
  expect(() => readSession('/nonexistent/session.json')).toThrow(
    /session-not-found/,
  );
});

test('listSessions enumerates session files', () => {
  copyFileSync(
    join(FIXTURES, 'session-basic.json'),
    join(sessionsDir, '2026-05-15-b.json'),
  );
  const list = listSessions(projectPath);
  expect(list).toHaveLength(2);
});

test('listSessions on empty project returns []', () => {
  const emptyProj = mkdtempSync(join(tmpdir(), 'loom-empty-'));
  expect(listSessions(emptyProj)).toEqual([]);
  rmSync(emptyProj, { recursive: true, force: true });
});

test('writeSession derives filename from date+letter and round-trips', () => {
  const sample = readSession(join(sessionsDir, '2026-05-15-a.json'));
  const newSession: Session = { ...sample, date: '2026-06-01', letter: 'a' };
  const written = writeSession(projectPath, newSession);
  expect(written.path).toContain('sessions/2026-06-01-a.json');
  const readBack = readSession(written.path);
  expect(readBack.date).toBe('2026-06-01');
});

test('writeSession refuses to overwrite', () => {
  const sample = readSession(join(sessionsDir, '2026-05-15-a.json'));
  expect(() => writeSession(projectPath, sample)).toThrow(/session-already-exists/);
});
