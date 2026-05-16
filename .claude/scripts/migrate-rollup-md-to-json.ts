#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export type RollupEntry = {
  id: string;
  title: string;
  classification: 'L' | 'AP';
  promoted: string;
  origin: string;
  body: string;
  rubric: string[] | null;
  evaluator?: string;
  code?: string;
};

const LEARNING_HEADER_RE = /^## (L-\d+):\s*(.+?)\s*$/m;
const ANTIPATTERN_SECTION_RE = /^## Project antipatterns\s*$/m;
const ANTIPATTERN_HEADER_RE = /^### (AP-\d+):\s*(.+?)\s*$/m;

function parseRubric(body: string): string[] | null {
  const re = /^- (.+)$/gm;
  const matches = Array.from(body.matchAll(re));
  if (matches.length === 0) return null;
  return matches.map((m) => m[1].trim());
}

function parseFieldLine(text: string, label: string): string | null {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function splitOnHeading(
  content: string,
  headingRe: RegExp,
): { id: string; title: string; body: string }[] {
  const entries: { id: string; title: string; body: string }[] = [];
  const re = new RegExp(headingRe.source, 'gm');
  const matches = Array.from(content.matchAll(re));
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const id = match[1];
    const title = match[2].trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const body = content.slice(start, end).trim();
    entries.push({ id, title, body });
  }
  return entries;
}

function extractSubsection(text: string, headingPattern: RegExp): string | null {
  const m = text.match(headingPattern);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.search(/^(### |## )/m);
  const end = nextHeading === -1 ? text.length : start + nextHeading;
  return text.slice(start, end).trim();
}

function parseLearningEntry(raw: {
  id: string;
  title: string;
  body: string;
}): RollupEntry {
  const promoted = parseFieldLine(raw.body, 'Promoted') ?? '';
  const origin = parseFieldLine(raw.body, 'Origin') ?? '';
  const learningSection = extractSubsection(raw.body, /^### Learning\s*$/m);
  const body = learningSection ?? '';
  const rubricSection = extractSubsection(raw.body, /^### Rubric\s*$/m);
  const rubric = rubricSection !== null ? parseRubric(rubricSection) : null;
  return {
    id: raw.id,
    title: raw.title,
    classification: 'L',
    promoted,
    origin,
    body,
    rubric,
  };
}

function parseAntipatternEntry(raw: {
  id: string;
  title: string;
  body: string;
}): RollupEntry {
  const promoted = parseFieldLine(raw.body, 'Promoted') ?? '';
  const origin = parseFieldLine(raw.body, 'Origin') ?? '';
  const evaluator = parseFieldLine(raw.body, 'Evaluator') ?? undefined;
  const code = parseFieldLine(raw.body, 'Code') ?? undefined;
  const bodyMatch = raw.body.match(
    /^Code:.+\n+([\s\S]+?)$/m,
  );
  const body = bodyMatch ? bodyMatch[1].trim() : raw.body.trim();
  return {
    id: raw.id,
    title: raw.title,
    classification: 'AP',
    promoted,
    origin,
    body,
    rubric: null,
    ...(evaluator !== undefined ? { evaluator } : {}),
    ...(code !== undefined ? { code } : {}),
  };
}

function extractAntipatternSection(content: string): string | null {
  const match = content.match(ANTIPATTERN_SECTION_RE);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextTopLevel = rest.search(/^## /m);
  return nextTopLevel === -1 ? rest : rest.slice(0, nextTopLevel);
}

export function parseRollup(content: string): RollupEntry[] {
  const entries: RollupEntry[] = [];

  const learningRaws = splitOnHeading(content, LEARNING_HEADER_RE);
  for (const raw of learningRaws) {
    entries.push(parseLearningEntry(raw));
  }

  const antipatternSection = extractAntipatternSection(content);
  if (antipatternSection !== null) {
    const antipatternRaws = splitOnHeading(antipatternSection, ANTIPATTERN_HEADER_RE);
    for (const raw of antipatternRaws) {
      entries.push(parseAntipatternEntry(raw));
    }
  }

  return entries;
}

export type MigrationResult =
  | { action: 'skipped-already-migrated'; jsonPath: string }
  | { action: 'migrated'; jsonPath: string; mdPath: string; entryCount: number }
  | { action: 'no-source'; mdPath: string };

export function runMigration(
  mdPath: string,
  jsonPath: string,
): MigrationResult {
  if (existsSync(jsonPath)) {
    return { action: 'skipped-already-migrated', jsonPath };
  }
  if (!existsSync(mdPath)) {
    return { action: 'no-source', mdPath };
  }
  const content = readFileSync(mdPath, 'utf-8');
  const entries = parseRollup(content);
  writeFileSync(jsonPath, `${JSON.stringify(entries, null, 2)}\n`);
  return {
    action: 'migrated',
    jsonPath,
    mdPath,
    entryCount: entries.length,
  };
}

function main(): void {
  const parsed = parseArgs({
    options: {
      root: { type: 'string' },
    },
    allowPositionals: false,
  });
  const cwd = process.cwd();
  const root = parsed.values.root ?? cwd;
  const mdPath = resolve(root, 'learnings/rollup.md');
  const jsonPath = resolve(root, 'learnings/rollup.json');
  const result = runMigration(mdPath, jsonPath);
  switch (result.action) {
    case 'skipped-already-migrated':
      console.log(
        `migrate-rollup-md-to-json: skipped — ${result.jsonPath} already exists`,
      );
      break;
    case 'no-source':
      console.log(
        `migrate-rollup-md-to-json: no source — ${result.mdPath} does not exist`,
      );
      break;
    case 'migrated':
      console.log(
        `migrate-rollup-md-to-json: migrated ${result.entryCount} entries from ${result.mdPath} → ${result.jsonPath}`,
      );
      console.log('  delete the source rollup.md manually as part of the migration commit');
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
