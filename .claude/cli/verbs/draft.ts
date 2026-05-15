import { parseArgs } from 'node:util';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { LoomError } from '../lib/errors.ts';
import { createSlug } from '../lib/project.ts';
import { resolveTroutProject } from '../lib/draft-project.ts';
import { type GitRunner, defaultGitRunner } from '../lib/draft-git.ts';

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
      // Caller passed a full slug. Confirm the project doesn't
      // already exist before treating it as the target.
      slug = slugOrTopic;
    } else {
      slug = createSlug(slugOrTopic, todayString(ctx));
    }
  } catch (err) {
    return errToResult(err);
  }

  // Reject if the derived/given slug already names a trout project.
  try {
    resolveTroutProject(slug, ctx.projectsRoot);
    return errToResult(
      new LoomError(
        'project-already-exists',
        `a trout project already exists at slug '${slug}' — use revise to update`,
      ),
    );
  } catch (err) {
    if (!(err instanceof LoomError) || err.code !== 'project-not-found') {
      return errToResult(err);
    }
    // Falls through: not-found is the happy path here.
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

  if (!noCommit) {
    try {
      gitRunnerOf(ctx).addAndCommit(
        repoRootOf(ctx),
        [planMdPath, interviewMdPath],
        `[draft plan] ${slug}`,
      );
    } catch (err) {
      return errToResult(err);
    }
  }

  return {
    stdout: emit(
      { slug, path: targetDir, committed: !noCommit },
      pretty,
    ),
    exitCode: 0,
  };
}

// Stub handlers for revise / read. Real implementations land in
// D5 / D6. Keeping them in the registry surfaces the "not implemented"
// payload through the same dispatch path as plan rather than the
// generic verb-not-found branch — preserves the forward-compatible
// shape downstream callers expect.
function notImplemented(verb: string): VerbHandler {
  return () => {
    const payload = {
      error: 'not-implemented',
      message: `verb '${verb}' has no handler yet (D5/D6 in progress)`,
      verb,
    };
    return { stderr: JSON.stringify(payload), exitCode: 1 };
  };
}

export const DRAFT_VERBS: Record<string, VerbHandler> = {
  plan: planVerb,
  revise: notImplemented('revise'),
  read: notImplemented('read'),
};
