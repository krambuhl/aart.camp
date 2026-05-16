#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_VERBS } from './verbs/project.ts';
import { PHASE_VERBS } from './verbs/phase.ts';
import { EVENTS_VERBS } from './verbs/events.ts';
import { CHECKIN_VERBS } from './verbs/checkin.ts';
import { SESSION_VERBS } from './verbs/session.ts';
import { RETRO_VERBS } from './verbs/retro.ts';
import { DOCTOR_VERBS } from './verbs/doctor.ts';
import { PR_VERBS } from './verbs/pr.ts';
import type { CliContext, DispatchResult } from './verbs/project.ts';

export type { CliContext, DispatchResult };

// ---------- Namespace registry ----------

export const NAMESPACES: Record<string, string> = {
  project: 'Manage projects: scaffold, adopt, read, list, status, archive',
  phase: 'Read and update phase state',
  events: 'Read the project event log',
  checkin: 'Write and read unit-of-work checkins',
  session: 'Write and read session handoffs',
  pr: 'Open, update, and respond to GitHub PRs',
  retro: 'Write and read retrospectives',
  doctor: 'Project health check',
};

// Namespaces with wired-up verb handlers as of this unit. Recognized
// namespaces NOT in this map return the `not-implemented` placeholder
// (`pr` is the only one as of Phase 2 close).
type VerbHandler = (rest: string[], ctx: CliContext) => DispatchResult;
const VERBS_BY_NAMESPACE: Record<string, Record<string, VerbHandler>> = {
  project: PROJECT_VERBS,
  phase: PHASE_VERBS,
  events: EVENTS_VERBS,
  checkin: CHECKIN_VERBS,
  session: SESSION_VERBS,
  retro: RETRO_VERBS,
  pr: PR_VERBS,
  doctor: DOCTOR_VERBS,
};

// Verbless namespaces are single-handler namespaces (per
// LOOM-CONVENTIONS.md: `loom doctor [<slug>]`). The first
// verb-position argument is treated as the first handler arg.
const VERBLESS_NAMESPACES: ReadonlySet<string> = new Set(['doctor']);

// ---------- Pure helpers (exported for direct unit tests) ----------

export type Invocation =
  | { kind: 'help' }
  | { kind: 'unknown'; verb: string }
  | { kind: 'verb'; namespace: string; rest: string[] };

export function parseInvocation(argv: string[]): Invocation {
  if (argv.length === 0) return { kind: 'help' };
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };

  const [first, ...rest] = argv;
  if (typeof first !== 'string' || first.startsWith('-')) {
    return { kind: 'unknown', verb: first ?? '' };
  }
  if (Object.hasOwn(NAMESPACES, first)) {
    return { kind: 'verb', namespace: first, rest };
  }
  return { kind: 'unknown', verb: first };
}

export function formatHelp(): string {
  const namespaceLines = Object.entries(NAMESPACES).map(
    ([name, purpose]) => `  ${name.padEnd(8)}  ${purpose}`,
  );
  return [
    'loom — project-substrate CLI',
    '',
    'Usage:',
    '  loom <namespace> <verb> [options]',
    '',
    'Namespaces:',
    ...namespaceLines,
    '',
    'Output is JSON by default. Pass --pretty on read verbs for human view.',
    'Errors emit a structured JSON object on stderr and exit non-zero.',
    'See projects/LOOM-CONVENTIONS.md for full conventions.',
  ].join('\n');
}

export function formatUnknownVerbError(verb: string): string {
  const payload = {
    error: 'unknown-verb',
    message: verb ? `unknown verb: ${verb}` : 'no verb specified',
    candidates: Object.keys(NAMESPACES),
  };
  return JSON.stringify(payload);
}

export function dispatch(invocation: Invocation, ctx: CliContext): DispatchResult {
  if (invocation.kind === 'help') {
    return { stdout: formatHelp(), exitCode: 0 };
  }
  if (invocation.kind === 'unknown') {
    return {
      stderr: formatUnknownVerbError(invocation.verb),
      exitCode: 1,
    };
  }
  const verbs = VERBS_BY_NAMESPACE[invocation.namespace];
  if (verbs === undefined) {
    // Namespace recognized but no verbs wired up yet (units after 03).
    const payload = {
      error: 'not-implemented',
      message: `namespace '${invocation.namespace}' has no verbs yet`,
      namespace: invocation.namespace,
    };
    return { stderr: JSON.stringify(payload), exitCode: 1 };
  }
  // Verbless namespace: the namespace IS the only verb. Route the
  // entire rest as args to that single handler.
  if (VERBLESS_NAMESPACES.has(invocation.namespace)) {
    const handler = verbs[invocation.namespace];
    if (handler !== undefined) {
      return handler(invocation.rest, ctx);
    }
  }
  const verbName = invocation.rest[0];
  if (verbName === undefined) {
    const payload = {
      error: 'missing-verb',
      message: `${invocation.namespace} requires a verb`,
      candidates: Object.keys(verbs),
    };
    return { stderr: JSON.stringify(payload), exitCode: 1 };
  }
  const handler = verbs[verbName];
  if (handler === undefined) {
    const payload = {
      error: 'unknown-verb',
      message: `unknown verb: ${invocation.namespace} ${verbName}`,
      candidates: Object.keys(verbs),
    };
    return { stderr: JSON.stringify(payload), exitCode: 1 };
  }
  return handler(invocation.rest.slice(1), ctx);
}

// ---------- Entry ----------

function deriveProjectsRoot(): string {
  return process.env.LOOM_PROJECTS_ROOT ?? join(process.cwd(), 'projects');
}

function main(argv: string[]): never {
  // parseArgs is called for forward compatibility with top-level flags.
  // Verb-level argument parsing lives in each handler.
  parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      pretty: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });

  const ctx: CliContext = { projectsRoot: deriveProjectsRoot() };
  const invocation = parseInvocation(argv);
  const result = dispatch(invocation, ctx);
  if (result.stdout !== undefined) process.stdout.write(result.stdout + '\n');
  if (result.stderr !== undefined) process.stderr.write(result.stderr + '\n');
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
