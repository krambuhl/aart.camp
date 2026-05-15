import { parseArgs } from 'node:util';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
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

const COMMENTS_OPTIONS = {
  pretty: { type: 'boolean' as const },
  pr: { type: 'string' as const },
};

type GhPrCommentsResponse = {
  headRefName: string;
  comments: Array<{ id: number; author: unknown; body: string; createdAt: string }>;
};

export function prComments(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: COMMENTS_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'pr comments requires a slug'));
  }
  if (values.pr === undefined) {
    return errToResult(
      new LoomError('missing-args', 'pr comments requires --pr'),
    );
  }
  const prNum = Number.parseInt(values.pr, 10);
  if (Number.isNaN(prNum) || prNum < 0) {
    return errToResult(
      new LoomError('invalid-pr', `--pr must be a non-negative integer: ${values.pr}`),
    );
  }
  try {
    resolveProject(slug, ctx.projectsRoot); // existence check
  } catch (err) {
    return errToResult(err);
  }
  const gh = ctx.ghRunner ?? defaultGhRunner;
  let stdout: string;
  try {
    stdout = gh(['pr', 'view', String(prNum), '--json', 'comments,headRefName']);
  } catch (err: unknown) {
    return errToResult(
      new LoomError('gh-failed', `gh pr view failed: ${(err as Error).message}`),
    );
  }
  let parsed: GhPrCommentsResponse;
  try {
    parsed = JSON.parse(stdout) as GhPrCommentsResponse;
  } catch (err: unknown) {
    return errToResult(
      new LoomError('gh-invalid-output', `gh stdout was not valid JSON: ${(err as Error).message}`),
    );
  }
  return {
    stdout: emit(
      { pr: prNum, branch: parsed.headRefName, comments: parsed.comments },
      values.pretty === true,
    ),
    exitCode: 0,
  };
}

const RESPOND_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'responses-file': { type: 'string' as const },
};

type ResponsesFile = {
  pr: number;
  branch: string;
  responses: Array<{ comment_id: number; body: string }>;
};

const RESPONSE_FILENAME_RE = /^response-(\d+)\.json$/;

function nextResponseNumber(dir: string): number {
  if (!existsSync(dir)) return 1;
  const entries = readdirSync(dir);
  let max = 0;
  for (const entry of entries) {
    const m = RESPONSE_FILENAME_RE.exec(entry);
    if (m !== null) {
      const n = Number.parseInt(m[1] as string, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export function prRespond(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: RESPOND_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(new LoomError('missing-slug', 'pr respond requires a slug'));
  }
  const responsesFile = values['responses-file'];
  if (responsesFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'pr respond requires --responses-file'),
    );
  }
  let parsed: ResponsesFile;
  try {
    parsed = JSON.parse(readFileSync(responsesFile, 'utf8')) as ResponsesFile;
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'responses-file-unreadable',
        `cannot read responses file ${responsesFile}: ${(err as Error).message}`,
      ),
    );
  }
  if (
    typeof parsed.pr !== 'number' ||
    typeof parsed.branch !== 'string' ||
    !Array.isArray(parsed.responses)
  ) {
    return errToResult(
      new LoomError(
        'invalid-responses-file',
        'responses file must have shape {pr, branch, responses[]}',
      ),
    );
  }
  let projectPath: string;
  try {
    projectPath = resolveProject(slug, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }
  const responsesDir = join(projectPath, 'checkins', parsed.branch, 'responses');
  mkdirSync(responsesDir, { recursive: true });
  let nextN = nextResponseNumber(responsesDir);
  const paths: string[] = [];
  for (const r of parsed.responses) {
    const filename = `response-${String(nextN).padStart(2, '0')}.json`;
    const target = join(responsesDir, filename);
    const written = {
      comment_id: r.comment_id,
      body: r.body,
      created: new Date().toISOString(),
    };
    writeFileSync(target, `${JSON.stringify(written, null, 2)}\n`, 'utf8');
    paths.push(target);
    nextN += 1;
  }
  return {
    stdout: emit({ paths }, values.pretty === true),
    exitCode: 0,
  };
}

export const PR_VERBS = {
  discover: prDiscover,
  open: prOpen,
  update: prUpdate,
  comments: prComments,
  respond: prRespond,
};
