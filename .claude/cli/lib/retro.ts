import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
