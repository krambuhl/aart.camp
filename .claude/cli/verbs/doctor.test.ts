import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctor } from './doctor.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;
let projectPath: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-doctor-'));
  projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('doctor: healthy project returns ok=true with empty issues', () => {
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  copyFileSync(
    join(FIXTURES, 'events-all-types.jsonl'),
    join(projectPath, 'events.jsonl'),
  );
  copyFileSync(
    join(FIXTURES, 'config-basic.json'),
    join(projectPath, 'config.json'),
  );
  const result = doctor(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout as string);
  expect(report.ok).toBe(true);
  expect(report.issues).toEqual([]);
});

test('doctor: missing manifest is reported as an issue and ok=false', () => {
  // No files at all under projectPath
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  // Required-but-missing: events.jsonl and config.json
  const result = doctor(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout as string);
  expect(report.ok).toBe(false);
  expect(report.issues.length).toBeGreaterThan(0);
  const codes = report.issues.map((i: { code: string }) => i.code);
  expect(codes).toContain('events-missing');
  expect(codes).toContain('config-missing');
});

test('doctor: bad schema_version is reported', () => {
  // Write a manifest with schema_version: 999
  writeFileSync(
    join(projectPath, 'manifest.json'),
    JSON.stringify({ schema_version: 999, title: 'x', slug: 'x', started: '', status: 'active', current_branch: null, latest_checkin: null, strategy: '', phases: [] }),
  );
  copyFileSync(
    join(FIXTURES, 'events-all-types.jsonl'),
    join(projectPath, 'events.jsonl'),
  );
  copyFileSync(
    join(FIXTURES, 'config-basic.json'),
    join(projectPath, 'config.json'),
  );
  const result = doctor(['test-loom'], { projectsRoot });
  const report = JSON.parse(result.stdout as string);
  expect(report.ok).toBe(false);
  const codes = report.issues.map((i: { code: string }) => i.code);
  expect(codes).toContain('schema-version-mismatch');
});

test('doctor: no slug arg → uses cwd discovery (not-in-project error if absent)', () => {
  // Without a slug and without cwdOverride pointing at a project,
  // doctor reports it cannot find a project.
  const result = doctor([], { projectsRoot, cwdOverride: tmpdir() });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('not-in-project');
});
