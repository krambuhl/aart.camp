import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readManifest } from '../lib/manifest.ts';
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

export function phaseRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: { pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  const phaseArg = positionals[1];
  if (slug === undefined || phaseArg === undefined) {
    return errToResult(
      new LoomError('missing-args', 'phase read requires <slug> <N>'),
    );
  }
  const phaseNum = Number.parseInt(phaseArg, 10);
  if (Number.isNaN(phaseNum) || String(phaseNum) !== phaseArg) {
    return errToResult(
      new LoomError(
        'invalid-phase',
        `phase number must be an integer: ${phaseArg}`,
      ),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const manifest = readManifest(join(path, 'manifest.json'));
    const phase = manifest.phases.find((p) => p.number === phaseNum);
    if (phase === undefined) {
      return errToResult(
        new LoomError(
          'phase-not-found',
          `phase ${phaseNum} not in project ${slug}`,
        ),
      );
    }
    return { stdout: emit(phase, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function phaseList(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: { pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-slug', 'phase list requires a slug'),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const manifest = readManifest(join(path, 'manifest.json'));
    return { stdout: emit(manifest.phases, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const PHASE_VERBS = {
  read: phaseRead,
  list: phaseList,
};
