import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { DispatchResult, GuildCliContext } from './index.ts';

const USAGE = [
  'usage:',
  '  findings append --slug=<slug> --evaluator=<name> --code=<code> --evidence=<text> [--severity=blocking|advisory] [--branch=<name>] [--unit=<NN>]',
  '  findings count  --slug=<slug> --evaluator=<name> --code=<code> --evidence=<text>',
].join('\n');

function fail(reason: string): DispatchResult {
  return {
    stderr: `findings-error: ${reason}\n${USAGE}`,
    exitCode: 1,
  };
}

class ValidationError extends Error {}

function normalizeEvidence(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function signatureFor(evaluator: string, code: string, evidence: string): string {
  return createHash('sha1')
    .update(`${evaluator}\n${code}\n${normalizeEvidence(evidence)}`)
    .digest('hex');
}

function jsonlPathFor(cwd: string, slug: string): string {
  return resolve(cwd, 'projects', slug, '.guild-findings.jsonl');
}

function projectDirFor(cwd: string, slug: string): string {
  return resolve(cwd, 'projects', slug);
}

function timestamp(): string {
  return new Date().toISOString();
}

type AppendArgs = {
  slug: string;
  evaluator: string;
  code: string;
  evidence: string;
  severity: 'blocking' | 'advisory';
  branch: string | undefined;
  unit: string | undefined;
};

function parseAppendArgs(rawArgs: string[]): AppendArgs {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        slug: { type: 'string' },
        evaluator: { type: 'string' },
        code: { type: 'string' },
        evidence: { type: 'string' },
        severity: { type: 'string' },
        branch: { type: 'string' },
        unit: { type: 'string' },
      },
      allowPositionals: false,
      args: rawArgs,
    });
  } catch (err) {
    throw new ValidationError(`argument parse failure: ${(err as Error).message}`);
  }
  const v = parsed.values;
  const slug = v.slug as string | undefined;
  const evaluator = v.evaluator as string | undefined;
  const code = v.code as string | undefined;
  const evidence = v.evidence as string | undefined;
  const severityRaw = (v.severity as string | undefined) ?? 'blocking';
  if (!slug) throw new ValidationError('--slug=<slug> is required');
  if (!evaluator) throw new ValidationError('--evaluator=<name> is required');
  if (code === undefined) throw new ValidationError('--code=<code> is required');
  if (evidence === undefined) throw new ValidationError('--evidence=<text> is required');
  if (severityRaw !== 'blocking' && severityRaw !== 'advisory') {
    throw new ValidationError("--severity must be 'blocking' or 'advisory'");
  }
  return {
    slug,
    evaluator,
    code,
    evidence,
    severity: severityRaw,
    branch: v.branch as string | undefined,
    unit: v.unit as string | undefined,
  };
}

type CountArgs = {
  slug: string;
  evaluator: string;
  code: string;
  evidence: string;
};

function parseCountArgs(rawArgs: string[]): CountArgs {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        slug: { type: 'string' },
        evaluator: { type: 'string' },
        code: { type: 'string' },
        evidence: { type: 'string' },
      },
      allowPositionals: false,
      args: rawArgs,
    });
  } catch (err) {
    throw new ValidationError(`argument parse failure: ${(err as Error).message}`);
  }
  const v = parsed.values;
  const slug = v.slug as string | undefined;
  const evaluator = v.evaluator as string | undefined;
  const code = v.code as string | undefined;
  const evidence = v.evidence as string | undefined;
  if (!slug) throw new ValidationError('--slug=<slug> is required');
  if (!evaluator) throw new ValidationError('--evaluator=<name> is required');
  if (code === undefined) throw new ValidationError('--code=<code> is required');
  if (evidence === undefined) throw new ValidationError('--evidence=<text> is required');
  return { slug, evaluator, code, evidence };
}

function appendSubverb(rawArgs: string[], cwd: string): DispatchResult {
  let args: AppendArgs;
  try {
    args = parseAppendArgs(rawArgs);
  } catch (err) {
    if (err instanceof ValidationError) return fail(err.message);
    throw err;
  }
  const projectDir = projectDirFor(cwd, args.slug);
  if (!existsSync(projectDir)) {
    return fail(`project directory not found: projects/${args.slug}/`);
  }
  try {
    if (!statSync(projectDir).isDirectory()) {
      return fail(
        `project directory not found: projects/${args.slug}/ (not a directory)`,
      );
    }
  } catch {
    return fail(`project directory not found: projects/${args.slug}/`);
  }

  const row = {
    ts: timestamp(),
    slug: args.slug,
    branch: args.branch ?? null,
    unit: args.unit ?? null,
    evaluator: args.evaluator,
    code: args.code,
    signature: signatureFor(args.evaluator, args.code, args.evidence),
    evidence: args.evidence,
    severity: args.severity,
  };

  appendFileSync(jsonlPathFor(cwd, args.slug), `${JSON.stringify(row)}\n`);
  return {
    stdout: `findings-append: 1 row appended to projects/${args.slug}/.guild-findings.jsonl (signature ${row.signature.slice(0, 12)}...)`,
    exitCode: 0,
  };
}

function countSubverb(rawArgs: string[], cwd: string): DispatchResult {
  let args: CountArgs;
  try {
    args = parseCountArgs(rawArgs);
  } catch (err) {
    if (err instanceof ValidationError) return fail(err.message);
    throw err;
  }
  const target = signatureFor(args.evaluator, args.code, args.evidence);
  const path = jsonlPathFor(cwd, args.slug);
  if (!existsSync(path)) {
    return { stdout: '0', exitCode: 0 };
  }
  const text = readFileSync(path, 'utf-8');
  let count = 0;
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    let row: { signature?: string };
    try {
      row = JSON.parse(line);
    } catch {
      // Skip malformed rows rather than crash — matches PLAN.md's
      // skip-and-log stance for the strict parser.
      continue;
    }
    if (row.signature === target) count += 1;
  }
  return { stdout: `${count}`, exitCode: 0 };
}

export function findingsVerb(
  rest: string[],
  ctx: GuildCliContext,
): DispatchResult {
  const subverb = rest[0];
  const rawArgs = rest.slice(1);
  if (!subverb) return fail('missing verb');
  if (subverb === 'append') return appendSubverb(rawArgs, ctx.cwd);
  if (subverb === 'count') return countSubverb(rawArgs, ctx.cwd);
  return fail(`unknown verb '${subverb}'`);
}
