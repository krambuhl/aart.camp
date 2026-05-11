#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARCHIVE_ROOT, ProjectResolveError, resolveProject } from './resolve-project.ts';

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
    if (err instanceof ProjectResolveError || err instanceof RelocateError) fail(err.message);
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

  // Precheck: source directory must have git-tracked content. Without this,
  // `git mv` fails opaquely with "fatal: source directory is empty" when the
  // project's files were never committed.
  const lsFiles = spawnSync('git', ['ls-files', '--', projectPath], { encoding: 'utf-8' });
  if (lsFiles.status !== 0) {
    const stderr = (lsFiles.stderr ?? '').trim() || `git exited with status ${lsFiles.status}`;
    fail(`git ls-files failed: ${stderr}`);
  }
  if (!(lsFiles.stdout ?? '').trim()) {
    fail(`project has no git-tracked files: ${projectPath} (commit project files before archiving)`);
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

  // Stage the manifest modification before git mv so the rename + Status flip
  // land atomically in a single commit. Without this, the modification stays
  // unstaged and the caller has to make a second "Flip Status" commit.
  const addResult = spawnSync('git', ['add', '--', manifestPath], { encoding: 'utf-8' });
  if (addResult.status !== 0) {
    writeFileSync(manifestPath, original);
    const stderr = (addResult.stderr ?? '').trim() || `git exited with status ${addResult.status}`;
    fail(`git add failed: ${stderr}`);
  }

  const result = spawnSync('git', ['mv', projectPath, destPath], { encoding: 'utf-8' });
  if (result.status !== 0) {
    // restore manifest on failure so the caller can retry cleanly
    writeFileSync(manifestPath, original);
    spawnSync('git', ['add', '--', manifestPath], { encoding: 'utf-8' });
    const stderr = (result.stderr ?? '').trim() || `git exited with status ${result.status}`;
    fail(`git mv failed: ${stderr}`);
  }

  process.stdout.write(`relocated: ${projectPath} → ${destPath}\n`);
}

main();
