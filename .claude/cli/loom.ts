#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

// ---------- Namespace registry ----------

export const NAMESPACES: Record<string, string> = {
  project: 'Manage projects: scaffold, read, list, status, archive',
  phase: 'Read and update phase state',
  events: 'Read the project event log',
  checkin: 'Write and read unit-of-work checkins',
  session: 'Write and read session handoffs',
  pr: 'Open, update, and respond to GitHub PRs',
  retro: 'Write and read retrospectives',
  doctor: 'Project health check',
};

// ---------- Pure helpers (exported for direct unit tests) ----------

export type Invocation =
  | { kind: 'help' }
  | { kind: 'unknown'; verb: string }
  | { kind: 'verb'; namespace: string; rest: string[] };

export function parseInvocation(argv: string[]): Invocation {
  // Look for --help anywhere in argv first
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
    message: verb
      ? `unknown verb: ${verb}`
      : 'no verb specified',
    candidates: Object.keys(NAMESPACES),
  };
  return JSON.stringify(payload);
}

export type DispatchResult = {
  stdout?: string;
  stderr?: string;
  exitCode: number;
};

export function dispatch(invocation: Invocation): DispatchResult {
  if (invocation.kind === 'help') {
    return { stdout: formatHelp(), exitCode: 0 };
  }
  if (invocation.kind === 'unknown') {
    return {
      stderr: formatUnknownVerbError(invocation.verb),
      exitCode: 1,
    };
  }
  // Namespace recognized but no verbs implemented yet (Phase 2 unit 02+).
  // Print a placeholder error pointing at the future surface.
  const payload = {
    error: 'not-implemented',
    message: `namespace '${invocation.namespace}' has no verbs yet (Phase 2 in progress)`,
    namespace: invocation.namespace,
  };
  return { stderr: JSON.stringify(payload), exitCode: 1 };
}

// ---------- Entry ----------

function main(argv: string[]): never {
  // parseArgs is invoked here for forward compatibility with `--pretty`
  // and namespace-level flags landing in later units. Phase 2 unit 01
  // only honors top-level flags; verb-level argument parsing lives in
  // each verb's handler.
  parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      pretty: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });

  const invocation = parseInvocation(argv);
  const result = dispatch(invocation);
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
