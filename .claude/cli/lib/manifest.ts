import { readFileSync, writeFileSync } from 'node:fs';
import type { Manifest } from './types.ts';
import { LoomError } from './errors.ts';

export function readManifest(path: string): Manifest {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ENOENT') {
      throw new LoomError('manifest-not-found', `manifest not found at ${path}`);
    }
    throw new LoomError(
      'manifest-unreadable',
      `manifest unreadable at ${path}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    throw new LoomError(
      'manifest-invalid-json',
      `manifest at ${path} is not valid JSON: ${(err as Error).message}`,
    );
  }

  return parsed as Manifest;
}

export function writeManifest(path: string, manifest: Manifest): void {
  try {
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } catch (err: unknown) {
    throw new LoomError(
      'manifest-write-failed',
      `manifest write failed at ${path}: ${(err as Error).message}`,
    );
  }
}
