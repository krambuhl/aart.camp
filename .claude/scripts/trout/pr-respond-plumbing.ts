#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ProjectResolveError, resolveProject } from './resolve-project.ts';

class PrRespondError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`pr-respond-plumbing-error: ${reason}\n`);
  process.exit(1);
}

// ---------- Pure helpers (exported for direct unit tests) ----------

export function nextResponseNumber(checkinDir: string): string {
  if (!existsSync(checkinDir)) return '01';
  const re = /^(?:response-)?(\d+)\.md$/;
  let max = 0;
  for (const name of readdirSync(checkinDir)) {
    const m = name.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return String(max + 1).padStart(2, '0');
}

// ---------- Subprocess wrapper ----------

type RunResult = { stdout: string; stderr: string; status: number; spawnError: boolean };

function runCommand(cmd: string, args: string[]): RunResult {
  const res = spawnSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
    spawnError: res.error !== undefined && (res.error as NodeJS.ErrnoException).code === 'ENOENT',
  };
}

function ghJson<T>(args: string[], context: string): T {
  const r = runCommand('gh', args);
  if (r.spawnError) fail(`gh CLI not found; install GitHub CLI`);
  if (r.status !== 0) fail(`${context}: ${(r.stderr || r.stdout).trim() || `gh exited with status ${r.status}`}`);
  try { return JSON.parse(r.stdout); } catch {
    fail(`gh returned unparseable JSON (${context}): ${(r.stderr || r.stdout).slice(0, 200)}`);
  }
}

// ---------- gh data shapes ----------

type PRView = {
  number: number;
  url: string;
  state: string;
  headRefName: string;
  title: string;
  statusCheckRollup?: Array<{ __typename?: string; name?: string; conclusion?: string; status?: string; detailsUrl?: string; targetUrl?: string; context?: string; state?: string }>;
};

type IssueComment = { user?: { login?: string }; body?: string; html_url?: string; created_at?: string };
type Review = { user?: { login?: string }; body?: string; state?: string; html_url?: string; submitted_at?: string };
type ReviewComment = { user?: { login?: string }; body?: string; html_url?: string; created_at?: string; path?: string; line?: number | null; original_line?: number | null };

// ---------- Item assembly ----------

// Each item kind carries its own typed location-replacement fields rather
// than packing four different meanings into a single `location: string`.
// Consumers (the `/trout-pr-respond` skill body, future automation) discriminate
// on `kind` and read the kind-specific fields directly — no string parsing.
type Item =
  | { kind: 'issue-comment'; source: string; body: string; url: string | null }
  | { kind: 'review'; source: string; body: string; state: string; url: string | null }
  | { kind: 'review-comment'; source: string; body: string; path: string; line: number; url: string | null }
  | { kind: 'ci-failure'; source: 'ci'; body: string; checkName: string; url: string | null };

const FAILING_CONCLUSIONS = new Set(['FAILURE', 'failure', 'CANCELLED', 'cancelled', 'TIMED_OUT', 'timed_out']);

function buildItems(pr: PRView, issueComments: IssueComment[], reviews: Review[], reviewComments: ReviewComment[]): Item[] {
  const items: Item[] = [];
  const sortByDate = <T extends { created_at?: string; submitted_at?: string }>(arr: T[], key: 'created_at' | 'submitted_at') =>
    [...arr].sort((a, b) => (a[key] ?? '').localeCompare(b[key] ?? ''));

  for (const c of sortByDate(issueComments, 'created_at')) {
    items.push({ kind: 'issue-comment', source: c.user?.login ?? 'unknown', body: c.body ?? '', url: c.html_url ?? null });
  }
  for (const r of sortByDate(reviews, 'submitted_at')) {
    items.push({ kind: 'review', source: r.user?.login ?? 'unknown', body: r.body ?? '', state: r.state ?? 'COMMENTED', url: r.html_url ?? null });
  }
  for (const rc of sortByDate(reviewComments, 'created_at')) {
    const line = rc.line ?? rc.original_line ?? 0;
    items.push({ kind: 'review-comment', source: rc.user?.login ?? 'unknown', body: rc.body ?? '', path: rc.path ?? '<unknown>', line, url: rc.html_url ?? null });
  }
  const failing = (pr.statusCheckRollup ?? []).filter((c) => {
    const conc = (c.conclusion ?? c.state ?? '').toString();
    return FAILING_CONCLUSIONS.has(conc);
  });
  failing.sort((a, b) => (a.name ?? a.context ?? '').localeCompare(b.name ?? b.context ?? ''));
  for (const c of failing) {
    const checkName = c.name ?? c.context ?? 'unknown-check';
    items.push({ kind: 'ci-failure', source: 'ci', body: `${c.conclusion ?? c.state ?? 'failure'}: see check details`, checkName, url: c.detailsUrl ?? c.targetUrl ?? null });
  }
  return items;
}

// ---------- Verbs ----------

function verbFetch(slug: string, prArg: string): void {
  const prNumber = parseInt(prArg, 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) fail(`<pr-number> must be a positive integer; got "${prArg}"`);
  const projectPath = (() => { try { return resolveProject(slug); } catch (err) { if (err instanceof ProjectResolveError || err instanceof PrRespondError) fail(err.message); throw err; } })();

  const repo = ghJson<{ owner: { login: string }; name: string }>(['repo', 'view', '--json', 'owner,name'], 'fetching repo info');
  const owner = repo.owner.login;
  const name = repo.name;

  const pr = ghJson<PRView>(['pr', 'view', String(prNumber), '--json', 'number,url,state,headRefName,title,statusCheckRollup'], `fetching pr ${prNumber}`);
  const branch = pr.headRefName;
  const checkinDir = join(projectPath, 'checkins', branch);
  if (!existsSync(checkinDir)) fail(`pr ${prNumber} belongs to branch ${branch}; no checkins/${branch}/ directory found in project ${slug}`);

  const issueComments = ghJson<IssueComment[]>(['api', `repos/${owner}/${name}/issues/${prNumber}/comments`], `fetching issue comments`);
  const reviews = ghJson<Review[]>(['api', `repos/${owner}/${name}/pulls/${prNumber}/reviews`], `fetching reviews`);
  const reviewComments = ghJson<ReviewComment[]>(['api', `repos/${owner}/${name}/pulls/${prNumber}/comments`], `fetching review comments`);

  const items = buildItems(pr, issueComments, reviews, reviewComments);
  const nn = nextResponseNumber(checkinDir);
  const responsePath = relative(process.cwd(), join(checkinDir, `response-${nn}.md`));

  process.stdout.write(JSON.stringify({
    pr: { number: pr.number, url: pr.url, state: pr.state, branch, title: pr.title },
    items,
    next_response_number: nn,
    response_path: responsePath,
  }) + '\n');
}

function verbWritePlan(slug: string, prArg: string, contentFile: string): void {
  const prNumber = parseInt(prArg, 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) fail(`<pr-number> must be a positive integer; got "${prArg}"`);
  const resolvedContent = resolve(contentFile);
  if (!existsSync(resolvedContent)) fail(`content file not found: ${contentFile}`);
  const projectPath = (() => { try { return resolveProject(slug); } catch (err) { if (err instanceof ProjectResolveError || err instanceof PrRespondError) fail(err.message); throw err; } })();

  const pr = ghJson<{ headRefName: string }>(['pr', 'view', String(prNumber), '--json', 'headRefName'], `fetching pr ${prNumber}`);
  const branch = pr.headRefName;
  const checkinDir = join(projectPath, 'checkins', branch);
  if (!existsSync(checkinDir)) fail(`pr ${prNumber} belongs to branch ${branch}; no checkins/${branch}/ directory found in project ${slug}`);

  const nn = nextResponseNumber(checkinDir);
  const targetPath = join(checkinDir, `response-${nn}.md`);
  writeFileSync(targetPath, readFileSync(resolvedContent, 'utf-8'));

  process.stdout.write(`response-plan-written: ${relative(process.cwd(), targetPath)}\n`);
}

// ---------- Main ----------

function main(): void {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const rest = argv.slice(1);
  if (!verb) fail(`usage: <fetch|write-plan> <slug> <pr-number> [verb-args]`);

  if (verb === 'fetch') {
    const { positionals } = parseArgs({ options: {}, allowPositionals: true, args: rest });
    if (positionals.length !== 2) fail(`fetch: expected <slug> <pr-number>, got ${positionals.length} args`);
    verbFetch(positionals[0], positionals[1]);
    return;
  }
  if (verb === 'write-plan') {
    const { values, positionals } = parseArgs({ options: { 'content-file': { type: 'string' } }, allowPositionals: true, args: rest });
    if (positionals.length !== 2) fail(`write-plan: expected <slug> <pr-number>, got ${positionals.length} positional args`);
    const contentFile = values['content-file'] as string | undefined;
    if (!contentFile) fail(`write-plan: --content-file is required`);
    verbWritePlan(positionals[0], positionals[1], contentFile);
    return;
  }
  fail(`unknown verb "${verb}"; expected fetch|write-plan`);
}

main();
