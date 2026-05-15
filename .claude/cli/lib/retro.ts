import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Retro, RetroType } from './types.ts';
import { LoomError } from './errors.ts';

export function readRetro(path: string): Retro {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') {
      throw new LoomError('retro-not-found', `retro not found at ${path}`);
    }
    throw new LoomError(
      'retro-unreadable',
      `retro unreadable at ${path}: ${(err as Error).message}`,
    );
  }
  try {
    return JSON.parse(raw) as Retro;
  } catch (err: unknown) {
    throw new LoomError(
      'retro-invalid-json',
      `retro at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }
}

export type RetroSummary = {
  filename: string;
  path: string;
  type: RetroType;
};

export type ListRetrosOptions = {
  type?: RetroType;
};

export function listRetros(
  projectPath: string,
  opts: ListRetrosOptions = {},
): RetroSummary[] {
  const dir = join(projectPath, 'retros');
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const out: RetroSummary[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const path = join(dir, entry);
    let retro: Retro;
    try {
      retro = readRetro(path);
    } catch {
      // Skip unreadable files; doctor would surface these separately.
      continue;
    }
    if (opts.type !== undefined && retro.type !== opts.type) continue;
    out.push({ filename: entry, path, type: retro.type });
  }
  return out.sort((a, b) => (a.filename < b.filename ? -1 : 1));
}

export type WriteRetroResult = {
  path: string;
  filename: string;
};

export function retroFilename(retro: Retro): string {
  if (retro.type === 'project') return 'project.json';
  return `phase-${retro.phase}-tier-${retro.tier}.json`;
}

export function writeRetro(
  projectPath: string,
  retro: Retro,
): WriteRetroResult {
  const filename = retroFilename(retro);
  const dir = join(projectPath, 'retros');
  const target = join(dir, filename);
  if (existsSync(target)) {
    throw new LoomError(
      'retro-already-exists',
      `retro already exists at ${target} (retros are immutable)`,
    );
  }
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(target, `${JSON.stringify(retro, null, 2)}\n`, 'utf8');
  } catch (err: unknown) {
    throw new LoomError(
      'retro-write-failed',
      `retro write failed at ${target}: ${(err as Error).message}`,
    );
  }
  return { path: target, filename };
}
