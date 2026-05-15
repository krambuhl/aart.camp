import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readEvents } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { EventName } from '../lib/types.ts';

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

const EVENTS_OPTIONS = {
  pretty: { type: 'boolean' as const },
  since: { type: 'string' as const },
  event: { type: 'string' as const },
  limit: { type: 'string' as const },
};

export function eventsRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: EVENTS_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-slug', 'events read requires a slug'),
    );
  }
  let limit: number | undefined;
  if (values.limit !== undefined) {
    const parsed = Number.parseInt(values.limit, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return errToResult(
        new LoomError('invalid-limit', `--limit must be a non-negative integer: ${values.limit}`),
      );
    }
    limit = parsed;
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const events = readEvents(join(path, 'events.jsonl'), {
      since: values.since,
      event: values.event as EventName | undefined,
      limit,
    });
    return { stdout: emit(events, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function eventsLatest(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: EVENTS_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-slug', 'events latest requires a slug'),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const events = readEvents(join(path, 'events.jsonl'), {
      event: values.event as EventName | undefined,
    });
    if (events.length === 0) {
      return errToResult(
        new LoomError('no-events', 'no events match the filter'),
      );
    }
    const latest = events[events.length - 1];
    return { stdout: emit(latest, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const EVENTS_VERBS = {
  read: eventsRead,
  latest: eventsLatest,
};
