import { parseArgs } from 'node:util';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { join, sep } from 'node:path';
import {
  resolveProject,
  listProjects,
  ARCHIVE_DIRNAME,
} from '../lib/project.ts';
import { readManifest, writeManifest } from '../lib/manifest.ts';
import { readConfig } from '../lib/config.ts';
import { appendEvent } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import { writeLoomSubstrate, type ManifestInit } from '../lib/adopt.ts';
import type { Manifest } from '../lib/types.ts';

// Shared CLI context. Tests inject `projectsRoot` directly and may
// override `cwdOverride` to simulate `process.cwd()` for `status`,
// or `ghRunner` to stub the `gh` CLI in pr verbs.
import type { GhRunner } from '../lib/gh.ts';
export type CliContext = {
  projectsRoot: string;
  cwdOverride?: string;
  ghRunner?: GhRunner;
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

const FULL_SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DATELESS_SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function todayString(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeSlug(input: string): string {
  if (FULL_SLUG_RE.test(input)) return input;
  if (DATELESS_SLUG_RE.test(input)) return `${todayString()}-${input}`;
  throw new LoomError(
    'invalid-slug',
    `slug '${input}' must be kebab-case (lowercase letters, digits, hyphens) and may optionally start with a YYYY-MM-DD date prefix`,
  );
}

const SCAFFOLD_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'plan-file': { type: 'string' as const },
  'config-file': { type: 'string' as const },
  'manifest-init-file': { type: 'string' as const },
};

export function projectScaffold(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: SCAFFOLD_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slugArg = positionals[0];
  if (slugArg === undefined) {
    return errToResult(
      new LoomError('missing-args', 'project scaffold requires a slug'),
    );
  }
  const planFile = values['plan-file'];
  const configFile = values['config-file'];
  const manifestInitFile = values['manifest-init-file'];
  if (
    planFile === undefined ||
    configFile === undefined ||
    manifestInitFile === undefined
  ) {
    return errToResult(
      new LoomError(
        'missing-args',
        'project scaffold requires --plan-file, --config-file, and --manifest-init-file',
      ),
    );
  }
  let slug: string;
  try {
    slug = normalizeSlug(slugArg);
  } catch (err) {
    return errToResult(err);
  }
  const projectDir = join(ctx.projectsRoot, slug);
  const archiveDir = join(ctx.projectsRoot, ARCHIVE_DIRNAME, slug);
  if (existsSync(projectDir) || existsSync(archiveDir)) {
    return errToResult(
      new LoomError(
        'project-exists',
        `project ${slug} already exists at ${existsSync(projectDir) ? projectDir : archiveDir}`,
      ),
    );
  }
  let manifestInit: ManifestInit;
  try {
    manifestInit = JSON.parse(readFileSync(manifestInitFile, 'utf8'));
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'invalid-manifest-init',
        `cannot read manifest-init file ${manifestInitFile}: ${(err as Error).message}`,
      ),
    );
  }
  let config;
  try {
    config = readConfig(configFile);
  } catch (err) {
    return errToResult(err);
  }
  try {
    mkdirSync(projectDir, { recursive: true });
    copyFileSync(planFile, join(projectDir, 'PLAN.md'));
    writeLoomSubstrate({ projectDir, slug, config, manifestInit });
  } catch (err: unknown) {
    if (err instanceof LoomError) return errToResult(err);
    return errToResult(
      new LoomError(
        'scaffold-failed',
        `scaffold failed: ${(err as Error).message}`,
      ),
    );
  }
  return {
    stdout: emit({ slug, path: projectDir }, values.pretty === true),
    exitCode: 0,
  };
}

const ADOPT_OPTIONS = {
  pretty: { type: 'boolean' as const },
  'config-file': { type: 'string' as const },
  'manifest-init-file': { type: 'string' as const },
};

export function projectAdopt(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: ADOPT_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slugArg = positionals[0];
  if (slugArg === undefined) {
    return errToResult(
      new LoomError('missing-args', 'project adopt requires a slug'),
    );
  }
  const configFile = values['config-file'];
  const manifestInitFile = values['manifest-init-file'];
  if (configFile === undefined || manifestInitFile === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        'project adopt requires --config-file and --manifest-init-file',
      ),
    );
  }
  let slug: string;
  try {
    slug = normalizeSlug(slugArg);
  } catch (err) {
    return errToResult(err);
  }
  const projectDir = join(ctx.projectsRoot, slug);
  if (!existsSync(projectDir)) {
    return errToResult(
      new LoomError(
        'project-not-found',
        `project ${slug} does not exist at ${projectDir} (use 'project scaffold' to create one)`,
      ),
    );
  }
  const planMdPath = join(projectDir, 'PLAN.md');
  if (!existsSync(planMdPath)) {
    return errToResult(
      new LoomError(
        'plan-not-found',
        `cannot adopt ${slug}: ${planMdPath} is missing (project must already have a PLAN.md, e.g. from 'bin/draft plan')`,
      ),
    );
  }
  const manifestPath = join(projectDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    return errToResult(
      new LoomError(
        'already-adopted',
        `project ${slug} already has manifest.json at ${manifestPath} (loom is already adopted)`,
      ),
    );
  }
  let manifestInit: ManifestInit;
  try {
    manifestInit = JSON.parse(readFileSync(manifestInitFile, 'utf8'));
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'invalid-manifest-init',
        `cannot read manifest-init file ${manifestInitFile}: ${(err as Error).message}`,
      ),
    );
  }
  let config;
  try {
    config = readConfig(configFile);
  } catch (err) {
    return errToResult(err);
  }
  try {
    writeLoomSubstrate({ projectDir, slug, config, manifestInit });
  } catch (err: unknown) {
    if (err instanceof LoomError) return errToResult(err);
    return errToResult(
      new LoomError('adopt-failed', `adopt failed: ${(err as Error).message}`),
    );
  }
  return {
    stdout: emit({ slug, path: projectDir }, values.pretty === true),
    exitCode: 0,
  };
}

const ARCHIVE_OPTIONS = {
  pretty: { type: 'boolean' as const },
};

export function projectArchive(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: ARCHIVE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slugArg = positionals[0];
  if (slugArg === undefined) {
    return errToResult(
      new LoomError('missing-slug', 'project archive requires a slug'),
    );
  }
  let projectPath: string;
  try {
    projectPath = resolveProject(slugArg, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }
  // Already in archive/ → refuse
  if (projectPath.includes(`${sep}${ARCHIVE_DIRNAME}${sep}`)) {
    return errToResult(
      new LoomError('already-archived', `project ${slugArg} is already archived`),
    );
  }
  const slug = projectPath.split(sep).pop() as string;
  const archiveRoot = join(ctx.projectsRoot, ARCHIVE_DIRNAME);
  const destination = join(archiveRoot, slug);
  try {
    // Flip manifest status, write back
    const manifestPath = join(projectPath, 'manifest.json');
    const manifest = readManifest(manifestPath);
    const updated: Manifest = { ...manifest, status: 'archived' };
    writeManifest(manifestPath, updated);
    // Append archived event (still in source location)
    appendEvent(join(projectPath, 'events.jsonl'), {
      at: new Date().toISOString(),
      event: 'archived',
      detail: { destination },
    });
    // Relocate. Non-atomic — if this throws, doctor sees the drift.
    mkdirSync(archiveRoot, { recursive: true });
    renameSync(projectPath, destination);
  } catch (err: unknown) {
    if (err instanceof LoomError) return errToResult(err);
    return errToResult(
      new LoomError(
        'archive-failed',
        `archive failed: ${(err as Error).message}`,
      ),
    );
  }
  return {
    stdout: emit({ slug, destination }, values.pretty === true),
    exitCode: 0,
  };
}

export const PROJECT_VERBS = {
  read: projectRead,
  list: projectList,
  ls: projectList,
  status: projectStatus,
  scaffold: projectScaffold,
  adopt: projectAdopt,
  archive: projectArchive,
};
