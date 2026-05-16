import { existsSync, readdirSync, statSync } from 'node:fs';
const LOOM_MARKER = 'manifest.json';
import { isAbsolute, join, resolve } from 'node:path';
import { LoomError } from './errors.ts';

export const ARCHIVE_DIRNAME = 'archive';

const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DATELESS_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ProjectSummary = {
  slug: string;
  path: string;
};

export type ListProjectsOptions = {
  archived?: boolean;
};

// Resolve a slug or path into an absolute project directory path.
//
// Accepts:
//   - full slug:        2026-05-15-loom-cli
//   - date-less suffix: loom-cli (unique match)
//   - relative path:    ./projects/2026-05-15-loom-cli
//   - absolute path:    /home/.../projects/2026-05-15-loom-cli
//
// Active directories are scanned first; the archive/ subdir is only
// matched if active resolution fails. Ambiguous suffix matches throw
// `slug-ambiguous` with `candidates`.
export function resolveProject(slugOrPath: string, projectsRoot: string): string {
  // Absolute or relative path → resolve and check existence.
  if (slugOrPath.startsWith('/') || slugOrPath.startsWith('.')) {
    const abs = isAbsolute(slugOrPath) ? slugOrPath : resolve(slugOrPath);
    if (!existsSync(abs)) {
      throw new LoomError('project-not-found', `no project at path ${abs}`);
    }
    return abs;
  }

  const active = listProjects(projectsRoot, { archived: false });
  const archived = listProjects(projectsRoot, { archived: true });

  if (SLUG_RE.test(slugOrPath)) {
    const inActive = active.find((p) => p.slug === slugOrPath);
    if (inActive !== undefined) return inActive.path;
    const inArchive = archived.find((p) => p.slug === slugOrPath);
    if (inArchive !== undefined) return inArchive.path;
    throw new LoomError(
      'project-not-found',
      `no project with slug ${slugOrPath}`,
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
      `slug '${slugOrPath}' matches multiple active projects`,
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
      `slug '${slugOrPath}' matches multiple archived projects`,
      archiveMatches.map((p) => p.slug),
    );
  }

  throw new LoomError(
    'project-not-found',
    `no project matching '${slugOrPath}'`,
  );
}

// Build a project slug from a free-form topic and a YYYY-MM-DD date.
//
// Slugifies `topic` (lowercase, runs of non-alphanumeric collapsed to a
// single `-`, leading/trailing `-` trimmed) and prefixes with `today`,
// producing `<YYYY-MM-DD>-<slug>` matching `SLUG_RE` exactly.
//
// Throws `LoomError`:
//   - `invalid-date`  — `today` doesn't match YYYY-MM-DD.
//   - `invalid-topic` — `topic` slugifies to fewer than 2 chars
//                       (empty, whitespace, only special chars, or a
//                       single alphanumeric — SLUG_RE requires 2+).
export function createSlug(topic: string, today: string): string {
  if (!DATE_RE.test(today)) {
    throw new LoomError(
      'invalid-date',
      `today '${today}' does not match YYYY-MM-DD`,
    );
  }
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length < 2) {
    throw new LoomError(
      'invalid-topic',
      `topic '${topic}' slugifies to '${slug}' (must be at least 2 chars)`,
    );
  }
  return `${today}-${slug}`;
}

export function listProjects(
  projectsRoot: string,
  opts: ListProjectsOptions = {},
): ProjectSummary[] {
  const target = opts.archived === true
    ? join(projectsRoot, ARCHIVE_DIRNAME)
    : projectsRoot;
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
    // Filter to loom-managed projects: only directories carrying
    // manifest.json are listed. Draft-only projects (PLAN.md without
    // manifest.json) are invisible to loom by design — see
    // LOOM-CONVENTIONS.md § Pairing with draft.
    if (!existsSync(join(fullPath, LOOM_MARKER))) continue;
    projects.push({ slug: entry, path: fullPath });
  }
  return projects;
}
