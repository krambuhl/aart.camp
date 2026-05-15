import { test, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  projectRead,
  projectList,
  projectStatus,
  projectScaffold,
  projectAdopt,
  projectArchive,
} from './project.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

let projectsRoot: string;
let projectPath: string;

beforeEach(() => {
  projectsRoot = mkdtempSync(join(tmpdir(), 'loom-verbs-project-'));
  projectPath = join(projectsRoot, '2026-05-15-test-loom');
  mkdirSync(projectPath);
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(projectPath, 'manifest.json'),
  );
  // Add an archived project too (with manifest marker)
  const archivePath = join(projectsRoot, 'archive', '2026-04-01-old');
  mkdirSync(archivePath, { recursive: true });
  copyFileSync(
    join(FIXTURES, 'manifest-basic.json'),
    join(archivePath, 'manifest.json'),
  );
});

afterEach(() => {
  rmSync(projectsRoot, { recursive: true, force: true });
});

test('projectRead: returns manifest JSON for valid slug', () => {
  const result = projectRead(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.stdout as string);
  expect(parsed.slug).toBe('2026-05-15-loom-cli');
  expect(parsed.phases).toHaveLength(4);
});

test('projectRead: --pretty pretty-prints', () => {
  const result = projectRead(['test-loom', '--pretty'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  // Pretty-print uses 2-space indent → multi-line output with whitespace
  expect((result.stdout as string).includes('\n')).toBe(true);
});

test('projectRead: missing slug returns missing-slug error', () => {
  const result = projectRead([], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('missing-slug');
});

test('projectRead: nonexistent slug returns project-not-found error', () => {
  const result = projectRead(['does-not-exist'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('project-not-found');
});

test('projectList: lists active projects as JSON', () => {
  const result = projectList([], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe('2026-05-15-test-loom');
});

test('projectList: --archived lists archive instead', () => {
  const result = projectList(['--archived'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const list = JSON.parse(result.stdout as string);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe('2026-04-01-old');
});

test('projectStatus: returns terse summary when cwd is inside a project', () => {
  // Simulate being inside the project by passing cwdOverride
  const result = projectStatus([], { projectsRoot, cwdOverride: projectPath });
  expect(result.exitCode).toBe(0);
  const summary = JSON.parse(result.stdout as string);
  expect(summary.slug).toBe('2026-05-15-test-loom');
  expect(summary.status).toBe('active');
});

test('projectStatus: returns not-in-project error when cwd is elsewhere', () => {
  const result = projectStatus([], { projectsRoot, cwdOverride: tmpdir() });
  expect(result.exitCode).toBe(1);
  const payload = JSON.parse(result.stderr as string);
  expect(payload.error).toBe('not-in-project');
});

// ---------- Scaffold tests ----------

function writeScaffoldInputs(dir: string): {
  planFile: string;
  configFile: string;
  manifestInitFile: string;
} {
  const planFile = join(dir, 'plan.md');
  const configFile = join(dir, 'config.json');
  const manifestInitFile = join(dir, 'manifest-init.json');
  writeFileSync(planFile, '# Plan\n\nNarrative.\n', 'utf8');
  writeFileSync(
    configFile,
    JSON.stringify({
      schema_version: 1,
      base_branch: 'main',
      reviewers: [],
      labels: ['project/test'],
      verification: ['npm run lint'],
      worker_bindings: { default: 'ev-loop-interactive' },
    }),
    'utf8',
  );
  writeFileSync(
    manifestInitFile,
    JSON.stringify({
      title: 'Test Project',
      started: '2026-05-15',
      strategy: 'A test strategy.',
      phases: [
        { number: 1, name: 'Phase one', status: 'not-started' },
        { number: 2, name: 'Phase two', status: 'not-started' },
      ],
    }),
    'utf8',
  );
  return { planFile, configFile, manifestInitFile };
}

test('projectScaffold: creates the full project tree with date prefix', () => {
  const inputs = writeScaffoldInputs(projectsRoot);
  const result = projectScaffold(
    [
      'my-new-project',
      `--plan-file=${inputs.planFile}`,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  // Date-less slug → today's date prepended
  expect(out.slug).toMatch(/^\d{4}-\d{2}-\d{2}-my-new-project$/);
  expect(existsSync(join(out.path, 'manifest.json'))).toBe(true);
  expect(existsSync(join(out.path, 'config.json'))).toBe(true);
  expect(existsSync(join(out.path, 'events.jsonl'))).toBe(true);
  expect(existsSync(join(out.path, 'PLAN.md'))).toBe(true);
  expect(existsSync(join(out.path, 'checkins'))).toBe(true);
  expect(existsSync(join(out.path, 'sessions'))).toBe(true);

  // Events.jsonl has the project-initialized event
  const events = readFileSync(join(out.path, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  expect(events).toHaveLength(1);
  expect(events[0].event).toBe('project-initialized');

  // Manifest contains the merged init + slug + defaults
  const m = JSON.parse(readFileSync(join(out.path, 'manifest.json'), 'utf8'));
  expect(m.schema_version).toBe(1);
  expect(m.slug).toBe(out.slug);
  expect(m.title).toBe('Test Project');
  expect(m.status).toBe('active');
  expect(m.current_branch).toBeNull();
  expect(m.latest_checkin).toBeNull();
  expect(m.phases).toHaveLength(2);
});

test('projectScaffold: accepts full slug form verbatim', () => {
  const inputs = writeScaffoldInputs(projectsRoot);
  const result = projectScaffold(
    [
      '2026-05-15-explicit-slug',
      `--plan-file=${inputs.planFile}`,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.slug).toBe('2026-05-15-explicit-slug');
});

test('projectScaffold: refuses to overwrite existing project', () => {
  const inputs = writeScaffoldInputs(projectsRoot);
  const args = [
    'duplicate',
    `--plan-file=${inputs.planFile}`,
    `--config-file=${inputs.configFile}`,
    `--manifest-init-file=${inputs.manifestInitFile}`,
  ];
  const first = projectScaffold(args, { projectsRoot });
  expect(first.exitCode).toBe(0);
  const second = projectScaffold(args, { projectsRoot });
  expect(second.exitCode).toBe(1);
  expect(JSON.parse(second.stderr as string).error).toBe('project-exists');
});

test('projectScaffold: rejects invalid slug (uppercase)', () => {
  const inputs = writeScaffoldInputs(projectsRoot);
  const result = projectScaffold(
    [
      'Invalid-Slug',
      `--plan-file=${inputs.planFile}`,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('invalid-slug');
});

test('projectScaffold: missing --plan-file returns missing-args', () => {
  const inputs = writeScaffoldInputs(projectsRoot);
  const result = projectScaffold(
    [
      'no-plan',
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

// ---------- Adopt tests ----------

// Adopt expects a directory that already has PLAN.md (e.g. from
// `bin/draft plan`). It writes the loom files alongside without
// touching PLAN.md or INTERVIEW.md.
function writeAdoptInputs(dir: string): {
  configFile: string;
  manifestInitFile: string;
} {
  const configFile = join(dir, 'config.json');
  const manifestInitFile = join(dir, 'manifest-init.json');
  writeFileSync(
    configFile,
    JSON.stringify({
      schema_version: 1,
      base_branch: 'main',
      reviewers: [],
      labels: [],
      verification: ['npm run lint'],
      worker_bindings: {},
    }),
    'utf8',
  );
  writeFileSync(
    manifestInitFile,
    JSON.stringify({
      title: 'Adopted Project',
      started: '2026-05-15',
      strategy: 'interactive',
      phases: [
        { number: 1, name: 'Phase one', status: 'not-started' },
      ],
    }),
    'utf8',
  );
  return { configFile, manifestInitFile };
}

function makeDraftProject(slug: string): string {
  const path = join(projectsRoot, slug);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'PLAN.md'), '# Plan\n', 'utf8');
  writeFileSync(join(path, 'INTERVIEW.md'), '# Interview\n', 'utf8');
  return path;
}

test('projectAdopt: writes loom files alongside existing PLAN.md', () => {
  const slug = '2026-05-15-draft-only';
  const path = makeDraftProject(slug);
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [
      slug,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.slug).toBe(slug);
  // Loom files now exist
  expect(existsSync(join(path, 'manifest.json'))).toBe(true);
  expect(existsSync(join(path, 'config.json'))).toBe(true);
  expect(existsSync(join(path, 'events.jsonl'))).toBe(true);
  expect(existsSync(join(path, 'checkins'))).toBe(true);
  expect(existsSync(join(path, 'sessions'))).toBe(true);
  // Draft files preserved untouched
  expect(readFileSync(join(path, 'PLAN.md'), 'utf8')).toBe('# Plan\n');
  expect(readFileSync(join(path, 'INTERVIEW.md'), 'utf8')).toBe(
    '# Interview\n',
  );
  // Manifest carries the init values
  const m = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'));
  expect(m.slug).toBe(slug);
  expect(m.title).toBe('Adopted Project');
  expect(m.status).toBe('active');
});

test('projectAdopt: refuses if project dir is missing', () => {
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [
      '2026-05-15-nonexistent',
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('project-not-found');
});

test('projectAdopt: refuses if PLAN.md is missing', () => {
  const slug = '2026-05-15-no-plan';
  const path = join(projectsRoot, slug);
  mkdirSync(path, { recursive: true });
  // Note: no PLAN.md written
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [
      slug,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('plan-not-found');
});

test('projectAdopt: refuses if manifest.json already exists', () => {
  const slug = '2026-05-15-already-adopted';
  const path = makeDraftProject(slug);
  // Pre-existing loom marker
  writeFileSync(join(path, 'manifest.json'), '{}', 'utf8');
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [
      slug,
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('already-adopted');
});

test('projectAdopt: missing --config-file returns missing-args', () => {
  const slug = '2026-05-15-missing-config';
  makeDraftProject(slug);
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [slug, `--manifest-init-file=${inputs.manifestInitFile}`],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

test('projectAdopt: missing slug returns missing-args', () => {
  const inputs = writeAdoptInputs(projectsRoot);
  const result = projectAdopt(
    [
      `--config-file=${inputs.configFile}`,
      `--manifest-init-file=${inputs.manifestInitFile}`,
    ],
    { projectsRoot },
  );
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('missing-args');
});

// ---------- Archive tests ----------

test('projectArchive: relocates project to archive/ and flips manifest status', () => {
  // projectPath exists from beforeEach (with manifest.json)
  // Add events.jsonl so archive can append
  writeFileSync(join(projectPath, 'events.jsonl'), '', 'utf8');

  const result = projectArchive(['test-loom'], { projectsRoot });
  expect(result.exitCode).toBe(0);
  const out = JSON.parse(result.stdout as string);
  expect(out.destination).toContain('archive');

  // Old location no longer exists
  expect(existsSync(projectPath)).toBe(false);
  // New location exists with manifest
  expect(existsSync(out.destination)).toBe(true);
  expect(existsSync(join(out.destination, 'manifest.json'))).toBe(true);

  // Manifest now says archived
  const m = JSON.parse(
    readFileSync(join(out.destination, 'manifest.json'), 'utf8'),
  );
  expect(m.status).toBe('archived');

  // Last event is `archived`
  const events = readFileSync(join(out.destination, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
  const last = events[events.length - 1];
  expect(last.event).toBe('archived');
  expect(last.detail.destination).toContain('archive');
});

test('projectArchive: nonexistent slug returns project-not-found', () => {
  const result = projectArchive(['nonexistent'], { projectsRoot });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr as string).error).toBe('project-not-found');
});
