import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsRead, eventsLatest } from './events.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-events-'));
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  // listProjects/resolveProject filter by manifest.json existence
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  copyFileSync(
    join(FIXTURES, 'events-all-types.jsonl'),
    join(projectPath, 'events.jsonl'),
  );
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('eventsRead: returns all events as JSON array', () => {
  const result = eventsRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const events = JSON.parse(result.stdout as string);
  expect(events).toHaveLength(14);
});

test('eventsRead: --event filter', () => {
  const result = eventsRead(['test-loom', '--event=retro-written'], {
    projectsRoot,
  });
  expect(result.exitCode).toBe(0);
  const events = JSON.parse(result.stdout as string);
  expect(events).toHaveLength(2);
});

test('eventsRead: --limit caps result', () => {
  const result = eventsRead(['test-loom', '--limit=3'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const events = JSON.parse(result.stdout as string);
  expect(events).toHaveLength(3);
});

test('eventsRead: --since filter', () => {
  const result = eventsRead(['test-loom', '--since=2026-05-15T12:00:00Z'], {
    projectsRoot,
  });
  expect(result.exitCode).toBe(0);
  const events = JSON.parse(result.stdout as string);
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) {
    expect(e.at >= '2026-05-15T12:00:00Z').toBe(true);
  }
});

test('eventsRead: missing slug returns missing-slug', () => {
  const result = eventsRead([], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('missing-slug');
});

test('eventsLatest: returns the most recent event', () => {
  const result = eventsLatest(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const e = JSON.parse(result.stdout as string);
  expect(e.event).toBe('note');
});

test('eventsLatest: --event filter narrows the search', () => {
  const result = eventsLatest(['test-loom', '--event=phase-started'], {
    projectsRoot,
  });
  expect(result.exitCode).toBe(0);
  const e = JSON.parse(result.stdout as string);
  expect(e.event).toBe('phase-started');
});

test('eventsLatest: no events matching filter returns no-events', () => {
  const result = eventsLatest(['test-loom', '--event=pr-closed' as string], {
    projectsRoot,
  });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('no-events');
});
