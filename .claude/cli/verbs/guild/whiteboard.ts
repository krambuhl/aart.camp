// Helper verb for /guild-whiteboard.
//
// Four subverbs:
//   init <path> --topic=<str>   — create the whiteboard file with the
//                                  topical header. Idempotent.
//   detect-round <path>         — return max(existing ## Round N) + 1
//                                  (or 1 if file is new/empty).
//   append <path>               — read JSON array from ctx.stdin
//                                  ({engineer, section}[]), append a
//                                  new round block, emit the locked
//                                  Result JSON on stdout.
//   read-state <path>           — read the file, parse all rounds,
//                                  emit {rounds: [{number, sections:
//                                  [{engineer, section}]}]} on stdout.
//
// Error prefix: `guild-whiteboard-error:` (mirrors
// `parse-and-aggregate-error:` and `derive-panel-error:` conventions
// in the sibling guild verbs).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { DispatchResult, GuildCliContext } from './index.ts';

type Section = { engineer: string; section: string };
type Round = { number: number; sections: Section[] };
type State = { rounds: Round[] };
type AppendResult = {
  whiteboard_path: string;
  round: number;
  sections: Section[];
  contradictions: never[];
};

class WhiteboardError extends Error {}

function fail(reason: string): DispatchResult {
  return {
    stderr: `guild-whiteboard-error: ${reason}`,
    exitCode: 1,
  };
}

// Parse the whiteboard file into {rounds: [{number, sections}]}.
function parseState(content: string): State {
  if (!content.trim()) return { rounds: [] };

  const lines = content.split('\n');
  const rounds: Round[] = [];
  let currentRound: Round | null = null;
  let currentSection: Section | null = null;
  let buffer: string[] = [];

  const flushSection = () => {
    if (currentSection && currentRound) {
      currentSection.section = buffer
        .join('\n')
        .replace(/^\s*\n/, '')
        .replace(/\s+$/, '');
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
  const max = state.rounds.reduce(
    (acc, r) => (r.number > acc ? r.number : acc),
    0,
  );
  return max + 1;
}

function ensureParentDir(path: string): void {
  const parent = dirname(path);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
}

function initSubverb(path: string, args: string[]): DispatchResult {
  let topic: string;
  try {
    topic = parseTopic(args);
  } catch (err) {
    if (err instanceof WhiteboardError) return fail(err.message);
    throw err;
  }
  if (existsSync(path)) {
    // Idempotent: no-op if file exists.
    return { exitCode: 0 };
  }
  ensureParentDir(path);
  const header = `# Whiteboard: ${topic.trim()}\n`;
  writeFileSync(path, header, 'utf-8');
  return { exitCode: 0 };
}

function detectRoundSubverb(path: string): DispatchResult {
  let content = '';
  if (existsSync(path)) {
    try {
      content = readFileSync(path, 'utf-8');
    } catch (err) {
      return fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const next = detectNextRound(content);
  return { stdout: `${next}`, exitCode: 0 };
}

function validateAppendInput(parsed: unknown): Section[] {
  if (!Array.isArray(parsed)) {
    throw new WhiteboardError(
      'append input must be a JSON array of {engineer, section} entries',
    );
  }
  const sections: Section[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const e = parsed[i];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      throw new WhiteboardError(`entry [${i}] must be an object`);
    }
    const obj = e as Record<string, unknown>;
    if (typeof obj.engineer !== 'string' || obj.engineer.length === 0) {
      throw new WhiteboardError(
        `entry [${i}] must have a non-empty string \`engineer\` field`,
      );
    }
    if (typeof obj.section !== 'string') {
      throw new WhiteboardError(`entry [${i}] must have a string \`section\` field`);
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

function appendSubverb(path: string, stdin: string): DispatchResult {
  if (!stdin.trim()) {
    return fail('empty input on stdin; expected JSON array of {engineer, section} entries');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch (err) {
    return fail(`JSON parse error: ${(err as Error).message}`);
  }
  let sections: Section[];
  try {
    sections = validateAppendInput(parsed);
  } catch (err) {
    if (err instanceof WhiteboardError) return fail(err.message);
    throw err;
  }

  let existing = '';
  if (existsSync(path)) {
    try {
      existing = readFileSync(path, 'utf-8');
    } catch (err) {
      return fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const round = detectNextRound(existing);
  const block = formatRoundBlock(round, sections);

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
  return { stdout: JSON.stringify(result, null, 2), exitCode: 0 };
}

function readStateSubverb(path: string): DispatchResult {
  let content = '';
  if (existsSync(path)) {
    try {
      content = readFileSync(path, 'utf-8');
    } catch (err) {
      return fail(`could not read whiteboard at ${path}: ${(err as Error).message}`);
    }
  }
  const state = parseState(content);
  return { stdout: JSON.stringify(state, null, 2), exitCode: 0 };
}

function parseTopic(args: string[]): string {
  const { values } = parseArgs({
    args,
    options: { topic: { type: 'string' } },
    allowPositionals: true,
    strict: false,
  });
  if (typeof values.topic !== 'string' || values.topic.length === 0) {
    throw new WhiteboardError('init requires --topic=<string>');
  }
  return values.topic;
}

export function whiteboardVerb(
  rest: string[],
  ctx: GuildCliContext,
): DispatchResult {
  const subverb = rest[0];
  if (!subverb) {
    return fail(
      'usage: whiteboard <init|detect-round|append|read-state> <path> [args]',
    );
  }
  const pathArg = rest[1];
  if (!pathArg) {
    return fail(
      `verb \`${subverb}\` requires a whiteboard path as the first positional argument`,
    );
  }
  const path = resolve(ctx.cwd, pathArg);
  const subArgs = rest.slice(2);
  switch (subverb) {
    case 'init':
      return initSubverb(path, subArgs);
    case 'detect-round':
      return detectRoundSubverb(path);
    case 'append':
      return appendSubverb(path, ctx.stdin ?? '');
    case 'read-state':
      return readStateSubverb(path);
    default:
      return fail(
        `unknown verb \`${subverb}\` (expected one of: init, detect-round, append, read-state)`,
      );
  }
}

// Exports for unit testing of pure helpers.
export { detectNextRound, formatRoundBlock, parseState };
export type { AppendResult, Round, Section, State };
