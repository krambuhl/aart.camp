#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PROJECTS_ROOT = resolve(process.cwd(), 'projects');

const ARG_HINT = '<slug> --plan-file=<path> --config-file=<path> --manifest-init-file=<path>';
const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const REQUIRED_INIT_FIELDS = ['title', 'started', 'strategy', 'phases'] as const;

class ScaffoldError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`plan-scaffold-error: ${reason}\n`);
  process.exit(1);
}

// ---------- Pure helpers (exported for direct unit tests) ----------

export type ManifestInit = {
  title: string;
  started: string;
  strategy: string;
  phases: Array<{ name: string; dependencies?: string[] }>;
};

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new ScaffoldError(`slug must match YYYY-MM-DD-<kebab>: ${slug}`);
  }
}

export function parseManifestInit(raw: string): ManifestInit {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ScaffoldError(`manifest-init JSON parse error: ${(err as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ScaffoldError('manifest-init JSON must be an object');
  }
  const obj = parsed as Record<string, unknown>;
  for (const field of REQUIRED_INIT_FIELDS) {
    if (!(field in obj)) {
      throw new ScaffoldError(`manifest-init JSON missing required field: ${field}`);
    }
  }
  if (!Array.isArray(obj.phases)) {
    throw new ScaffoldError('manifest-init.phases must be an array');
  }
  return obj as unknown as ManifestInit;
}

export function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Manifest template — kept byte-for-byte aligned with autosave.ts::runInit's
// template. If you change one, change the other; a golden-snapshot test in
// plan-scaffold.test.ts guards against drift during this transitional period
// (autosave's --init path is unused-but-not-yet-removed).
export function renderManifest(init: ManifestInit, slug: string, when: string): string {
  const phaseRows = init.phases.map((p, idx) => {
    const num = idx + 1;
    return `| ${num} | ${p.name} | not-started | — | — | — |`;
  }).join('\n');
  const dependencyLines = init.phases.flatMap((p, idx) => {
    if (!p.dependencies || p.dependencies.length === 0) return [];
    return [`- Phase ${idx + 1}: ${p.dependencies.join('; ')}`];
  });
  const dependenciesBlock = dependencyLines.length > 0 ? dependencyLines.join('\n') : '- (none)';
  return `# Project: ${init.title}

**Slug**: ${slug}
**Started**: ${init.started}
**Status**: active
**Current branch**: —
**Latest checkin**: —

## Strategy

${init.strategy}

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
${phaseRows}

## Dependencies

${dependenciesBlock}

## Current state

Project initialized. No work started yet.

## Events

| When | Event | Detail |
|------|-------|--------|
| ${when} | project-initialized | — |
`;
}

// ---------- Main ----------

function tryOrFail<T>(fn: () => T): T {
  try { return fn(); } catch (err) {
    if (err instanceof ScaffoldError) fail(err.message);
    throw err;
  }
}

function readFileOrFail(path: string, label: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) fail(`${label} not found: ${path}`);
  return readFileSync(resolved, 'utf-8');
}

function main(): void {
  const parsed = (() => {
    try {
      return parseArgs({
        options: {
          'plan-file': { type: 'string' },
          'config-file': { type: 'string' },
          'manifest-init-file': { type: 'string' },
        },
        allowPositionals: true,
        args: process.argv.slice(2),
      });
    } catch (err) { fail(`argument parse failure: ${(err as Error).message}`); }
  })();
  const { values, positionals } = parsed;

  if (positionals.length === 0) fail(`missing slug; usage: ${ARG_HINT}`);
  if (positionals.length > 1) fail(`too many positional arguments: expected 1, got ${positionals.length}`);

  const slug = positionals[0];
  tryOrFail(() => validateSlug(slug));

  const planFile = values['plan-file'] as string | undefined;
  const configFile = values['config-file'] as string | undefined;
  const manifestInitFile = values['manifest-init-file'] as string | undefined;
  if (!planFile) fail(`--plan-file is required; usage: ${ARG_HINT}`);
  if (!configFile) fail(`--config-file is required; usage: ${ARG_HINT}`);
  if (!manifestInitFile) fail(`--manifest-init-file is required; usage: ${ARG_HINT}`);

  const planContent = readFileOrFail(planFile, '--plan-file');
  const configContent = readFileOrFail(configFile, '--config-file');
  const initRaw = readFileOrFail(manifestInitFile, '--manifest-init-file');
  const init = tryOrFail(() => parseManifestInit(initRaw));

  const projectPath = join(PROJECTS_ROOT, slug);
  if (existsSync(projectPath)) fail(`project directory already exists: projects/${slug}/`);

  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(projectPath, 'sessions'), { recursive: true });
  mkdirSync(join(projectPath, 'checkins'), { recursive: true });

  writeFileSync(join(projectPath, 'PLAN.md'), planContent);
  writeFileSync(join(projectPath, 'config.md'), configContent);
  writeFileSync(join(projectPath, 'MANIFEST.md'), renderManifest(init, slug, timestamp()));

  process.stdout.write(`plan-scaffold-written: projects/${slug}/\n`);
}

main();
