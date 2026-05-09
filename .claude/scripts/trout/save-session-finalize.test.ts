// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/save-session-finalize.ts');
const REPO_CAPTURE_SCRIPT = join(process.cwd(), '.claude/scripts/griot/capture.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(args: string[], cwd: string, scriptPath = SCRIPT): RunResult {
  try {
    const stdout = execFileSync('node', [scriptPath, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    };
  }
}

const SLUG = '2026-01-01-sample';

const SAMPLE_CONTENT = `# Session 2026-01-01-a

**Phases touched**: 1
**Checkins written**: 01

## What happened

Did the thing.

## Open threads

- nothing
`;

type FixtureOpts = {
  events?: string[]; // raw event-table rows like "| 2026-01-01 09:00 | checkin-created | 01 on feat/x |"
  checkins?: Array<{ branch: string; nn: string; content: string }>;
};

function makeFixture(opts: FixtureOpts = {}): { root: string; projectPath: string; contentFile: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'finalize-test-'));
  const projectPath = join(root, 'projects', SLUG);
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
  mkdirSync(join(root, 'learnings', 'session-notes'), { recursive: true });

  // Copy the repo's capture.ts script (and griot dir structure) so the
  // finalize script can spawn it. The finalize script resolves capture
  // via process.cwd(), so we need .claude/scripts/griot/ in the fixture.
  mkdirSync(join(root, '.claude', 'scripts', 'griot'), { recursive: true });
  cpSync(REPO_CAPTURE_SCRIPT, join(root, '.claude', 'scripts', 'griot', 'capture.ts'));

  const eventRows = (opts.events ?? []).join('\n');
  const manifest = `# Project: Sample

**Slug**: ${SLUG}
**Started**: 2026-01-01
**Status**: active

## Events

| When | Event | Detail |
|------|-------|--------|
${eventRows}
`;
  writeFileSync(join(projectPath, 'MANIFEST.md'), manifest);

  if (opts.checkins) {
    for (const c of opts.checkins) {
      const dir = join(projectPath, 'checkins', c.branch);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${c.nn}.md`), c.content);
    }
  }

  const contentFile = join(root, 'handoff.md');
  writeFileSync(contentFile, SAMPLE_CONTENT);

  return {
    root,
    projectPath,
    contentFile,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function checkinWithCorrections(corrections: string[], unit = 'Sample unit'): string {
  const lines = corrections.map((c) => `- correction: ${c}`).join('\n');
  return `# Checkin

**Unit**: ${unit}

## Contract

**Goal**: Do the thing.

## Notes for the PR

${lines}
`;
}

test('happy path: writes <date>-a.md when no prior session for the date', () => {
  const fx = makeFixture();
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^session-saved: projects\/2026-01-01-sample\/sessions\/2026-01-01-a\.md\n$/);
    const written = readFileSync(join(fx.projectPath, 'sessions', '2026-01-01-a.md'), 'utf-8');
    assert.equal(written, SAMPLE_CONTENT);
  } finally {
    fx.cleanup();
  }
});

test('happy path: writes <date>-b.md when -a exists', () => {
  const fx = makeFixture();
  try {
    mkdirSync(join(fx.projectPath, 'sessions'), { recursive: true });
    writeFileSync(join(fx.projectPath, 'sessions', '2026-01-01-a.md'), 'existing');
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /2026-01-01-b\.md/);
    assert.equal(readFileSync(join(fx.projectPath, 'sessions', '2026-01-01-a.md'), 'utf-8'), 'existing');
  } finally {
    fx.cleanup();
  }
});

test('happy path: writes <date>-z.md when a..y all exist', () => {
  const fx = makeFixture();
  try {
    const sessionsDir = join(fx.projectPath, 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    for (let code = 97; code <= 121; code++) {
      writeFileSync(join(sessionsDir, `2026-01-01-${String.fromCharCode(code)}.md`), 'x');
    }
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /2026-01-01-z\.md/);
  } finally {
    fx.cleanup();
  }
});

test('error: all letters a-z taken for the date', () => {
  const fx = makeFixture();
  try {
    const sessionsDir = join(fx.projectPath, 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    for (let code = 97; code <= 122; code++) {
      writeFileSync(join(sessionsDir, `2026-01-01-${String.fromCharCode(code)}.md`), 'x');
    }
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /save-session-finalize-error: all letters a-z taken for 2026-01-01/);
  } finally {
    fx.cleanup();
  }
});

test('error: project not found', () => {
  const fx = makeFixture();
  try {
    const result = run(['does-not-exist', `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /save-session-finalize-error: project not found/);
  } finally {
    fx.cleanup();
  }
});

test('error: --content-file missing', () => {
  const fx = makeFixture();
  try {
    const result = run([SLUG, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--content-file is required/);
  } finally {
    fx.cleanup();
  }
});

test('error: --content-file points to a non-existent path', () => {
  const fx = makeFixture();
  try {
    const result = run([SLUG, '--content-file=/tmp/does-not-exist-finalize-test.md', '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /content file not found/);
  } finally {
    fx.cleanup();
  }
});

test('correction capture: single correction in a session-window checkin', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 09:00 | project-initialized | — |',
      '| 2026-01-01 10:00 | checkin-created | 01 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: checkinWithCorrections(['always close the loop on the y']) },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 1, `expected 1 capture, got ${sessionNotes.length}: ${sessionNotes.join(', ')}`);
    assert.match(sessionNotes[0], /always-close-the-loop-on/);
  } finally {
    fx.cleanup();
  }
});

test('correction capture: multiple corrections in same checkin get distinct slugs', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 10:00 | checkin-created | 01 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: checkinWithCorrections([
        'always X the Y when Z',
        'do not P the Q in R',
      ]) },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 2, `expected 2 captures, got ${sessionNotes.length}`);
  } finally {
    fx.cleanup();
  }
});

test('cutoff respected: checkin-created before previous session-saved is NOT captured', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 09:00 | checkin-created | 01 on feat/x |',
      '| 2026-01-01 10:00 | session-saved | 2026-01-01-a |',
      '| 2026-01-01 11:00 | checkin-created | 02 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: checkinWithCorrections(['old correction from prior session']) },
      { branch: 'feat/x', nn: '02', content: checkinWithCorrections(['new correction from current session']) },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 1, `expected exactly 1 capture (new only), got ${sessionNotes.length}: ${sessionNotes.join(', ')}`);
    assert.match(sessionNotes[0], /new-correction-from-current-session/);
  } finally {
    fx.cleanup();
  }
});

test('no cutoff: every checkin-created since start of table is in scope when no session-saved exists', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 09:00 | checkin-created | 01 on feat/x |',
      '| 2026-01-01 10:00 | checkin-created | 02 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: checkinWithCorrections(['first correction']) },
      { branch: 'feat/x', nn: '02', content: checkinWithCorrections(['second correction']) },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 2);
  } finally {
    fx.cleanup();
  }
});

test('slug suffix collision: two corrections that kebabize to identical slug get -a/-b suffixed', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 10:00 | checkin-created | 01 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: checkinWithCorrections([
        // identical first 5 tokens after kebabize → same slug → suffix needed
        'remember to wash the dishes today',
        'remember to wash the dishes always',
      ]) },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 2, `expected 2 captures, got ${sessionNotes.length}`);
    const hasA = sessionNotes.some((n) => n.endsWith('remember-to-wash-the-dishes-a'));
    const hasB = sessionNotes.some((n) => n.endsWith('remember-to-wash-the-dishes-b'));
    assert.ok(hasA && hasB, `expected -a and -b suffixed slugs, got: ${sessionNotes.join(', ')}`);
  } finally {
    fx.cleanup();
  }
});

test('no corrections: succeeds without invoking capture', () => {
  const fx = makeFixture({
    events: [
      '| 2026-01-01 10:00 | checkin-created | 01 on feat/x |',
    ],
    checkins: [
      { branch: 'feat/x', nn: '01', content: '# Checkin\n\n**Unit**: U\n\n## Notes for the PR\n\n- nothing to capture\n' },
    ],
  });
  try {
    const result = run([SLUG, `--content-file=${fx.contentFile}`, '--date=2026-01-01'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const sessionNotes = readdirSync(join(fx.root, 'learnings', 'session-notes'));
    assert.equal(sessionNotes.length, 0);
  } finally {
    fx.cleanup();
  }
});
