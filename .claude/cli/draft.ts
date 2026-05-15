#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { DRAFT_VERBS } from './verbs/draft.ts';
import type { DraftCliContext, DispatchResult } from './verbs/draft.ts';

export type { DraftCliContext, DispatchResult };

// ---------- Verb registry ----------

// draft has a flat verb namespace (three verbs, all acting on PLAN.md).
// See projects/2026-05-15-draft-cli/PLAN.md § Decisions for the
// flat-vs-namespaced rationale.
export const VERBS: Record<string, string> = {
  plan: 'Create a new plan (writes PLAN.md and INTERVIEW.md)',
  revise: 'Replace PLAN.md with a revision and append to ## Revision log',
  read: "Read a project's PLAN.md as JSON (or --pretty for human view)",
};

// ---------- Pure helpers (exported for direct unit tests) ----------

export type Invocation =
  | { kind: 'help' }
  | { kind: 'unknown'; verb: string }
  | { kind: 'verb'; verb: string; rest: string[] };

export function parseInvocation(argv: string[]): Invocation {
  // Look for --help anywhere in argv first.
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
    ([name, purpose]) => `  ${name.padEnd(8)}  ${purpose}`,
  );
  return [
    'draft — grill-me-shaped planning CLI',
    '',
    'Usage:',
    '  draft <verb> [options]',
    '',
    'Verbs:',
    ...verbLines,
    '',
    'Output is JSON by default. Pass --pretty on read verbs for human view.',
    'Errors emit a structured JSON object on stderr and exit non-zero.',
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
  ctx: DraftCliContext,
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
  const handler = DRAFT_VERBS[invocation.verb];
  if (handler === undefined) {
    // Reachable only if VERBS includes a name not present in
    // DRAFT_VERBS. Kept as a defensive branch so the surface stays
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

function deriveProjectsRoot(): string {
  return process.env.DRAFT_PROJECTS_ROOT ?? join(process.cwd(), 'projects');
}

function main(argv: string[]): never {
  // parseArgs is invoked here for forward compatibility with top-level
  // flags. Verb-level argument parsing lives in each verb's handler.
  parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      pretty: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });

  const ctx: DraftCliContext = { projectsRoot: deriveProjectsRoot() };
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
