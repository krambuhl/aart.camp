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
import { retroList, retroRead, retroWrite } from './retro.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-retro-'));
  const projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  const retrosDir = join(projectPath, 'retros');
  mkdirSync(retrosDir);
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
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('retroList: returns both retros', () => {
  const result = retroList(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(2);
});

test('retroList: --type=session filters', () => {
  const result = retroList(['test-loom', '--type=session'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
  expect(list[0].type).toBe('session');
});

test('retroRead: project retro', () => {
  const result = retroRead(['test-loom', '--type=project'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const r = JSON.parse(result.stdout as string);
  expect(r.type).toBe('project');
});

test('retroRead: session retro requires --phase and --tier', () => {
  const result = retroRead(
    ['test-loom', '--type=session', '--phase=2', '--tier=3'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const r = JSON.parse(result.stdout as string);
  expect(r.type).toBe('session');
});

test('retroRead: session retro missing --phase returns missing-args', () => {
  const result = retroRead(
    ['test-loom', '--type=session', '--tier=3'],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('retroRead: missing --type returns missing-args', () => {
  const result = retroRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('retroWrite: writes a session retro and appends retro-written event', () => {
  // Use a fresh phase/tier so it doesn't collide
  const retro = {
    schema_version: 1,
    type: 'session',
    created: '2026-07-01T12:00:00Z',
    phase: 4,
    tier: 5,
    findings: [],
  };
  const retroFile = join(projectsRoot, 'incoming-retro.json');
  writeFileSync(retroFile, JSON.stringify(retro), 'utf8');

  const result = retroWrite(
    ['test-loom', `--retro-file=${retroFile}`],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const written = JSON.parse(result.stdout as string);
  expect(written.filename).toBe('phase-4-tier-5.json');

  const eventsRaw = readFileSync(
    join(projectsRoot, '2026-05-15-test-loom', 'events.jsonl'),
    'utf8',
  );
  const lastLine = eventsRaw.trim().split('\n').pop() as string;
  const event = JSON.parse(lastLine);
  expect(event.event).toBe('retro-written');
  expect(event.detail.type).toBe('session');
  expect(event.detail.phase).toBe(4);
  expect(event.detail.tier).toBe(5);
});

test('retroWrite: missing --retro-file returns missing-args', () => {
  const result = retroWrite(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});
