import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import {
  readCheckin,
  listCheckins,
  latestCheckin,
  writeCheckin,
} from '../lib/checkin.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { Checkin } from '../lib/types.ts';

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

const CHECKIN_OPTIONS = {
  pretty: { type: 'boolean' as const },
  branch: { type: 'string' as const },
  number: { type: 'string' as const },
};

export function checkinList(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: CHECKIN_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'checkin list requires a slug'));
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const list = listCheckins(path, { branch: values.branch });
    return { stdout: emit(list, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function checkinRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: CHECKIN_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'checkin read requires a slug'));
  }
  if (values.branch === undefined || values.number === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        'checkin read requires --branch and --number',
      ),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const filePath = `${path}/checkins/${values.branch}/${values.number}.json`;
    const checkin = readCheckin(filePath);
    return { stdout: emit(checkin, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function checkinLatest(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: CHECKIN_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'checkin latest requires a slug'));
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const latest = latestCheckin(path, { branch: values.branch });
    if (latest === null) {
      return errToResult(
        new LoomError('no-checkins', 'no checkins for the given filter'),
      );
    }
    const checkin = readCheckin(latest.path);
    return { stdout: emit(checkin, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

const WRITE_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'checkin-file': { type: 'string' as const },
};

export function checkinWrite(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: WRITE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'checkin write requires a slug'));
  }
  const checkinFile = values['checkin-file'];
  if (checkinFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'checkin write requires --checkin-file'),
    );
  }
  let raw: string;
  try {
    raw = readFileSync(checkinFile, 'utf8');
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'checkin-file-unreadable',
        `cannot read checkin file ${checkinFile}: ${(err as Error).message}`,
      ),
    );
  }
  let parsed: Checkin;
  try {
    parsed = JSON.parse(raw) as Checkin;
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'invalid-checkin',
        `checkin file is not valid JSON: ${(err as Error).message}`,
      ),
    );
  }
  if (parsed.schema_version !== 1 || typeof parsed.number !== 'string' || typeof parsed.branch !== 'string') {
    return errToResult(
      new LoomError(
        'invalid-checkin',
        'checkin file is missing required fields (schema_version, number, branch)',
      ),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const written = writeCheckin(path, parsed);
    appendEvent(join(path, 'events.jsonl'), {
      at: new Date().toISOString(),
      event: 'checkin-created',
      detail: { number: written.number, branch: written.branch },
    });
    return { stdout: emit(written, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const CHECKIN_VERBS = {
  list: checkinList,
  read: checkinRead,
  latest: checkinLatest,
  write: checkinWrite,
};
