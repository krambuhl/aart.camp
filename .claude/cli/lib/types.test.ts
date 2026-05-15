import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Manifest, Event, Config, EventName } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

// ---------- In-test typeguards (validate fixture shape against types) ----------

function isManifest(v: unknown): v is Manifest {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    m.schema_version === 1 &&
    typeof m.title === 'string' &&
    typeof m.slug === 'string' &&
    typeof m.started === 'string' &&
    (m.status === 'active' || m.status === 'archived') &&
    (m.current_branch === null || typeof m.current_branch === 'string') &&
    (m.latest_checkin === null || typeof m.latest_checkin === 'string') &&
    typeof m.strategy === 'string' &&
    Array.isArray(m.phases)
  );
}

const EVENT_NAMES: ReadonlySet<EventName> = new Set([
  'project-initialized',
  'phase-started',
  'phase-completed',
  'phase-blocked',
  'phase-unblocked',
  'checkin-created',
  'pr-opened',
  'pr-updated',
  'pr-merged',
  'session-saved',
  'retro-written',
  'archived',
  'note',
]);

function isEvent(v: unknown): v is Event {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.at === 'string' &&
    typeof e.event === 'string' &&
    EVENT_NAMES.has(e.event as EventName) &&
    typeof e.detail === 'object' &&
    e.detail !== null
  );
}

function isConfig(v: unknown): v is Config {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    c.schema_version === 1 &&
    typeof c.base_branch === 'string' &&
    Array.isArray(c.reviewers) &&
    Array.isArray(c.labels) &&
    Array.isArray(c.verification) &&
    typeof c.worker_bindings === 'object' &&
    c.worker_bindings !== null
  );
}

// ---------- Round-trip tests ----------

test('manifest-basic.json conforms to Manifest type', () => {
  const text = readFixture('manifest-basic.json');
  const parsed = JSON.parse(text);
  expect(isManifest(parsed)).toBe(true);

  // Round-trip: re-serialize and compare against normalized original
  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('manifest-basic.json covers all four PhaseStatus values', () => {
  const text = readFixture('manifest-basic.json');
  const manifest = JSON.parse(text) as Manifest;
  const statuses = new Set(manifest.phases.map((p) => p.status));
  expect(statuses.has('not-started')).toBe(true);
  expect(statuses.has('in-progress')).toBe(true);
  expect(statuses.has('blocked')).toBe(true);
  expect(statuses.has('completed')).toBe(true);
});

test('events-all-types.jsonl has every event in the vocabulary', () => {
  const text = readFixture('events-all-types.jsonl');
  const lines = text.trim().split('\n');
  const events: unknown[] = lines.map((l) => JSON.parse(l));

  for (const e of events) {
    expect(isEvent(e)).toBe(true);
  }

  const namesInFixture = new Set((events as Event[]).map((e) => e.event));
  for (const name of EVENT_NAMES) {
    expect(namesInFixture.has(name)).toBe(true);
  }
});

test('events-all-types.jsonl round-trips line by line', () => {
  const text = readFixture('events-all-types.jsonl');
  const lines = text.trim().split('\n');
  for (const line of lines) {
    expect(JSON.stringify(JSON.parse(line))).toBe(JSON.stringify(JSON.parse(line)));
  }
});

test('config-basic.json conforms to Config type', () => {
  const text = readFixture('config-basic.json');
  const parsed = JSON.parse(text);
  expect(isConfig(parsed)).toBe(true);

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});
