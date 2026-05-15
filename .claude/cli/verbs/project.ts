import { parseArgs } from 'node:util';
import { join, sep } from 'node:path';
import { resolveProject, listProjects } from '../lib/project.ts';
import { readManifest } from '../lib/manifest.ts';
import { LoomError } from '../lib/errors.ts';
import type { Manifest } from '../lib/types.ts';

// Shared CLI context. Tests inject `projectsRoot` directly and may
// override `cwdOverride` to simulate `process.cwd()` for `status`.
export type CliContext = {
  projectsRoot: string;
  cwdOverride?: string;
};

export type DispatchResult = {
  stdout?: string;
  stderr?: string;
  exitCode: number;
};

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

export function projectRead(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: { pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-slug', 'project read requires a slug'),
    );
  }
  try {
    const path = resolveProject(slug, ctx.projectsRoot);
    const manifest = readManifest(join(path, 'manifest.json'));
    return { stdout: emit(manifest, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export function projectList(rest: string[], ctx: CliContext): DispatchResult {
  const { values } = parseArgs({
    args: rest,
    options: {
      pretty: { type: 'boolean' },
      archived: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });
  const list = listProjects(ctx.projectsRoot, {
    archived: values.archived === true,
  });
  return { stdout: emit(list, values.pretty === true), exitCode: 0 };
}

export function projectStatus(rest: string[], ctx: CliContext): DispatchResult {
  const { values } = parseArgs({
    args: rest,
    options: { pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  const cwd = ctx.cwdOverride ?? process.cwd();
  const active = listProjects(ctx.projectsRoot);
  const archived = listProjects(ctx.projectsRoot, { archived: true });
  const all = [...active, ...archived];
  const match = all.find(
    (p) => cwd === p.path || cwd.startsWith(p.path + sep),
  );
  if (match === undefined) {
    return errToResult(
      new LoomError('not-in-project', `cwd ${cwd} is not inside a project directory`),
    );
  }
  try {
    const manifest = readManifest(join(match.path, 'manifest.json'));
    const summary = {
      slug: match.slug,
      status: manifest.status,
      current_branch: manifest.current_branch,
      latest_checkin: manifest.latest_checkin,
      title: manifest.title,
    };
    return { stdout: emit(summary, values.pretty === true), exitCode: 0 };
  } catch (err) {
    return errToResult(err);
  }
}

export const PROJECT_VERBS = {
  read: projectRead,
  list: projectList,
  ls: projectList,
  status: projectStatus,
};
