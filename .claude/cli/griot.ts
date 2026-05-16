#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  type DispatchResult,
  GRIOT_VERBS,
  type GriotCliContext,
} from './verbs/griot/index.ts';

export type { DispatchResult, GriotCliContext };

// ---------- Verb registry ----------

// griot has a flat verb namespace — each verb is a standalone operation
// on the learnings substrate (rollup, session-notes, judge panels).
// Modeled on bin/draft's flat-verb shape (see .claude/cli/draft.ts);
// the rationale lives in projects/2026-05-15-draft-cli/PLAN.md and is
// reaffirmed for griot in projects/2026-05-16-substrate-cli/PLAN.md.
export const VERBS: Record<string, string> = {
  use: 'Render learnings/rollup.json as LLM prose with citation contract for session injection (--as=llm, the default)',
  capture:
    'Capture a correction (from a checkin) or an evaluator finding into a session-note folder',
  'operator-checks':
    'Helper checks (verify-rubric | log-intervention) for griot scripts; reads JSON from stdin',
  'mediate-panel':
    'Aggregate judge-panel verdicts into a consensus result; reads JSON from stdin',
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
    ([name, purpose]) => `  ${name.padEnd(18)}  ${purpose}`,
  );
  return [
    'griot — learnings-substrate CLI',
    '',
    'Usage:',
    '  griot <verb> [options]',
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
  ctx: GriotCliContext,
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
  const handler = GRIOT_VERBS[invocation.verb];
  if (handler === undefined) {
    // Reachable only if VERBS includes a name not present in
    // GRIOT_VERBS. Kept as a defensive branch so the surface stays
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
  // parseArgs is invoked here for forward compatibility with top-level
  // flags. Verb-level argument parsing lives in each verb's handler.
  parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  // Eagerly read stdin when the process is not running in a TTY. Verbs
  // that consume stdin (mediate-panel, operator-checks) read ctx.stdin;
  // verbs that don't (use, capture) ignore it. The TTY check prevents
  // the dispatcher from blocking on an interactive terminal when the
  // verb doesn't need stdin at all. EAGAIN catch handles the case
  // where stdin is non-blocking but empty (common in bash compounds
  // where a prior command consumed the parent's stdin pipe); empty
  // string is the right interpretation, and verbs that do need stdin
  // will fail their own downstream "empty input" check.
  let stdin = '';
  if (!process.stdin.isTTY) {
    try {
      stdin = readFileSync(0, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EAGAIN') throw err;
    }
  }
  const ctx: GriotCliContext = { cwd: process.cwd(), stdin };
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
