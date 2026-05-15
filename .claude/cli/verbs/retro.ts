import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readRetro, listRetros } from '../lib/retro.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { RetroType } from '../lib/types.ts';

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

const RETRO_OPTIONS = {
  pretty: { type: 'boolean' as const },
  type: { type: 'string' as const },
  phase: { type: 'string' as const },
  tier: { type: 'string' as const },
};

function asRetroType(s: string | undefined): RetroType | undefined {
  if (s === 'session' || s === 'project') return s;
  return undefined;
}

export function retroList(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: RETRO_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'retro list requires a slug'));
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const list = listRetros(path, { type: asRetroType(values.type) });
    return { stdout: emit(list, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function retroRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: RETRO_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'retro read requires a slug'));
  }
  const type = asRetroType(values.type);
  if (type === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        'retro read requires --type=session|project',
      ),
    );
  }
  let filename: string;
  if (type === 'project') {
    filename = 'project.json';
  } else {
    if (values.phase === undefined || values.tier === undefined) {
      return errToResult(
        new LoomError(
          'missing-args',
          'retro read --type=session requires --phase and --tier',
        ),
      );
    }
    filename = `phase-${values.phase}-tier-${values.tier}.json`;
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const retro = readRetro(join(path, 'retros', filename));
    return { stdout: emit(retro, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const RETRO_VERBS = {
  list: retroList,
  read: retroRead,
};
