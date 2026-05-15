import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { resolveProject } from '../lib/project.ts';
import { listCheckins } from '../lib/checkin.ts';
import {
  parseCheckinMarker,
  computeMarkerState,
} from '../lib/pr-marker.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import { defaultGhRunner } from '../lib/gh.ts';
import type { GhRunner } from '../lib/gh.ts';
import type { CliContext, DispatchResult } from './project.ts';

const PR_URL_RE = /https:\/\/[^\s]*\/pull\/(\d+)/;

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

const DISCOVER_OPTIONS = {
  pretty: { type: 'boolean' as const },
  branch: { type: 'string' as const },
};

type PrViewResponse = {
  number: number;
  url: string;
  body: string;
};

function fetchPrForBranch(
  ghRunner: GhRunner,
  branch: string,
): PrViewResponse | null {
  // gh pr view --head <branch> exits non-zero if no PR exists for that
  // head. We treat that as "no PR" and return null.
  try {
    const stdout = ghRunner([
      'pr',
      'view',
      '--head',
      branch,
      '--json',
      'number,url,body',
    ]);
    return JSON.parse(stdout) as PrViewResponse;
  } catch {
    return null;
  }
}

export function prDiscover(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: DISCOVER_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'pr discover requires a slug'));
  }
  if (values.branch === undefined) {
    return errToResult(
      new LoomError('missing-args', 'pr discover requires --branch'),
    );
  }
  try {
    const projectPath = resolveProject(slug, ctx.projectsRoot);
    const diskCheckins = listCheckins(projectPath, { branch: values.branch });
    const diskNumbers = diskCheckins
      .map((c) => Number.parseInt(c.number, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    const gh = ctx.ghRunner ?? defaultGhRunner;
    const pr = fetchPrForBranch(gh, values.branch);
    const marker = pr === null ? null : parseCheckinMarker(pr.body);
    const state = computeMarkerState(diskNumbers, marker);

    const result = {
      checkins: diskNumbers,
      marker_state: state,
      pr: pr === null ? null : { number: pr.number, url: pr.url },
    };
    return { stdout: emit(result, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

const OPEN_OPTIONS = {
  pretty: { type: 'boolean' as const },
  title: { type: 'string' as const },
  'body-file': { type: 'string' as const },
  branch: { type: 'string' as const },
};

export function prOpen(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: OPEN_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'pr open requires a slug'));
  }
  if (values.title === undefined || values['body-file'] === undefined) {
    return errToResult(
      new LoomError('missing-args', 'pr open requires --title and --body-file'),
    );
  }
  let projectPath: string;
  try {
    projectPath = resolveProject(slug, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }
  const gh = ctx.ghRunner ?? defaultGhRunner;
  const ghArgs = ['pr', 'create', '--title', values.title, '--body-file', values['body-file']];
  if (values.branch !== undefined) {
    ghArgs.push('--head', values.branch);
  }
  let stdout: string;
  try {
    stdout = gh(ghArgs);
  } catch (err: unknown) {
    return errToResult(
      new LoomError('gh-failed', `gh pr create failed: ${(err as Error).message}`),
    );
  }
  const match = PR_URL_RE.exec(stdout);
  if (match === null) {
    return errToResult(
      new LoomError(
        'invalid-pr-url',
        `gh pr create did not return a parseable PR URL: ${stdout.trim()}`,
      ),
    );
  }
  const prNum = Number.parseInt(match[1] as string, 10);
  const url = match[0] as string;
  appendEvent(join(projectPath, 'events.jsonl'), {
    at: new Date().toISOString(),
    event: 'pr-opened',
    detail: { pr: prNum, url },
  });
  return {
    stdout: emit({ pr: prNum, url }, values.pretty === true),
    exitCode: 0,
  };
}

const UPDATE_OPTIONS = {
  pretty: { type: 'boolean' as const },
  pr: { type: 'string' as const },
  'body-file': { type: 'string' as const },
};

export function prUpdate(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: UPDATE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'pr update requires a slug'));
  }
  if (values.pr === undefined || values['body-file'] === undefined) {
    return errToResult(
      new LoomError('missing-args', 'pr update requires --pr and --body-file'),
    );
  }
  const prNum = Number.parseInt(values.pr, 10);
  if (Number.isNaN(prNum) || prNum < 0) {
    return errToResult(
      new LoomError('invalid-pr', `--pr must be a non-negative integer: ${values.pr}`),
    );
  }
  let projectPath: string;
  try {
    projectPath = resolveProject(slug, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }
  const gh = ctx.ghRunner ?? defaultGhRunner;
  try {
    gh(['pr', 'edit', String(prNum), '--body-file', values['body-file']]);
  } catch (err: unknown) {
    return errToResult(
      new LoomError('gh-failed', `gh pr edit failed: ${(err as Error).message}`),
    );
  }
  appendEvent(join(projectPath, 'events.jsonl'), {
    at: new Date().toISOString(),
    event: 'pr-updated',
    detail: { pr: prNum },
  });
  return {
    stdout: emit({ pr: prNum }, values.pretty === true),
    exitCode: 0,
  };
}

export const PR_VERBS = {
  discover: prDiscover,
  open: prOpen,
  update: prUpdate,
};
