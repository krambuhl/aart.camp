import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { readManifest, writeManifest } from '../lib/manifest.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';
import type { Event, ManifestPhase, PhaseStatus } from '../lib/types.ts';

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

function eventForTransition(
  prior: PhaseStatus,
  next: PhaseStatus,
  phaseNum: number,
  name: string,
  reason: string | undefined,
): Event | null {
  const now = new Date().toISOString();
  if (next === 'in-progress' && prior === 'blocked') {
    return { at: now, event: 'phase-unblocked', detail: { phase: phaseNum } };
  }
  if (next === 'in-progress') {
    return {
      at: now,
      event: 'phase-started',
      detail: { phase: phaseNum, name },
    };
  }
  if (next === 'completed') {
    return { at: now, event: 'phase-completed', detail: { phase: phaseNum } };
  }
  if (next === 'blocked') {
    return {
      at: now,
      event: 'phase-blocked',
      detail: { phase: phaseNum, reason: reason ?? '' },
    };
  }
  return null;
}

const PHASE_STATUSES: ReadonlySet<PhaseStatus> = new Set([
  'not-started',
  'in-progress',
  'blocked',
  'completed',
]);

const PR_STATES: ReadonlySet<string> = new Set(['open', 'merged', 'closed']);

export function phaseUpdate(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      pretty: { type: 'boolean' },
      status: { type: 'string' },
      branch: { type: 'string' },
      pr: { type: 'string' },
      url: { type: 'string' },
      'pr-state': { type: 'string' },
      reason: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  const phaseArg = positionals[1];
  if (slug === undefined || phaseArg === undefined) {
    return errToResult(
      new LoomError('missing-args', 'phase update requires <slug> <N>'),
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
  const status = values.status;
  if (status === undefined || !PHASE_STATUSES.has(status as PhaseStatus)) {
    return errToResult(
      new LoomError(
        'missing-args',
        'phase update requires --status=(not-started|in-progress|blocked|completed)',
      ),
    );
  }
  if (status === 'blocked' && values.reason === undefined) {
    return errToResult(
      new LoomError('missing-args', 'status=blocked requires --reason'),
    );
  }
  let prNum: number | undefined;
  if (values.pr !== undefined) {
    const parsed = Number.parseInt(values.pr, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return errToResult(
        new LoomError('invalid-pr', `--pr must be a non-negative integer: ${values.pr}`),
      );
    }
    prNum = parsed;
  }
  const prUrl = values.url;
  const prStateArg = values['pr-state'];
  if (prStateArg !== undefined && !PR_STATES.has(prStateArg)) {
    return errToResult(
      new LoomError(
        'invalid-pr-state',
        `--pr-state must be one of: open | merged | closed (got: ${prStateArg})`,
      ),
    );
  }
  if ((prUrl !== undefined || prStateArg !== undefined) && prNum === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        '--url and --pr-state require --pr to identify the PR being updated',
      ),
    );
  }

  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const manifestPath = join(path, 'manifest.json');
    const manifest = readManifest(manifestPath);
    const phase = manifest.phases.find((p) => p.number === phaseNum);
    if (phase === undefined) {
      return errToResult(
        new LoomError(
          'phase-not-found',
          `phase ${phaseNum} not in project ${slug}`,
        ),
      );
    }
    const prior = phase.status;
    const updated: ManifestPhase = { ...phase, status: status as PhaseStatus };
    if (values.branch !== undefined) updated.branch = values.branch;
    if (status === 'blocked') updated.blocked_reason = values.reason;
    if (prNum !== undefined) {
      // URL defaults to a placeholder when --url isn't passed; the
      // placeholder is recognizable so callers know to set the real
      // value. Once a URL is set, --url is required to change it
      // (the verb is monotonic by default).
      const placeholderUrl = `https://github.com/example/example/pull/${prNum}`;
      updated.pr = {
        number: prNum,
        url: prUrl ?? phase.pr?.url ?? placeholderUrl,
        state: (prStateArg ?? phase.pr?.state ?? 'open') as 'open' | 'merged' | 'closed',
      };
    }
    manifest.phases = manifest.phases.map((p) =>
      p.number === phaseNum ? updated : p,
    );
    writeManifest(manifestPath, manifest);
    const event = eventForTransition(
      prior,
      status as PhaseStatus,
      phaseNum,
      phase.name,
      values.reason,
    );
    if (event !== null) {
      appendEvent(join(path, 'events.jsonl'), event);
    }
    return { stdout: emit(updated, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const PHASE_VERBS = {
  read: phaseRead,
  list: phaseList,
  update: phaseUpdate,
};
