import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import type { Checkin } from './types.ts';
import { LoomError } from './errors.ts';

const CHECKIN_FILENAME_RE = /^(\d+)\.json$/;

export function readCheckin(path: string): Checkin {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') {
      throw new LoomError('checkin-not-found', `checkin not found at ${path}`);
    }
    throw new LoomError(
      'checkin-unreadable',
      `checkin unreadable at ${path}: ${(err as Error).message}`,
    );
  }
  try {
    return JSON.parse(raw) as Checkin;
  } catch (err: unknown) {
    throw new LoomError(
      'checkin-invalid-json',
      `checkin at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
}

export type CheckinSummary = {
  number: string;
  branch: string;
  path: string;
};

function scanCheckinsDir(
  dir: string,
  projectPath: string,
  out: CheckinSummary[],
): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      scanCheckinsDir(fullPath, projectPath, out);
      continue;
    }
    const match = CHECKIN_FILENAME_RE.exec(entry);
    if (match === null) continue;
    // The branch is the path from `checkins/` to the parent dir.
    const checkinsRoot = join(projectPath, 'checkins');
    const parentDir = dir;
    const branch = relative(checkinsRoot, parentDir);
    out.push({
      number: match[1] as string,
      branch,
      path: fullPath,
    });
  }
}

export type ListCheckinsOptions = {
  branch?: string;
};

export function listCheckins(
  projectPath: string,
  opts: ListCheckinsOptions = {},
): CheckinSummary[] {
  const checkinsRoot = join(projectPath, 'checkins');
  const out: CheckinSummary[] = [];
  const start = opts.branch !== undefined
    ? join(checkinsRoot, opts.branch)
    : checkinsRoot;
  scanCheckinsDir(start, projectPath, out);
  return out.sort((a, b) => {
    if (a.branch !== b.branch) return a.branch < b.branch ? -1 : 1;
    return Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10);
  });
}

export function latestCheckin(
  projectPath: string,
  opts: ListCheckinsOptions = {},
): CheckinSummary | null {
  const list = listCheckins(projectPath, opts);
  if (list.length === 0) return null;
  return list[list.length - 1] ?? null;
}

export type WriteCheckinResult = {
  path: string;
  number: string;
  branch: string;
};

export function writeCheckin(
  projectPath: string,
  checkin: Checkin,
): WriteCheckinResult {
  const branchDir = join(projectPath, 'checkins', checkin.branch);
  const target = join(branchDir, `${checkin.number}.json`);
  if (existsSync(target)) {
    throw new LoomError(
      'checkin-already-exists',
      `checkin already exists at ${target} (checkins are immutable)`,
    );
  }
  try {
    mkdirSync(branchDir, { recursive: true });
    writeFileSync(target, `${JSON.stringify(checkin, null, 2)}\n`, 'utf8');
  } catch (err: unknown) {
    throw new LoomError(
      'checkin-write-failed',
      `checkin write failed at ${target}: ${(err as Error).message}`,
    );
  }
  return { path: target, number: checkin.number, branch: checkin.branch };
}
