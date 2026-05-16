#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

type StateJson = {
  classification: string;
  evaluator: string | null;
  code: string | null;
  'frequency-count': number | null;
  'file-line': string | null;
  status: 'captured' | 'archived' | 'escalated';
  promoted_as: string | null;
};

export type MigrationAction =
  | 'skipped-already-migrated'
  | 'migrated-from-frontmatter'
  | 'migrated-bare';

export type MigrationResult = {
  folder: string;
  action: MigrationAction;
  detail?: string;
};

type Frontmatter = {
  fields: Record<string, string>;
  closeLineIndex: number;
};

function parseFrontmatter(content: string): Frontmatter | null {
  const lines = content.split('\n');
  if (lines[0] !== '---') return null;
  const scanLimit = Math.min(lines.length, 60);
  let closeIdx = -1;
  for (let i = 1; i < scanLimit; i++) {
    if (lines[i] === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return null;
  const fields: Record<string, string> = {};
  for (let i = 1; i < closeIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.+?)\s*$/);
    if (m) fields[m[1]] = m[2];
  }
  return { fields, closeLineIndex: closeIdx };
}

function stripFrontmatter(content: string, fm: Frontmatter): string {
  const lines = content.split('\n');
  const remaining = lines.slice(fm.closeLineIndex + 1).join('\n');
  return remaining.replace(/^\n+/, '');
}

function parseFrequencyCount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function makeState(opts: {
  classification: string;
  evaluator?: string;
  code?: string;
  frequencyCount?: number | null;
  fileLine?: string;
  status: 'captured' | 'archived' | 'escalated';
}): StateJson {
  return {
    classification: opts.classification,
    evaluator: opts.evaluator ?? null,
    code: opts.code ?? null,
    'frequency-count': opts.frequencyCount ?? null,
    'file-line': opts.fileLine ?? null,
    status: opts.status,
    promoted_as: null,
  };
}

export function migrateFolder(
  folder: string,
  isArchived: boolean,
): MigrationResult {
  const stateJsonPath = join(folder, 'state.json');
  if (existsSync(stateJsonPath)) {
    return { folder, action: 'skipped-already-migrated' };
  }
  const learningPath = join(folder, 'learning.md');
  if (!existsSync(learningPath)) {
    return {
      folder,
      action: 'skipped-already-migrated',
      detail: 'no learning.md present',
    };
  }
  const learningContent = readFileSync(learningPath, 'utf-8');
  const fm = parseFrontmatter(learningContent);
  const status: 'captured' | 'archived' = isArchived ? 'archived' : 'captured';

  if (fm) {
    const f = fm.fields;
    const state = makeState({
      classification: f.classification ?? 'unclassified',
      evaluator: f.evaluator,
      code: f.code,
      frequencyCount: parseFrequencyCount(f['frequency-count']),
      fileLine: f['file-line'],
      status,
    });
    writeFileSync(stateJsonPath, `${JSON.stringify(state, null, 2)}\n`);
    writeFileSync(learningPath, stripFrontmatter(learningContent, fm));
    return {
      folder,
      action: 'migrated-from-frontmatter',
      detail: `classification=${state.classification}`,
    };
  }

  const state = makeState({ classification: 'unclassified', status });
  writeFileSync(stateJsonPath, `${JSON.stringify(state, null, 2)}\n`);
  return { folder, action: 'migrated-bare' };
}

type FolderEntry = { path: string; isArchived: boolean };

function findSessionNoteFolders(root: string): FolderEntry[] {
  const results: FolderEntry[] = [];
  if (!existsSync(root)) return results;
  for (const name of readdirSync(root)) {
    const fullPath = join(root, name);
    if (!statSync(fullPath).isDirectory()) continue;
    if (name === 'archived') {
      for (const archName of readdirSync(fullPath)) {
        const archFullPath = join(fullPath, archName);
        if (statSync(archFullPath).isDirectory()) {
          results.push({ path: archFullPath, isArchived: true });
        }
      }
    } else {
      results.push({ path: fullPath, isArchived: false });
    }
  }
  return results;
}

export function runMigration(sessionNotesRoot: string): MigrationResult[] {
  const folders = findSessionNoteFolders(sessionNotesRoot);
  return folders.map((f) => migrateFolder(f.path, f.isArchived));
}

function main(): void {
  const parsed = parseArgs({
    options: {
      root: { type: 'string' },
    },
    allowPositionals: false,
  });
  const cwd = process.cwd();
  const root =
    parsed.values.root ?? resolve(cwd, 'learnings/session-notes');
  const results = runMigration(root);
  const counts = {
    skipped: results.filter((r) => r.action === 'skipped-already-migrated').length,
    fromFrontmatter: results.filter(
      (r) => r.action === 'migrated-from-frontmatter',
    ).length,
    bare: results.filter((r) => r.action === 'migrated-bare').length,
  };
  console.log(`migrate-session-notes: processed ${results.length} folders`);
  console.log(`  already migrated (state.json present): ${counts.skipped}`);
  console.log(`  migrated from frontmatter: ${counts.fromFrontmatter}`);
  console.log(
    `  migrated bare (no frontmatter; pre-Phase-4 from-checkin): ${counts.bare}`,
  );
  for (const r of results) {
    if (r.action !== 'skipped-already-migrated') {
      console.log(`  ${r.action}: ${r.folder}${r.detail ? ` (${r.detail})` : ''}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
