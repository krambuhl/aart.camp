#!/usr/bin/env node
// Helper script for /guild-whiteboard.
//
// Four verbs:
//   init <path> --topic=<str>   — create the whiteboard file with the
//                                  topical header. Idempotent.
//   detect-round <path>         — return max(existing ## Round N) + 1
//                                  (or 1 if file is new/empty).
//   append <path>               — read JSON array from stdin
//                                  ({engineer, section}[]), append a
//                                  new round block, emit the locked
//                                  Result JSON on stdout.
//   read-state <path>           — read the file, parse all rounds,
//                                  emit {rounds: [{number, sections:
//                                  [{engineer, section}]}]} on stdout.
//
// Error prefix: `guild-whiteboard-error:` (mirrors
// `parse-and-aggregate-error:` and `derive-panel-error:` conventions
// in the sibling guild scripts). All errors go to stderr; non-zero
// exit on failure.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

type Section = { engineer: string; section: string };
type Round = { number: number; sections: Section[] };
type State = { rounds: Round[] };
type AppendResult = {
  whiteboard_path: string;
  round: number;
  sections: Section[];
  contradictions: never[];
};

function fail(reason: string): never {
  process.stderr.write(`guild-whiteboard-error: ${reason}\n`);
  process.exit(1);
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf-8');
  } catch (err) {
    fail(`could not read stdin: ${(err as Error).message}`);
  }
}

// Parse the whiteboard file into {rounds: [{number, sections}]}.
// Rounds are identified by `## Round N` headers (case-insensitive on
// the word "Round", N is a positive integer). Sections within a round
// are identified by `### From <engineer-name>` headers; the section
// body is everything between that header and the next `###`/`##`
// boundary, trimmed of trailing whitespace.
function parseState(content: string): State {
  if (!content.trim()) return { rounds: [] };

  const lines = content.split('\n');
  const rounds: Round[] = [];
  let currentRound: Round | null = null;
  let currentSection: Section | null = null;
  let buffer: string[] = [];

  const flushSection = () => {
    if (currentSection && currentRound) {
      // Trim leading and trailing blank lines; preserve internal blanks.
      currentSection.section = buffer.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
      currentRound.sections.push(currentSection);
    }
    currentSection = null;
    buffer = [];
  };
  const flushRound = () => {
    flushSection();
    if (currentRound) rounds.push(currentRound);
    currentRound = null;
  };

  for (const line of lines) {
    const roundMatch = line.match(/^##\s+Round\s+(\d+)\s*$/i);
    if (roundMatch) {
      flushRound();
      currentRound = { number: Number(roundMatch[1]), sections: [] };
      continue;
    }
    const sectionMatch = line.match(/^###\s+From\s+(\S+)\s*$/);
    if (sectionMatch && currentRound) {
      flushSection();
      currentSection = { engineer: sectionMatch[1], section: '' };
      continue;
    }
    if (currentSection) buffer.push(line);
  }
  flushRound();
  return { rounds };
}

function detectNextRound(content: string): number {
  const state = parseState(content);
  if (state.rounds.length === 0) return 1;
  const max = state.rounds.reduce((acc, r) => (r.number > acc ? r.number : acc), 0);
  return max + 1;
}

function ensureParentDir(path: string): void {
  const parent = dirname(path);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
}

function runInit(path: string, topic: string): void {
  if (existsSync(path)) {
    // Idempotent: no-op if file exists. Topic-mismatch is the caller's
    // problem; we don't second-guess the existing header.
    return;
  }
  ensureParentDir(path);
  const header = `# Whiteboard: ${topic.trim()}\n`;
  writeFileSync(path, header, 'utf-8');
}

function runDetectRound(path: string): void {
  let content = '';
  if (existsSync(path)) {
    try {
      content = readFileSync(path, 'utf-8');
    } catch (err) {
      fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const next = detectNextRound(content);
  process.stdout.write(`${next}\n`);
}

function validateAppendInput(parsed: unknown): Section[] {
  if (!Array.isArray(parsed)) {
    fail('append input must be a JSON array of {engineer, section} entries');
  }
  const sections: Section[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const e = parsed[i];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      fail(`entry [${i}] must be an object`);
    }
    const obj = e as Record<string, unknown>;
    if (typeof obj.engineer !== 'string' || obj.engineer.length === 0) {
      fail(`entry [${i}] must have a non-empty string \`engineer\` field`);
    }
    if (typeof obj.section !== 'string') {
      fail(`entry [${i}] must have a string \`section\` field`);
    }
    sections.push({ engineer: obj.engineer, section: obj.section });
  }
  return sections;
}

function formatRoundBlock(round: number, sections: Section[]): string {
  const parts: string[] = [`## Round ${round}`, ''];
  for (const s of sections) {
    parts.push(`### From ${s.engineer}`, '', s.section.replace(/\s+$/, ''), '');
  }
  return `${parts.join('\n')}\n`;
}

function runAppend(path: string): void {
  const stdin = readStdin();
  if (!stdin.trim()) {
    fail('empty input on stdin; expected JSON array of {engineer, section} entries');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch (err) {
    fail(`JSON parse error: ${(err as Error).message}`);
  }
  const sections = validateAppendInput(parsed);

  let existing = '';
  if (existsSync(path)) {
    try {
      existing = readFileSync(path, 'utf-8');
    } catch (err) {
      fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const round = detectNextRound(existing);
  const block = formatRoundBlock(round, sections);

  // If file does not exist yet, prepend a minimal header so subsequent
  // detect-round / read-state calls have something to anchor on.
  const base = existing.length > 0 ? existing : '# Whiteboard\n';
  const separator = base.endsWith('\n\n') ? '' : base.endsWith('\n') ? '\n' : '\n\n';
  const next = `${base}${separator}${block}`;

  ensureParentDir(path);
  writeFileSync(path, next, 'utf-8');

  const result: AppendResult = {
    whiteboard_path: path,
    round,
    sections,
    contradictions: [],
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function runReadState(path: string): void {
  let content = '';
  if (existsSync(path)) {
    try {
      content = readFileSync(path, 'utf-8');
    } catch (err) {
      fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const state = parseState(content);
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

function parseTopic(args: string[]): string {
  const { values } = parseArgs({
    args,
    options: { topic: { type: 'string' } },
    allowPositionals: true,
    strict: false,
  });
  if (typeof values.topic !== 'string' || values.topic.length === 0) {
    fail('init requires --topic=<string>');
  }
  return values.topic;
}

function main(): void {
  const [, , verb, ...rest] = process.argv;
  if (!verb) {
    fail('usage: whiteboard.ts <init|detect-round|append|read-state> <path> [args]');
  }
  const path = rest[0];
  if (!path) {
    fail(`verb \`${verb}\` requires a whiteboard path as the first positional argument`);
  }
  switch (verb) {
    case 'init':
      runInit(path, parseTopic(rest.slice(1)));
      return;
    case 'detect-round':
      runDetectRound(path);
      return;
    case 'append':
      runAppend(path);
      return;
    case 'read-state':
      runReadState(path);
      return;
    default:
      fail(`unknown verb \`${verb}\` (expected one of: init, detect-round, append, read-state)`);
  }
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('whiteboard.ts');
if (invokedDirectly) main();

// Exports for testing.
export { detectNextRound, formatRoundBlock, parseState };
export type { AppendResult, Round, Section, State };
