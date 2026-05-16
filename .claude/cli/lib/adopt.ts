import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeManifest } from './manifest.ts';
import { writeConfig } from './config.ts';
import { appendEvent } from './events.ts';
import type { Config, Manifest, ManifestPhase } from './types.ts';

// Inputs the loom CLI's `project adopt` verb collects from --manifest-
// init-file. Also produced by `synthesizeManifestInit` for the auto-
// adopt path in `bin/draft plan`.
export type ManifestInit = {
  title: string;
  started: string;
  strategy: string;
  phases: ManifestPhase[];
};

// Write the loom substrate (manifest.json, config.json, events.jsonl,
// checkins/, sessions/) into an existing project directory. Does not
// touch PLAN.md or INTERVIEW.md. Does not check for prior adoption —
// callers are responsible for refusing or skipping when appropriate.
export function writeLoomSubstrate(opts: {
  projectDir: string;
  slug: string;
  config: Config;
  manifestInit: ManifestInit;
}): void {
  const { projectDir, slug, config, manifestInit } = opts;

  mkdirSync(join(projectDir, 'checkins'), { recursive: true });
  mkdirSync(join(projectDir, 'sessions'), { recursive: true });

  const manifest: Manifest = {
    schema_version: 1,
    title: manifestInit.title,
    slug,
    started: manifestInit.started,
    status: 'active',
    current_branch: null,
    latest_checkin: null,
    strategy: manifestInit.strategy,
    phases: manifestInit.phases,
  };
  writeManifest(join(projectDir, 'manifest.json'), manifest);
  writeConfig(join(projectDir, 'config.json'), config);
  appendEvent(join(projectDir, 'events.jsonl'), {
    at: new Date().toISOString(),
    event: 'project-initialized',
    detail: {},
  });
}

// Default ManifestInit synthesized from a slug + today. Used by the
// `bin/draft plan` auto-adopt path when the caller doesn't supply a
// manifest-init-file. Title is derived from the slug suffix; phases is
// a single placeholder the user fills in by editing the manifest (or by
// re-running with an explicit init file).
export function synthesizeManifestInit(
  slug: string,
  today: string,
): ManifestInit {
  return {
    title: slugToTitle(slug),
    started: today,
    strategy: 'interactive',
    phases: [{ number: 1, name: 'Phase 1', status: 'not-started' }],
  };
}

// Default Config synthesized for the auto-adopt path. Empty
// reviewers/labels/verification arrays, base_branch = 'main', no
// worker bindings. The user edits config.json to specialize.
export function synthesizeConfig(): Config {
  return {
    schema_version: 1,
    base_branch: 'main',
    reviewers: [],
    labels: [],
    verification: [],
    worker_bindings: {},
  };
}

// Title-case a kebab-case slug, stripping any leading YYYY-MM-DD date
// prefix. `2026-05-15-trout-sunset` → `Trout Sunset`. `foo-bar` → `Foo
// Bar`. Used to seed the manifest title from the slug when the caller
// doesn't supply an explicit title.
export function slugToTitle(slug: string): string {
  const sansDate = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return sansDate
    .split('-')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
