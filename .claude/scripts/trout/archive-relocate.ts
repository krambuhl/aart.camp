#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECTS_ROOT = resolve(process.cwd(), 'projects');
const ARCHIVE_ROOT = join(PROJECTS_ROOT, 'archive');

const ARG_HINT = '<project-slug-or-path>';

const HEADER_SCAN_LINES = 30;

class RelocateError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`archive-relocate-error: ${reason}\n`);
  process.exit(1);
}

// ---------- Pure helpers (exported for direct unit tests) ----------

export function flipStatusLine(manifest: string): { content: string; previousStatus: string } {
  const lines = manifest.split('\n');
  const scanEnd = Math.min(lines.length, HEADER_SCAN_LINES);
  const re = /^(\*\*Status\*\*:\s*)(\S+)\s*$/;
  for (let i = 0; i < scanEnd; i++) {
    const m = lines[i].match(re);
    if (m) {
      const prev = m[2];
      if (prev !== 'active') {
        throw new RelocateError(`unexpected status: expected "active", found "${prev}"`);
      }
      lines[i] = `${m[1]}archived`;
      return { content: lines.join('\n'), previousStatus: prev };
    }
  }
  throw new RelocateError('manifest missing **Status** field in header');
}

export function resolveProject(slug: string): string {
  if (slug.startsWith('.') || slug.startsWith('/')) {
    const abs = resolve(slug);
    if (abs.startsWith(ARCHIVE_ROOT + '/') || abs === ARCHIVE_ROOT) {
      throw new RelocateError(`already archived: ${abs}`);
    }
    if (!existsSync(abs)) {
      throw new RelocateError(`project not found: ${abs}`);
    }
    if (!statSync(abs).isDirectory()) {
      throw new RelocateError(`project path is not a directory: ${abs}`);
    }
    return abs;
  }
  if (!existsSync(PROJECTS_ROOT)) {
    throw new RelocateError(`projects root does not exist: ${PROJECTS_ROOT}`);
  }
  const direct = join(PROJECTS_ROOT, slug);
  if (existsSync(direct) && statSync(direct).isDirectory()) {
    return direct;
  }
  // suffix match across active projects
  const candidates = readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .filter((name) => name.endsWith(slug));
  if (candidates.length === 1) {
    return join(PROJECTS_ROOT, candidates[0]);
  }
  if (candidates.length > 1) {
    throw new RelocateError(`ambiguous slug "${slug}"; candidates: ${candidates.join(', ')}`);
  }
  // archive check (so we report "already archived" rather than "not found")
  if (existsSync(ARCHIVE_ROOT)) {
    const archivedMatch = readdirSync(ARCHIVE_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => name === slug || name.endsWith(slug));
    if (archivedMatch.length > 0) {
      throw new RelocateError(`already archived: ${join(ARCHIVE_ROOT, archivedMatch[0])}`);
    }
  }
  throw new RelocateError(`project not found: slug "${slug}" did not match any directory under ${PROJECTS_ROOT}`);
}

// ---------- Main ----------

function main(): void {
  let parsed;
  try {
    parsed = parseArgs({
      options: {},
      allowPositionals: true,
      args: process.argv.slice(2),
    });
  } catch (err) {
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const positionals = parsed.positionals;
  if (positionals.length === 0) {
    process.stderr.write(`archive-relocate-error: missing project argument\nusage: ${ARG_HINT}\n`);
    process.exit(1);
  }
  if (positionals.length > 1) {
    fail(`too many arguments: expected 1, got ${positionals.length}`);
  }

  let projectPath: string;
  try {
    projectPath = resolveProject(positionals[0]);
  } catch (err) {
    if (err instanceof RelocateError) fail(err.message);
    throw err;
  }

  const manifestPath = join(projectPath, 'MANIFEST.md');
  if (!existsSync(manifestPath)) {
    fail(`manifest not found: ${manifestPath}`);
  }

  const destPath = join(ARCHIVE_ROOT, basename(projectPath));
  if (existsSync(destPath)) {
    fail(`destination already exists: ${destPath}`);
  }

  const original = readFileSync(manifestPath, 'utf-8');
  let updated: string;
  try {
    updated = flipStatusLine(original).content;
  } catch (err) {
    if (err instanceof RelocateError) {
      fail(`${err.message}; manifest at ${manifestPath}`);
    }
    throw err;
  }
  writeFileSync(manifestPath, updated);

  const result = spawnSync('git', ['mv', projectPath, destPath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    // restore manifest on failure so the caller can retry cleanly
    writeFileSync(manifestPath, original);
    const stderr = (result.stderr ?? '').trim() || `git exited with status ${result.status}`;
    fail(`git mv failed: ${stderr}`);
  }

  process.stdout.write(`relocated: ${projectPath} → ${destPath}\n`);
}

main();
