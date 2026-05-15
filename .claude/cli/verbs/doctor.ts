import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { resolveProject, listProjects } from '../lib/project.ts';
import { readManifest } from '../lib/manifest.ts';
import { readConfig } from '../lib/config.ts';
import { readEvents } from '../lib/events.ts';
import { LoomError } from '../lib/errors.ts';
import type { CliContext, DispatchResult } from './project.ts';

const SUPPORTED_SCHEMA_VERSION = 1;

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

type DoctorIssue = {
  code: string;
  severity: 'warning' | 'error';
  detail: string;
};

type DoctorReport = {
  slug: string;
  ok: boolean;
  issues: DoctorIssue[];
};

function checkProject(projectPath: string, slug: string): DoctorReport {
  const issues: DoctorIssue[] = [];
  const manifestPath = join(projectPath, 'manifest.json');
  const eventsPath = join(projectPath, 'events.jsonl');
  const configPath = join(projectPath, 'config.json');

  if (!existsSync(manifestPath)) {
    issues.push({
      code: 'manifest-missing',
      severity: 'error',
      detail: `manifest.json not found at ${manifestPath}`,
    });
  } else {
    try {
      const m = readManifest(manifestPath);
      if (m.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        issues.push({
          code: 'schema-version-mismatch',
          severity: 'error',
          detail: `manifest schema_version is ${m.schema_version}; supported: ${SUPPORTED_SCHEMA_VERSION}`,
        });
      }
    } catch (err: unknown) {
      issues.push({
        code: 'manifest-unreadable',
        severity: 'error',
        detail: (err as Error).message,
      });
    }
  }

  if (!existsSync(eventsPath)) {
    issues.push({
      code: 'events-missing',
      severity: 'error',
      detail: `events.jsonl not found at ${eventsPath}`,
    });
  } else {
    try {
      readEvents(eventsPath, { limit: 1 });
    } catch (err: unknown) {
      issues.push({
        code: 'events-unreadable',
        severity: 'error',
        detail: (err as Error).message,
      });
    }
  }

  if (!existsSync(configPath)) {
    issues.push({
      code: 'config-missing',
      severity: 'error',
      detail: `config.json not found at ${configPath}`,
    });
  } else {
    try {
      const c = readConfig(configPath);
      if (c.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        issues.push({
          code: 'schema-version-mismatch',
          severity: 'error',
          detail: `config schema_version is ${c.schema_version}; supported: ${SUPPORTED_SCHEMA_VERSION}`,
        });
      }
    } catch (err: unknown) {
      issues.push({
        code: 'config-unreadable',
        severity: 'error',
        detail: (err as Error).message,
      });
    }
  }

  return {
    slug,
    ok: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}

export function doctor(rest: string[], ctx: CliContext): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: { pretty: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  const slugArg = positionals[0];
  let projectPath: string;
  let slug: string;
  try {
    if (slugArg !== undefined) {
      projectPath = resolveProject(slugArg, ctx.projectsRoot);
      slug = slugArg;
    } else {
      // No slug → cwd discovery (same shape as project status).
      const cwd = ctx.cwdOverride ?? process.cwd();
      const all = [
        ...listProjects(ctx.projectsRoot),
        ...listProjects(ctx.projectsRoot, { archived: true }),
      ];
      const match = all.find(
        (p) => cwd === p.path || cwd.startsWith(p.path + sep),
      );
      if (match === undefined) {
        return errToResult(
          new LoomError(
            'not-in-project',
            `cwd ${cwd} is not inside a project directory`,
          ),
        );
      }
      projectPath = match.path;
      slug = match.slug;
    }
  } catch (err) {
    return errToResult(err);
  }
  const report = checkProject(projectPath, slug);
  return { stdout: emit(report, values.pretty === true), exitCode: 0 };
}

export const DOCTOR_VERBS = {
  doctor,
};
