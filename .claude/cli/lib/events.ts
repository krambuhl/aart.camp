import { readFileSync, appendFileSync } from 'node:fs';
import type { Event, EventName } from './types.ts';
import { LoomError } from './errors.ts';

export type ReadEventsOptions = {
  since?: string;
  event?: EventName;
  limit?: number;
};

export function readEvents(path: string, opts: ReadEventsOptions = {}): Event[] {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') {
      throw new LoomError('events-not-found', `events.jsonl not found at ${path}`);
    }
    throw new LoomError(
      'events-unreadable',
      `events.jsonl unreadable at ${path}: ${(err as Error).message}`,
    );
  }

  const lines = raw.split('\n').filter((line) => line.length > 0);
  const events: Event[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    let parsed: Event;
    try {
      parsed = JSON.parse(line) as Event;
    } catch (err: unknown) {
      throw new LoomError(
        'events-invalid-line',
        `events.jsonl line ${i + 1} is not valid JSON: ${(err as Error).message}`,
      );
    }
    events.push(parsed);
  }

  const filtered = events.filter((e) => {
    if (opts.event !== undefined && e.event !== opts.event) return false;
    if (opts.since !== undefined && e.at < opts.since) return false;
    return true;
  });

  if (opts.limit !== undefined && opts.limit >= 0) {
    return filtered.slice(0, opts.limit);
  }
  return filtered;
}

export function appendEvent(path: string, event: Event): void {
  try {
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
  } catch (err: unknown) {
    throw new LoomError(
      'events-write-failed',
      `events append failed at ${path}: ${(err as Error).message}`,
    );
  }
}
