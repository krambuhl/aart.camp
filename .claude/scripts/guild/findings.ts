#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';

const USAGE = [
  'usage:',
  "  findings.ts append --slug=<slug> --evaluator=<name> --code=<code> --evidence=<text> [--severity=blocking|advisory] [--branch=<name>] [--unit=<NN>]",
  "  findings.ts count  --slug=<slug> --evaluator=<name> --code=<code> --evidence=<text>",
].join('\n');

function fail(reason: string): never {
  process.stderr.write(`findings-error: ${reason}\n${USAGE}\n`);
  process.exit(1);
}

function normalizeEvidence(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function signatureFor(evaluator: string, code: string, evidence: string): string {
  return createHash('sha1')
    .update(`${evaluator}\n${code}\n${normalizeEvidence(evidence)}`)
    .digest('hex');
}

function jsonlPathFor(slug: string): string {
  return resolve(process.cwd(), 'projects', slug, '.guild-findings.jsonl');
}

function projectDirFor(slug: string): string {
  return resolve(process.cwd(), 'projects', slug);
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
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const v = parsed.values;
  const slug = v.slug as string | undefined;
  const evaluator = v.evaluator as string | undefined;
  const code = v.code as string | undefined;
  const evidence = v.evidence as string | undefined;
  const severityRaw = (v.severity as string | undefined) ?? 'blocking';
  if (!slug) fail('--slug=<slug> is required');
  if (!evaluator) fail('--evaluator=<name> is required');
  if (code === undefined) fail('--code=<code> is required');
  if (evidence === undefined) fail('--evidence=<text> is required');
  if (severityRaw !== 'blocking' && severityRaw !== 'advisory') {
    fail("--severity must be 'blocking' or 'advisory'");
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
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const v = parsed.values;
  const slug = v.slug as string | undefined;
  const evaluator = v.evaluator as string | undefined;
  const code = v.code as string | undefined;
  const evidence = v.evidence as string | undefined;
  if (!slug) fail('--slug=<slug> is required');
  if (!evaluator) fail('--evaluator=<name> is required');
  if (code === undefined) fail('--code=<code> is required');
  if (evidence === undefined) fail('--evidence=<text> is required');
  return { slug, evaluator, code, evidence };
}

function appendVerb(rawArgs: string[]): void {
  const args = parseAppendArgs(rawArgs);
  const projectDir = projectDirFor(args.slug);
  if (!existsSync(projectDir)) {
    fail(`project directory not found: projects/${args.slug}/`);
  }
  try {
    if (!statSync(projectDir).isDirectory()) {
      fail(`project directory not found: projects/${args.slug}/ (not a directory)`);
    }
  } catch {
    fail(`project directory not found: projects/${args.slug}/`);
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

  appendFileSync(jsonlPathFor(args.slug), JSON.stringify(row) + '\n');
  process.stdout.write(`findings-append: 1 row appended to projects/${args.slug}/.guild-findings.jsonl (signature ${row.signature.slice(0, 12)}...)\n`);
}

function countVerb(rawArgs: string[]): void {
  const args = parseCountArgs(rawArgs);
  const target = signatureFor(args.evaluator, args.code, args.evidence);
  const path = jsonlPathFor(args.slug);
  if (!existsSync(path)) {
    process.stdout.write('0\n');
    return;
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
  process.stdout.write(`${count}\n`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const rest = argv.slice(1);
  if (verb === 'append') {
    appendVerb(rest);
    return;
  }
  if (verb === 'count') {
    countVerb(rest);
    return;
  }
  if (!verb) {
    fail('missing verb');
  }
  fail(`unknown verb '${verb}'`);
}

main();
