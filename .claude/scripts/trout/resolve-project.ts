import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PROJECTS_ROOT = resolve(process.cwd(), 'projects');
export const ARCHIVE_ROOT = join(PROJECTS_ROOT, 'archive');

export class ProjectResolveError extends Error {
  readonly candidates: string[] | undefined;
  constructor(message: string, candidates?: string[]) {
    super(message);
    this.candidates = candidates;
  }
}

export function resolveProject(slug: string): string {
  if (slug.startsWith('.') || slug.startsWith('/')) {
    const abs = resolve(slug);
    if (abs.startsWith(ARCHIVE_ROOT + '/') || abs === ARCHIVE_ROOT) {
      throw new ProjectResolveError(`project is archived (read-only): ${abs}`);
    }
    if (!existsSync(abs)) {
      throw new ProjectResolveError(`project not found: ${abs}`);
    }
    if (!statSync(abs).isDirectory()) {
      throw new ProjectResolveError(`project path is not a directory: ${abs}`);
    }
    return abs;
  }
  if (!existsSync(PROJECTS_ROOT)) {
    throw new ProjectResolveError(`projects root does not exist: ${PROJECTS_ROOT}`);
  }
  const direct = join(PROJECTS_ROOT, slug);
  if (existsSync(direct) && statSync(direct).isDirectory()) {
    return direct;
  }
  const matches = readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .filter((name) => name.endsWith(`-${slug}`));
  if (matches.length === 1) {
    return join(PROJECTS_ROOT, matches[0]);
  }
  if (matches.length > 1) {
    throw new ProjectResolveError(
      `ambiguous slug "${slug}"; candidates: ${matches.join(', ')}`,
      matches,
    );
  }
  if (existsSync(ARCHIVE_ROOT)) {
    const archivedMatch = readdirSync(ARCHIVE_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .find((name) => name === slug || name.endsWith(`-${slug}`));
    if (archivedMatch) {
      throw new ProjectResolveError(
        `project is archived (read-only): ${join(ARCHIVE_ROOT, archivedMatch)}`,
      );
    }
  }
  throw new ProjectResolveError(
    `project not found: slug "${slug}" did not match any directory under ${PROJECTS_ROOT}`,
  );
}
