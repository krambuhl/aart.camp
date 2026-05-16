import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { migrateFolder, runMigration } from './migrate-session-notes.ts';

let root: string;
let sessionNotesRoot: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'migrate-session-notes-test-'));
  sessionNotesRoot = join(root, 'learnings', 'session-notes');
  mkdirSync(sessionNotesRoot, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeNoteFolder(
  parent: string,
  name: string,
  files: Record<string, string>,
): string {
  const folderPath = join(parent, name);
  mkdirSync(folderPath, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(folderPath, filename), content);
  }
  return folderPath;
}

const FRONTMATTER_LEARNING = `---
classification: recurring
evaluator: evaluator-tokens
code: raw-hex
frequency-count: 3
file-line: components/Sketch.module.css:17
---

# Learning draft

**Recurring evaluator finding** — \`evaluator-tokens\` flagged \`raw-hex\` on 3 occurrences.

Evidence: #000 at Sketch.module.css:17

This pattern recurs in this project; future work in the same domain should avoid it.
`;

const BARE_LEARNING = `# Learning draft

When authoring a substrate primitive whose interface shape is named in an approved design plan, do not narrow the documented input shape on YAGNI grounds.

_Draft auto-generated from \`projects/.../checkins/01.md\` § Notes for the PR._
`;

test('migrates a live folder with frontmatter: writes state.json, strips frontmatter', () => {
  const folder = makeNoteFolder(
    sessionNotesRoot,
    '2026-05-09T12-00-00-recurring-raw-hex',
    { 'learning.md': FRONTMATTER_LEARNING },
  );
  const result = migrateFolder(folder, false);
  expect(result.action).toBe('migrated-from-frontmatter');
  expect(result.detail).toBe('classification=recurring');

  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state).toEqual({
    classification: 'recurring',
    evaluator: 'evaluator-tokens',
    code: 'raw-hex',
    'frequency-count': 3,
    'file-line': 'components/Sketch.module.css:17',
    status: 'captured',
    promoted_as: null,
  });

  const learning = readFileSync(join(folder, 'learning.md'), 'utf-8');
  expect(learning.startsWith('---')).toBe(false);
  expect(learning).toMatch(/^# Learning draft/);
  expect(learning).toMatch(/Recurring evaluator finding/);
});

test('migrates an archived folder with frontmatter: status=archived', () => {
  const archived = join(sessionNotesRoot, 'archived');
  mkdirSync(archived, { recursive: true });
  const folder = makeNoteFolder(archived, '2026-04-30T00-00-00-old', {
    'learning.md': FRONTMATTER_LEARNING,
  });
  const result = migrateFolder(folder, true);
  expect(result.action).toBe('migrated-from-frontmatter');
  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state.status).toBe('archived');
});

test('migrates a bare folder (no frontmatter): classification unclassified', () => {
  const folder = makeNoteFolder(
    sessionNotesRoot,
    '2026-05-09T13-00-00-bare-capture',
    { 'learning.md': BARE_LEARNING },
  );
  const result = migrateFolder(folder, false);
  expect(result.action).toBe('migrated-bare');
  const state = JSON.parse(readFileSync(join(folder, 'state.json'), 'utf-8'));
  expect(state).toEqual({
    classification: 'unclassified',
    evaluator: null,
    code: null,
    'frequency-count': null,
    'file-line': null,
    status: 'captured',
    promoted_as: null,
  });
  const learning = readFileSync(join(folder, 'learning.md'), 'utf-8');
  expect(learning).toBe(BARE_LEARNING);
});

test('idempotent: re-running on already-migrated folder is a no-op', () => {
  const folder = makeNoteFolder(
    sessionNotesRoot,
    '2026-05-09T14-00-00-already-migrated',
    {
      'learning.md': '# Learning draft\n\nPure prose body.\n',
      'state.json':
        '{"classification":"unclassified","evaluator":null,"code":null,"frequency-count":null,"file-line":null,"status":"captured","promoted_as":null}\n',
    },
  );
  const before = readFileSync(join(folder, 'state.json'), 'utf-8');
  const result = migrateFolder(folder, false);
  expect(result.action).toBe('skipped-already-migrated');
  const after = readFileSync(join(folder, 'state.json'), 'utf-8');
  expect(after).toBe(before);
});

test('runMigration walks live + archived/, returns per-folder results', () => {
  makeNoteFolder(sessionNotesRoot, '2026-05-09T15-00-00-live-bare', {
    'learning.md': BARE_LEARNING,
  });
  makeNoteFolder(sessionNotesRoot, '2026-05-09T15-01-00-live-fm', {
    'learning.md': FRONTMATTER_LEARNING,
  });
  const archived = join(sessionNotesRoot, 'archived');
  mkdirSync(archived, { recursive: true });
  makeNoteFolder(archived, '2026-04-30T00-00-00-archived-fm', {
    'learning.md': FRONTMATTER_LEARNING,
  });
  makeNoteFolder(archived, '2026-04-30T00-01-00-archived-bare', {
    'learning.md': BARE_LEARNING,
  });

  const results = runMigration(sessionNotesRoot);
  expect(results.length).toBe(4);
  const byAction = {
    bare: results.filter((r) => r.action === 'migrated-bare').length,
    fm: results.filter((r) => r.action === 'migrated-from-frontmatter').length,
    skipped: results.filter((r) => r.action === 'skipped-already-migrated').length,
  };
  expect(byAction).toEqual({ bare: 2, fm: 2, skipped: 0 });

  // Re-running is fully idempotent.
  const second = runMigration(sessionNotesRoot);
  expect(second.every((r) => r.action === 'skipped-already-migrated')).toBe(true);
});

test('folder without learning.md is skipped (not an error)', () => {
  const folder = makeNoteFolder(
    sessionNotesRoot,
    '2026-05-09T16-00-00-incomplete',
    { 'prompt.md': '# Triggering prompt\n' },
  );
  const result = migrateFolder(folder, false);
  expect(result.action).toBe('skipped-already-migrated');
  expect(result.detail).toBe('no learning.md present');
  expect(existsSync(join(folder, 'state.json'))).toBe(false);
});
