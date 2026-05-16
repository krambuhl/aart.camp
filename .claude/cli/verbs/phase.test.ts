import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phaseRead, phaseList, phaseUpdate } from './phase.ts';

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

function readEventsJsonl(projectPath: string): Array<{ event: string; detail: Record<string, unknown> }> {
  try {
    const raw = readFileSync(join(projectPath, 'events.jsonl'), 'utf8');
    return raw
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

test('phaseUpdate: transition not-started → in-progress emits phase-started', () => {
  // Phase 2 is not-started in the fixture
  const result = phaseUpdate(
    ['test-loom', '2', '--status=in-progress'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.number).toBe(2);
  expect(phase.status).toBe('in-progress');
  const events = readEventsJsonl(join(projectsRoot, '2026-05-15-test-loom'));
  const last = events[events.length - 1];
  expect(last?.event).toBe('phase-started');
  expect(last?.detail.phase).toBe(2);
});

test('phaseUpdate: transition in-progress → completed emits phase-completed', () => {
  // Phase 1 is in-progress in the fixture
  const result = phaseUpdate(
    ['test-loom', '1', '--status=completed'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const events = readEventsJsonl(join(projectsRoot, '2026-05-15-test-loom'));
  const last = events[events.length - 1];
  expect(last?.event).toBe('phase-completed');
});

test('phaseUpdate: transition blocked → in-progress emits phase-unblocked', () => {
  // Phase 3 is blocked in the fixture
  const result = phaseUpdate(
    ['test-loom', '3', '--status=in-progress'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const events = readEventsJsonl(join(projectsRoot, '2026-05-15-test-loom'));
  const last = events[events.length - 1];
  expect(last?.event).toBe('phase-unblocked');
});

test('phaseUpdate: status=blocked requires --reason', () => {
  const result = phaseUpdate(
    ['test-loom', '2', '--status=blocked'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('missing-args');
});

test('phaseUpdate: status=blocked with --reason emits phase-blocked', () => {
  const result = phaseUpdate(
    ['test-loom', '2', '--status=blocked', '--reason=waiting on review'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.status).toBe('blocked');
  expect(phase.blocked_reason).toBe('waiting on review');
  const events = readEventsJsonl(join(projectsRoot, '2026-05-15-test-loom'));
  const last = events[events.length - 1];
  expect(last?.event).toBe('phase-blocked');
  expect(last?.detail.reason).toBe('waiting on review');
});

test('phaseUpdate: --branch and --pr propagate into the phase row', () => {
  const result = phaseUpdate(
    [
      'test-loom',
      '2',
      '--status=in-progress',
      '--branch=loom-cli/foo',
      '--pr=99',
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.branch).toBe('loom-cli/foo');
  expect(phase.pr).toBeDefined();
  expect(phase.pr.number).toBe(99);
});

test('phaseUpdate: nonexistent phase returns phase-not-found', () => {
  const result = phaseUpdate(
    ['test-loom', '99', '--status=in-progress'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('phase-not-found');
});

test('phaseUpdate: --url sets the real PR url instead of the placeholder', () => {
  const result = phaseUpdate(
    [
      'test-loom',
      '2',
      '--status=in-progress',
      '--pr=42',
      '--url=https://github.com/krambuhl/aart.camp/pull/42',
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.pr.url).toBe('https://github.com/krambuhl/aart.camp/pull/42');
});

test('phaseUpdate: --pr without --url falls back to placeholder url', () => {
  const result = phaseUpdate(
    ['test-loom', '2', '--status=in-progress', '--pr=42'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.pr.url).toContain('example/example/pull/42');
});

test('phaseUpdate: --pr-state=merged records PR as merged', () => {
  const result = phaseUpdate(
    [
      'test-loom',
      '2',
      '--status=completed',
      '--pr=42',
      '--url=https://github.com/k/r/pull/42',
      '--pr-state=merged',
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const phase = JSON.parse(result.stdout as string);
  expect(phase.pr.state).toBe('merged');
});

test('phaseUpdate: --pr-state with invalid value rejects', () => {
  const result = phaseUpdate(
    [
      'test-loom',
      '2',
      '--status=in-progress',
      '--pr=42',
      '--pr-state=draft',
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('invalid-pr-state');
});

test('phaseUpdate: --url without --pr rejects (need a PR to attach the url to)', () => {
  const result = phaseUpdate(
    [
      'test-loom',
      '2',
      '--status=in-progress',
      '--url=https://github.com/k/r/pull/42',
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});
