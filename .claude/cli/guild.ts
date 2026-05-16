#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  type DispatchResult,
  GUILD_VERBS,
  type GuildCliContext,
} from './verbs/guild/index.ts';

export type { DispatchResult, GuildCliContext };

// ---------- Verb registry ----------

// guild has a flat verb namespace — each verb is a standalone
// operation in the antagonist-panel substrate. Modeled on bin/draft's
// and bin/griot's flat-verb shape.
export const VERBS: Record<string, string> = {
  'derive-panel':
    'Compute the evaluator panel for a file list (--files=<csv> or newline-stdin)',
  findings:
    'Append or count panel findings (.guild-findings.jsonl). Subverbs: append, count',
  'parse-and-aggregate':
    'Aggregate evaluator outputs into a structured verdict (JSON stdin → JSON stdout)',
  whiteboard:
    'Compose multi-round design whiteboards. Subverbs: init, detect-round, append, read-state',
};

// ---------- Pure helpers (exported for direct unit tests) ----------

export type Invocation =
  | { kind: 'help' }
  | { kind: 'unknown'; verb: string }
  | { kind: 'verb'; verb: string; rest: string[] };

export function parseInvocation(argv: string[]): Invocation {
  if (argv.length === 0) return { kind: 'help' };
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };

  const [first, ...rest] = argv;
  if (typeof first !== 'string' || first.startsWith('-')) {
    return { kind: 'unknown', verb: first ?? '' };
  }
  if (Object.hasOwn(VERBS, first)) {
    return { kind: 'verb', verb: first, rest };
  }
  return { kind: 'unknown', verb: first };
}

export function formatHelp(): string {
  const verbLines = Object.entries(VERBS).map(
    ([name, purpose]) => `  ${name.padEnd(22)}  ${purpose}`,
  );
  return [
    'guild — antagonist-panel substrate CLI',
    '',
    'Usage:',
    '  guild <verb> [options]',
    '',
    'Verbs:',
    ...verbLines,
    '',
    'See projects/LOOM-CONVENTIONS.md for full substrate conventions.',
  ].join('\n');
}

export function formatUnknownVerbError(verb: string): string {
  const payload = {
    error: 'unknown-verb',
    message: verb ? `unknown verb: ${verb}` : 'no verb specified',
    candidates: Object.keys(VERBS),
  };
  return JSON.stringify(payload);
}

export function dispatch(
  invocation: Invocation,
  ctx: GuildCliContext,
): DispatchResult {
  if (invocation.kind === 'help') {
    return { stdout: formatHelp(), exitCode: 0 };
  }
  if (invocation.kind === 'unknown') {
    return {
      stderr: formatUnknownVerbError(invocation.verb),
      exitCode: 1,
    };
  }
  const handler = GUILD_VERBS[invocation.verb];
  if (handler === undefined) {
    // Reachable only if VERBS includes a name not present in
    // GUILD_VERBS. Kept as a defensive branch so the surface stays
    // consistent if the two registries drift.
    const payload = {
      error: 'not-implemented',
      message: `verb '${invocation.verb}' has no handler yet`,
      verb: invocation.verb,
    };
    return { stderr: JSON.stringify(payload), exitCode: 1 };
  }
  return handler(invocation.rest, ctx);
}

// ---------- Entry ----------

function main(argv: string[]): never {
  parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  // Eagerly read stdin when the process is not running in a TTY.
  // Verbs that consume stdin (parse-and-aggregate, whiteboard append)
  // read ctx.stdin; verbs that don't (findings count, derive-panel)
  // ignore it. The TTY check prevents the dispatcher from blocking
  // on an interactive terminal when the verb doesn't need stdin.
  // EAGAIN catch handles the case where stdin is non-blocking but
  // empty (common in bash compounds where a prior command consumed
  // the parent's stdin pipe); for verbs that don't need stdin, an
  // empty string is the right interpretation, and verbs that do
  // need it will fail their own downstream "empty input" check.
  let stdin = '';
  if (!process.stdin.isTTY) {
    try {
      stdin = readFileSync(0, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EAGAIN') throw err;
    }
  }
  const ctx: GuildCliContext = { cwd: process.cwd(), stdin };
  const invocation = parseInvocation(argv);
  const result = dispatch(invocation, ctx);
  if (result.stdout !== undefined) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr !== undefined) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}

function isEntryPoint(): boolean {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(arg1);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2));
}
