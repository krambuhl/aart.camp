import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Session } from './types.ts';
import { LoomError } from './errors.ts';

const SESSION_FILENAME_RE = /^\d{4}-\d{2}-\d{2}-[a-z]\.json$/;

export function readSession(path: string): Session {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') {
      throw new LoomError('session-not-found', `session not found at ${path}`);
    }
    throw new LoomError(
      'session-unreadable',
      `session unreadable at ${path}: ${(err as Error).message}`,
    );
  }
  try {
    return JSON.parse(raw) as Session;
  } catch (err: unknown) {
    throw new LoomError(
      'session-invalid-json',
      `session at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
}

export type SessionSummary = {
  filename: string;
  path: string;
};

export function listSessions(projectPath: string): SessionSummary[] {
  const dir = join(projectPath, 'sessions');
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const out: SessionSummary[] = [];
  for (const entry of entries) {
    if (!SESSION_FILENAME_RE.test(entry)) continue;
    out.push({ filename: entry, path: join(dir, entry) });
  }
  return out.sort((a, b) => (a.filename < b.filename ? -1 : 1));
}

export type WriteSessionResult = {
  path: string;
  filename: string;
};

export function writeSession(
  projectPath: string,
  session: Session,
): WriteSessionResult {
  const filename = `${session.date}-${session.letter}.json`;
  const dir = join(projectPath, 'sessions');
  const target = join(dir, filename);
  if (existsSync(target)) {
    throw new LoomError(
      'session-already-exists',
      `session already exists at ${target} (sessions are immutable)`,
    );
  }
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(target, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  } catch (err: unknown) {
    throw new LoomError(
      'session-write-failed',
      `session write failed at ${target}: ${(err as Error).message}`,
    );
  }
  return { path: target, filename };
}
