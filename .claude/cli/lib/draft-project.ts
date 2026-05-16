import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { LoomError } from './errors.ts';
import { ARCHIVE_DIRNAME } from './project.ts';

// Draft's filter is one-sided: a directory counts as a draft-readable
// project iff it contains `PLAN.md` (the file draft reads and revises).
// Loom-managed projects (which also carry `manifest.json`) qualify,
// because PLAN.md is plain markdown that draft owns regardless of
// whether loom owns the rest of the substrate. Trout-managed projects
// (which carry `MANIFEST.md` alongside `PLAN.md`) qualify for the same
// reason. The substrate model treats loom + draft as paired halves of
// one project: draft owns planning, loom owns execution, and resolvers
// must see across both.
//
// Earlier iterations excluded loom-managed projects to preserve a
// "draft only sees what it owns end-to-end" boundary. That boundary
// turned out to be wrong — it blocked `bin/draft revise` on the
// (intended-to-be-common) loom+draft project, which is the post-trout
// default. Exclusion removed in trout-sunset Phase 1 D2.
const PLAN_MARKER = 'PLAN.md';

// Slug-grammar regexes are duplicated locally rather than imported
// because they are not exported from `./project.ts`. The substrate
// convention is for each lib to own its grammar; SLUG_RE and
// DATELESS_RE here match loom's exactly so trout and loom slugs are
// indistinguishable at the syntax level.
const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DATELESS_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export type ProjectSummary = {
  slug: string;
  path: string;
};

export type ListProjectsOptions = {
  archived?: boolean;
};

// Resolve a draft-readable project slug or path to an absolute
// directory.
//
// Behaviour parallels loom's `resolveProject` exactly, with one
// substantive difference: directories that carry `PLAN.md` qualify
// regardless of whether they also carry `manifest.json`. This
// includes:
//   - Trout-managed projects (PLAN.md + MANIFEST.md)
//   - Draft-only projects (PLAN.md + INTERVIEW.md, no manifest.json)
//   - Loom + draft projects (PLAN.md + manifest.json + ...)
// The third case is the post-trout default and is the reason this
// resolver no longer excludes loom-managed dirs.
//
// Accepts:
//   - full slug:        2026-05-15-draft-cli
//   - date-less suffix: draft-cli (unique match)
//   - relative path:    ./projects/2026-05-15-draft-cli
//   - absolute path:    /home/.../projects/2026-05-15-draft-cli
//
// Active directories are scanned first; archive/ is only matched if
// active resolution fails. Ambiguous suffix matches throw
// `slug-ambiguous` with `candidates`.
export function resolveTroutProject(
  slugOrPath: string,
  projectsRoot: string,
): string {
  // Absolute or relative path → resolve and check existence.
  if (slugOrPath.startsWith('/') || slugOrPath.startsWith('.')) {
    const abs = isAbsolute(slugOrPath) ? slugOrPath : resolve(slugOrPath);
    if (!existsSync(abs)) {
      throw new LoomError('project-not-found', `no project at path ${abs}`);
    }
    return abs;
  }

  const active = listTroutProjects(projectsRoot, { archived: false });
  const archived = listTroutProjects(projectsRoot, { archived: true });

  if (SLUG_RE.test(slugOrPath)) {
    const inActive = active.find((p) => p.slug === slugOrPath);
    if (inActive !== undefined) return inActive.path;
    const inArchive = archived.find((p) => p.slug === slugOrPath);
    if (inArchive !== undefined) return inArchive.path;
    throw new LoomError(
      'project-not-found',
      `no trout project with slug ${slugOrPath}`,
    );
  }

  if (!DATELESS_RE.test(slugOrPath)) {
    throw new LoomError(
      'project-not-found',
      `slug '${slugOrPath}' does not match the expected form`,
    );
  }

  // Date-less suffix match. Scan active first.
  const activeMatches = active.filter((p) => p.slug.endsWith(`-${slugOrPath}`));
  if (activeMatches.length === 1) {
    return (activeMatches[0] as ProjectSummary).path;
  }
  if (activeMatches.length > 1) {
    throw new LoomError(
      'slug-ambiguous',
      `slug '${slugOrPath}' matches multiple active trout projects`,
      activeMatches.map((p) => p.slug),
    );
  }

  const archiveMatches = archived.filter((p) =>
    p.slug.endsWith(`-${slugOrPath}`),
  );
  if (archiveMatches.length === 1) {
    return (archiveMatches[0] as ProjectSummary).path;
  }
  if (archiveMatches.length > 1) {
    throw new LoomError(
      'slug-ambiguous',
      `slug '${slugOrPath}' matches multiple archived trout projects`,
      archiveMatches.map((p) => p.slug),
    );
  }

  throw new LoomError(
    'project-not-found',
    `no trout project matching '${slugOrPath}'`,
  );
}

export function listTroutProjects(
  projectsRoot: string,
  opts: ListProjectsOptions = {},
): ProjectSummary[] {
  const target =
    opts.archived === true ? join(projectsRoot, ARCHIVE_DIRNAME) : projectsRoot;
  if (!existsSync(target)) return [];

  const entries = readdirSync(target);
  const projects: ProjectSummary[] = [];
  for (const entry of entries) {
    if (entry === ARCHIVE_DIRNAME) continue;
    if (!SLUG_RE.test(entry)) continue;
    const fullPath = join(target, entry);
    try {
      const st = statSync(fullPath);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    // Draft filter: project must have PLAN.md. Loom-managed projects
    // (which also carry manifest.json) qualify — see the file header
    // for why the loom-marker exclusion was removed.
    if (!existsSync(join(fullPath, PLAN_MARKER))) continue;
    projects.push({ slug: entry, path: fullPath });
  }
  return projects;
}
