import { parseArgs } from 'node:util';
import { resolveProject } from '../lib/project.ts';
import { listCheckins } from '../lib/checkin.ts';
import {
  parseCheckinMarker,
  computeMarkerState,
} from '../lib/pr-marker.ts';
import { LoomError } from '../lib/errors.ts';
import { defaultGhRunner } from '../lib/gh.ts';
import type { GhRunner } from '../lib/gh.ts';
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

export const PR_VERBS = {
  discover: prDiscover,
};
