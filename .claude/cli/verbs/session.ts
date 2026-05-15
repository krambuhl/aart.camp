import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readSession, listSessions, writeSession } from '../lib/session.ts';
import { readCheckin, listCheckins } from '../lib/checkin.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { Session } from '../lib/types.ts';

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

const SESSION_OPTIONS = {
  pretty: { type: 'boolean' as const },
  filename: { type: 'string' as const },
  'since-checkin': { type: 'string' as const },
};

export function sessionList(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: SESSION_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'session list requires a slug'));
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    return { stdout: emit(listSessions(path), values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function sessionRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: SESSION_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'session read requires a slug'));
  }
  if (values.filename === undefined) {
    return errToResult(
      new LoomError('missing-args', 'session read requires --filename'),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const session = readSession(join(path, 'sessions', values.filename));
    return { stdout: emit(session, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export type CorrectionEntry = {
  text: string;
  checkin: string;
  branch: string;
};

export function sessionCorrections(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: SESSION_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'session corrections requires a slug'));
  }
  const sinceCheckin = values['since-checkin'];
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const checkins = listCheckins(path);
    const corrections: CorrectionEntry[] = [];
    for (const summary of checkins) {
      if (sinceCheckin !== undefined && summary.number < sinceCheckin) continue;
      const c = readCheckin(summary.path);
      for (const text of c.execution.corrections ?? []) {
        corrections.push({
          text,
          checkin: summary.number,
          branch: summary.branch,
        });
      }
    }
    return { stdout: emit(corrections, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

const WRITE_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'session-file': { type: 'string' as const },
};

export function sessionWrite(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: WRITE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'session write requires a slug'));
  }
  const sessionFile = values['session-file'];
  if (sessionFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'session write requires --session-file'),
    );
  }
  let raw: string;
  try {
    raw = readFileSync(sessionFile, 'utf8');
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'session-file-unreadable',
        `cannot read session file ${sessionFile}: ${(err as Error).message}`,
      ),
    );
  }
  let parsed: Session;
  try {
    parsed = JSON.parse(raw) as Session;
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'invalid-session',
        `session file is not valid JSON: ${(err as Error).message}`,
      ),
    );
  }
  if (parsed.schema_version !== 1 || typeof parsed.date !== 'string' || typeof parsed.letter !== 'string') {
    return errToResult(
      new LoomError(
        'invalid-session',
        'session file is missing required fields (schema_version, date, letter)',
      ),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const written = writeSession(path, parsed);
    appendEvent(join(path, 'events.jsonl'), {
      at: new Date().toISOString(),
      event: 'session-saved',
      detail: { filename: written.filename },
    });
    return { stdout: emit(written, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const SESSION_VERBS = {
  list: sessionList,
  read: sessionRead,
  corrections: sessionCorrections,
  write: sessionWrite,
};
