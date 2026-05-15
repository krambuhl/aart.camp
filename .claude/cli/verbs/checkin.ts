import { parseArgs } from 'node:util';
import { resolveProject } from '../lib/project.ts';
import {
  readCheckin,
  listCheckins,
  latestCheckin,
} from '../lib/checkin.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';

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

export const CHECKIN_VERBS = {
  list: checkinList,
  read: checkinRead,
  latest: checkinLatest,
};
