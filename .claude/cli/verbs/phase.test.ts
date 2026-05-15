import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phaseRead, phaseList } from './phase.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-phase-'));
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('phaseRead: returns phase JSON for valid slug + number', () => {
  const result = phaseRead(['test-loom', '1'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.number).toBe(1);
  expect(phase.name).toBe('Schemas + fixtures');
  expect(phase.status).toBe('in-progress');
});

test('phaseRead: missing args returns missing-args error', () => {
  const result = phaseRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('missing-args');
});

test('phaseRead: invalid phase number returns invalid-phase error', () => {
  const result = phaseRead(['test-loom', 'abc'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('invalid-phase');
});

test('phaseRead: nonexistent phase number returns phase-not-found', () => {
  const result = phaseRead(['test-loom', '99'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('phase-not-found');
});

test('phaseList: returns all four phases', () => {
  const result = phaseList(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const phases = JSON.parse(result.stdout as string);
  expect(phases).toHaveLength(4);
});
