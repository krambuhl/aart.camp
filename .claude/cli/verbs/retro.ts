import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readRetro, listRetros, writeRetro } from '../lib/retro.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { Retro, RetroType } from '../lib/types.ts';

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

const WRITE_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'retro-file': { type: 'string' as const },
};

export function retroWrite(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: WRITE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'retro write requires a slug'));
  }
  const retroFile = values['retro-file'];
  if (retroFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'retro write requires --retro-file'),
    );
  }
  let raw: string;
  try {
    raw = readFileSync(retroFile, 'utf8');
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'retro-file-unreadable',
        `cannot read retro file ${retroFile}: ${(err as Error).message}`,
      ),
    );
  }
  let parsed: Retro;
  try {
    parsed = JSON.parse(raw) as Retro;
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'invalid-retro',
        `retro file is not valid JSON: ${(err as Error).message}`,
      ),
    );
  }
  if (parsed.schema_version !== 1 || (parsed.type !== 'session' && parsed.type !== 'project')) {
    return errToResult(
      new LoomError(
        'invalid-retro',
        'retro file is missing required fields (schema_version, type)',
      ),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const written = writeRetro(path, parsed);
    const detail: { type: RetroType; phase?: number; tier?: number } = { type: parsed.type };
    if (parsed.type === 'session') {
      detail.phase = parsed.phase;
      detail.tier = parsed.tier;
    }
    appendEvent(join(path, 'events.jsonl'), {
      at: new Date().toISOString(),
      event: 'retro-written',
      detail,
    });
    return { stdout: emit(written, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const RETRO_VERBS = {
  list: retroList,
  read: retroRead,
  write: retroWrite,
};
