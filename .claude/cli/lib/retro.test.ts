import { test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRetro, listRetros, writeRetro } from './retro.ts';
import type { Retro } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectPath: string;
let retrosDir: string;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'loom-retro-test-'));
  projectPath = join(root, '2026-05-15-test-loom');
  retrosDir = join(projectPath, 'retros');
  mkdirSync(retrosDir, { recursive: true });
  copyFileSync(
    join(FIXTURES, 'retro-session.json'),
    join(retrosDir, 'phase-2-tier-3.json'),
  );
  copyFileSync(
    join(FIXTURES, 'retro-project.json'),
    join(retrosDir, 'project.json'),
  );
});

afterEach(() => {
  rmSync(dirname(projectPath), { recursive: true, force: true });
});

test('readRetro loads a session retro', () => {
  const r = readRetro(join(retrosDir, 'phase-2-tier-3.json'));
  expect(r.schema_version).toBe(1);
  expect(r.type).toBe('session');
});

test('readRetro loads a project retro', () => {
  const r = readRetro(join(retrosDir, 'project.json'));
  expect(r.type).toBe('project');
});

test('readRetro throws retro-not-found on missing file', () => {
  expect(() => readRetro('/nonexistent/retro.json')).toThrow(/retro-not-found/);
});

test('listRetros enumerates all by default', () => {
  const list = listRetros(projectPath);
  expect(list).toHaveLength(2);
});

test('listRetros filters by type=session', () => {
  const list = listRetros(projectPath, { type: 'session' });
  expect(list).toHaveLength(1);
  expect(list[0].type).toBe('session');
});

test('listRetros filters by type=project', () => {
  const list = listRetros(projectPath, { type: 'project' });
  expect(list).toHaveLength(1);
  expect(list[0].type).toBe('project');
});

test('listRetros on empty project returns []', () => {
  const emptyProj = mkdtempSync(join(tmpdir(), 'loom-empty-'));
  expect(listRetros(emptyProj)).toEqual([]);
  rmSync(emptyProj, { recursive: true, force: true });
});

test('writeRetro session derives phase-N-tier-M filename', () => {
  const emptyProj = mkdtempSync(join(tmpdir(), 'loom-retro-write-'));
  const r: Retro = {
    schema_version: 1,
    type: 'session',
    created: '2026-06-01T12:00:00Z',
    phase: 3,
    tier: 1,
    findings: [],
  };
  const written = writeRetro(emptyProj, r);
  expect(written.path).toContain('retros/phase-3-tier-1.json');
  expect(readRetro(written.path).type).toBe('session');
  rmSync(emptyProj, { recursive: true, force: true });
});

test('writeRetro project derives project.json filename', () => {
  const emptyProj = mkdtempSync(join(tmpdir(), 'loom-retro-write-'));
  const r: Retro = {
    schema_version: 1,
    type: 'project',
    created: '2026-06-01T12:00:00Z',
    findings: [],
  };
  const written = writeRetro(emptyProj, r);
  expect(written.path).toContain('retros/project.json');
  rmSync(emptyProj, { recursive: true, force: true });
});

test('writeRetro refuses to overwrite', () => {
  // Existing setup has retros/project.json
  const r: Retro = {
    schema_version: 1,
    type: 'project',
    created: '2026-06-01T12:00:00Z',
    findings: [],
  };
  expect(() => writeRetro(projectPath, r)).toThrow(/retro-already-exists/);
});
