import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Manifest,
  Event,
  Config,
  EventName,
  Checkin,
  Session,
  Retro,
  CheckinVerdictResult,
} from './types.ts';

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

// ---------- Unit-of-work typeguards ----------

const CHECKIN_VERDICT_RESULTS: ReadonlySet<CheckinVerdictResult> = new Set([
  'approved',
  'flagged',
]);

function isCheckin(v: unknown): v is Checkin {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  const phase = c.phase as Record<string, unknown> | null;
  const contract = c.contract as Record<string, unknown> | null;
  const execution = c.execution as Record<string, unknown> | null;
  const verdict = c.verdict as Record<string, unknown> | null;
  return (
    c.schema_version === 1 &&
    typeof c.number === 'string' &&
    typeof c.created === 'string' &&
    typeof phase === 'object' &&
    phase !== null &&
    typeof phase.number === 'number' &&
    typeof phase.name === 'string' &&
    typeof c.branch === 'string' &&
    typeof c.unit === 'string' &&
    typeof contract === 'object' &&
    contract !== null &&
    Array.isArray(contract.acceptance_criteria) &&
    typeof execution === 'object' &&
    execution !== null &&
    Array.isArray(execution.actions) &&
    Array.isArray(execution.files_touched) &&
    Array.isArray(execution.corrections) &&
    Array.isArray(c.scope) &&
    typeof c.changes_since_previous === 'string' &&
    typeof verdict === 'object' &&
    verdict !== null &&
    CHECKIN_VERDICT_RESULTS.has(verdict.result as CheckinVerdictResult) &&
    Array.isArray(verdict.reasons) &&
    Array.isArray(c.notes_for_pr)
  );
}

function isSession(v: unknown): v is Session {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s.schema_version === 1 &&
    typeof s.date === 'string' &&
    typeof s.letter === 'string' &&
    Array.isArray(s.phases_touched) &&
    Array.isArray(s.checkins_written) &&
    Array.isArray(s.pr_activity) &&
    Array.isArray(s.what_happened) &&
    Array.isArray(s.open_threads) &&
    Array.isArray(s.notes)
  );
}

function isRetro(v: unknown): v is Retro {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.schema_version !== 1) return false;
  if (typeof r.created !== 'string') return false;
  if (!Array.isArray(r.findings)) return false;
  if (r.type === 'session') {
    return typeof r.phase === 'number' && typeof r.tier === 'number';
  }
  if (r.type === 'project') {
    return true;
  }
  return false;
}

// ---------- Unit-of-work round-trip tests ----------

test('checkin-basic.json conforms to Checkin type (approved verdict)', () => {
  const text = readFixture('checkin-basic.json');
  const parsed = JSON.parse(text);
  expect(isCheckin(parsed)).toBe(true);
  expect((parsed as Checkin).verdict.result).toBe('approved');

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('checkin-flagged.json conforms to Checkin type (flagged verdict)', () => {
  const text = readFixture('checkin-flagged.json');
  const parsed = JSON.parse(text);
  expect(isCheckin(parsed)).toBe(true);
  expect((parsed as Checkin).verdict.result).toBe('flagged');
  expect((parsed as Checkin).verdict.reasons.length).toBeGreaterThan(0);

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('checkin fixtures cover both CheckinVerdictResult values', () => {
  const basic = JSON.parse(readFixture('checkin-basic.json')) as Checkin;
  const flagged = JSON.parse(readFixture('checkin-flagged.json')) as Checkin;
  const results = new Set([basic.verdict.result, flagged.verdict.result]);
  expect(results.has('approved')).toBe(true);
  expect(results.has('flagged')).toBe(true);
});

test('session-basic.json conforms to Session type', () => {
  const text = readFixture('session-basic.json');
  const parsed = JSON.parse(text);
  expect(isSession(parsed)).toBe(true);

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('retro-session.json conforms to Retro (session variant)', () => {
  const text = readFixture('retro-session.json');
  const parsed = JSON.parse(text);
  expect(isRetro(parsed)).toBe(true);
  expect((parsed as Retro).type).toBe('session');

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('retro-project.json conforms to Retro (project variant)', () => {
  const text = readFixture('retro-project.json');
  const parsed = JSON.parse(text);
  expect(isRetro(parsed)).toBe(true);
  expect((parsed as Retro).type).toBe('project');

  const restringified = JSON.stringify(parsed);
  const originalNormalized = JSON.stringify(JSON.parse(text));
  expect(restringified).toBe(originalNormalized);
});

test('retro fixtures cover both Retro types', () => {
  const session = JSON.parse(readFixture('retro-session.json')) as Retro;
  const project = JSON.parse(readFixture('retro-project.json')) as Retro;
  expect(session.type).toBe('session');
  expect(project.type).toBe('project');
});
