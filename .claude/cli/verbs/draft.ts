import { parseArgs } from 'node:util';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { LoomError } from '../lib/errors.ts';
import { createSlug } from '../lib/project.ts';
import { resolveProject } from '../lib/draft-project.ts';
import { type GitRunner, defaultGitRunner } from '../lib/draft-git.ts';
import {
  writeLoomSubstrate,
  synthesizeManifestInit,
  synthesizeConfig,
} from '../lib/adopt.ts';

// Shared context for every draft verb. Tests inject `projectsRoot`
// (a temp dir), `today` (deterministic slug derivation), and
// `gitRunner` (stubbed git calls). Production uses the real
// filesystem, real date, and `defaultGitRunner`.
export type DraftCliContext = {
  projectsRoot: string;
  today?: string;
  gitRunner?: GitRunner;
  repoRoot?: string;
};

export type DispatchResult = {
  stdout?: string;
  stderr?: string;
  exitCode: number;
};

export type VerbHandler = (
  rest: string[],
  ctx: DraftCliContext,
) => DispatchResult;

function emit(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

function errToResult(err: unknown): DispatchResult {
  if (err instanceof LoomError) {
    return { stderr: JSON.stringify(err.toPayload()), exitCode: 1 };
  }
  throw err;
}

function todayString(ctx: DraftCliContext): string {
  return ctx.today ?? new Date().toISOString().slice(0, 10);
}

function gitRunnerOf(ctx: DraftCliContext): GitRunner {
  return ctx.gitRunner ?? defaultGitRunner;
}

function repoRootOf(ctx: DraftCliContext): string {
  return ctx.repoRoot ?? process.cwd();
}

const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;

const PLAN_OPTIONS = {
  'plan-file': { type: 'string' as const },
  'interview-file': { type: 'string' as const },
  'no-commit': { type: 'boolean' as const },
  'no-loom': { type: 'boolean' as const },
  pretty: { type: 'boolean' as const },
};

export function planVerb(
  rest: string[],
  ctx: DraftCliContext,
): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: PLAN_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slugOrTopic = positionals[0];
  const planFile = values['plan-file'];
  const interviewFile = values['interview-file'];
  const noCommit = values['no-commit'] === true;
  const noLoom = values['no-loom'] === true;
  const pretty = values.pretty === true;

  if (slugOrTopic === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        'plan requires a <slug-or-topic> positional argument',
      ),
    );
  }
  if (planFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'plan requires --plan-file=<path>'),
    );
  }
  if (interviewFile === undefined) {
    return errToResult(
      new LoomError(
        'missing-args',
        'plan requires --interview-file=<path>',
      ),
    );
  }

  let slug: string;
  try {
    if (SLUG_RE.test(slugOrTopic)) {
      // Caller passed a full slug. Use as-is; collision is handled
      // by the PLAN.md commit-status check below.
      slug = slugOrTopic;
    } else {
      slug = createSlug(slugOrTopic, todayString(ctx));
    }
  } catch (err) {
    return errToResult(err);
  }

  const targetDir = join(ctx.projectsRoot, slug);
  const planMdPath = join(targetDir, 'PLAN.md');
  const interviewMdPath = join(targetDir, 'INTERVIEW.md');

  // Collision check on PLAN.md. Committed → refuse; uncommitted →
  // allow overwrite (recovery from a prior failed commit).
  if (existsSync(planMdPath)) {
    const committed = gitRunnerOf(ctx).isCommitted(
      repoRootOf(ctx),
      planMdPath,
    );
    if (committed) {
      return errToResult(
        new LoomError(
          'plan-exists-committed',
          `PLAN.md at ${planMdPath} is already committed — use 'draft revise' to update it`,
        ),
      );
    }
  }

  try {
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(planFile, planMdPath);
    copyFileSync(interviewFile, interviewMdPath);
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'plan-write-failed',
        `writing PLAN.md/INTERVIEW.md failed: ${(err as Error).message}`,
      ),
    );
  }

  // Auto-adopt loom substrate (manifest.json, config.json, events.jsonl,
  // checkins/, sessions/) by default. Skipped when --no-loom is passed
  // or when manifest.json already exists (recovery case where draft plan
  // is re-run and loom is already set up).
  const filesToCommit = [planMdPath, interviewMdPath];
  const manifestPath = join(targetDir, 'manifest.json');
  const adoptLoom = !noLoom && !existsSync(manifestPath);
  if (adoptLoom) {
    try {
      writeLoomSubstrate({
        projectDir: targetDir,
        slug,
        config: synthesizeConfig(),
        manifestInit: synthesizeManifestInit(slug, todayString(ctx)),
      });
      filesToCommit.push(
        manifestPath,
        join(targetDir, 'config.json'),
        join(targetDir, 'events.jsonl'),
      );
    } catch (err: unknown) {
      return errToResult(
        new LoomError(
          'loom-adopt-failed',
          `auto-adopting loom failed: ${(err as Error).message}`,
        ),
      );
    }
  }

  if (!noCommit) {
    try {
      gitRunnerOf(ctx).addAndCommit(
        repoRootOf(ctx),
        filesToCommit,
        `[draft plan] ${slug}`,
      );
    } catch (err) {
      return errToResult(err);
    }
  }

  return {
    stdout: emit(
      { slug, path: targetDir, committed: !noCommit, loom_adopted: adoptLoom },
      pretty,
    ),
    exitCode: 0,
  };
}

// ---------- revise verb ----------

const REVISE_OPTIONS = {
  'revision-file': { type: 'string' as const },
  rationale: { type: 'string' as const },
  'no-commit': { type: 'boolean' as const },
  pretty: { type: 'boolean' as const },
};

// Insert a new revision-log entry into the PLAN content. If a
// `## Revision log` section already exists, the new entry is
// inserted directly under the heading (newest-first). Otherwise a
// fresh section is appended at the end of the document.
export function appendRevisionLogEntry(
  content: string,
  date: string,
  rationale: string,
): string {
  const entry = `- ${date} — ${rationale}`;
  const headingRe = /^## Revision log\s*$/m;
  const match = content.match(headingRe);
  if (match === null) {
    const sep = content.endsWith('\n') ? '\n' : '\n\n';
    return `${content.trimEnd()}${sep}\n## Revision log\n\n${entry}\n`;
  }
  // Insert directly after the heading line. Find the end of the
  // heading line and insert with surrounding blank-line padding.
  const headingStart = match.index ?? 0;
  const headingEnd = headingStart + (match[0]?.length ?? 0);
  const before = content.slice(0, headingEnd);
  const after = content.slice(headingEnd);
  // Normalize the gap between heading and first entry to one blank
  // line. `after` may start with `\n\n- ...` (existing entries) or
  // `\n\n## Next` (empty log section preceding another heading).
  const afterTrimmed = after.replace(/^\n+/, '');
  return `${before}\n\n${entry}\n\n${afterTrimmed}`;
}

export function reviseVerb(
  rest: string[],
  ctx: DraftCliContext,
): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: REVISE_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  const revisionFile = values['revision-file'];
  const rationale = values.rationale;
  const noCommit = values['no-commit'] === true;
  const pretty = values.pretty === true;

  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-args', 'revise requires a <slug> positional'),
    );
  }
  if (revisionFile === undefined) {
    return errToResult(
      new LoomError('missing-args', 'revise requires --revision-file=<path>'),
    );
  }
  if (rationale === undefined || rationale.trim() === '') {
    return errToResult(
      new LoomError(
        'missing-args',
        'revise requires --rationale=<str> (the why for git history + Revision log)',
      ),
    );
  }

  let targetDir: string;
  try {
    targetDir = resolveProject(slug, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }

  const planMdPath = join(targetDir, 'PLAN.md');
  if (!existsSync(planMdPath)) {
    return errToResult(
      new LoomError(
        'plan-not-found',
        `no PLAN.md at ${planMdPath} — use 'draft plan' to create one`,
      ),
    );
  }

  let revisionContent: string;
  try {
    revisionContent = readFileSync(revisionFile, 'utf8');
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'revision-read-failed',
        `cannot read revision file ${revisionFile}: ${(err as Error).message}`,
      ),
    );
  }

  const date = todayString(ctx);
  const composed = appendRevisionLogEntry(revisionContent, date, rationale);

  try {
    writeFileSync(planMdPath, composed);
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'plan-write-failed',
        `writing PLAN.md failed: ${(err as Error).message}`,
      ),
    );
  }

  if (!noCommit) {
    try {
      gitRunnerOf(ctx).addAndCommit(
        repoRootOf(ctx),
        [planMdPath],
        `[draft revise] ${slug}: ${rationale}`,
      );
    } catch (err) {
      return errToResult(err);
    }
  }

  // Resolve the project-relative slug for the envelope output, in
  // case the caller passed a date-less form.
  const resolvedSlug = targetDir.split('/').pop() ?? slug;

  return {
    stdout: emit(
      {
        slug: resolvedSlug,
        path: targetDir,
        committed: !noCommit,
        rationale,
      },
      pretty,
    ),
    exitCode: 0,
  };
}

// ---------- read verb ----------

const READ_OPTIONS = {
  pretty: { type: 'boolean' as const },
};

export function readVerb(
  rest: string[],
  ctx: DraftCliContext,
): DispatchResult {
  const { values, positionals } = parseArgs({
    args: rest,
    options: READ_OPTIONS,
    allowPositionals: true,
    strict: false,
  });
  const slug = positionals[0];
  const pretty = values.pretty === true;

  if (slug === undefined) {
    return errToResult(
      new LoomError('missing-args', 'read requires a <slug> positional'),
    );
  }

  let targetDir: string;
  try {
    targetDir = resolveProject(slug, ctx.projectsRoot);
  } catch (err) {
    return errToResult(err);
  }

  const planMdPath = join(targetDir, 'PLAN.md');
  if (!existsSync(planMdPath)) {
    return errToResult(
      new LoomError(
        'plan-not-found',
        `no PLAN.md at ${planMdPath}`,
      ),
    );
  }

  let content: string;
  try {
    content = readFileSync(planMdPath, 'utf8');
  } catch (err: unknown) {
    return errToResult(
      new LoomError(
        'plan-read-failed',
        `cannot read PLAN.md at ${planMdPath}: ${(err as Error).message}`,
      ),
    );
  }

  // --pretty short-circuits the envelope: emit raw PLAN.md content.
  // The envelope is the JSON contract for downstream introspection;
  // humans get the markdown directly.
  if (pretty) {
    return { stdout: content, exitCode: 0 };
  }

  const resolvedSlug = targetDir.split('/').pop() ?? slug;
  const interviewMdPath = join(targetDir, 'INTERVIEW.md');
  // Express paths relative to projectsRoot for stable, short
  // envelope output (e.g. `projects/2026-05-15-foo/PLAN.md` rather
  // than an absolute path). Falls back to absolute if the path
  // doesn't sit under projectsRoot.
  const relPath = relative(ctx.projectsRoot, planMdPath) || planMdPath;
  const relInterview = relative(ctx.projectsRoot, interviewMdPath) || interviewMdPath;

  return {
    stdout: JSON.stringify({
      path: relPath,
      content,
      plan: {
        slug: resolvedSlug,
        interview_path: relInterview,
      },
    }),
    exitCode: 0,
  };
}

export const DRAFT_VERBS: Record<string, VerbHandler> = {
  plan: planVerb,
  revise: reviseVerb,
  read: readVerb,
};
