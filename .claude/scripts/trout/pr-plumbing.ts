#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

type State = 'fresh' | 'stale' | 'drift' | 'new';

type CheckinMeta = {
  number: number;
  path: string;
  phase: string;
  unit: string;
  goal: string;
};

type WhyCheckSourceSummary = {
  planContext: string | null;
  phaseLead: string | null;
  checkinGoalsRationale: boolean;
};

type WhyCheckResult = {
  thin: boolean;
  sourceSummary: WhyCheckSourceSummary;
};

type ExistingPR = { number: number; body: string; url: string };

type InspectResult = {
  state: State;
  disk: number[];
  markerSet: number[] | null;
  checkins: CheckinMeta[];
  pr: ExistingPR | null;
  whyCheck: WhyCheckResult;
  repo: { owner: string; name: string };
  base: string;
};

const PROJECTS_ROOT = resolve(process.cwd(), 'projects');

const RATIONALE_RE = /\b(because|so that|to ensure|to avoid|to keep|the reason|prevent|motivated by|address|fix|resolve)\b/i;

const STAGE_EXCLUDES = new Set([
  '.claude/settings.local.json',
  'next-env.d.ts',
]);

class PRPlumbingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  process.stderr.write(`pr-plumbing-error: ${code}: ${message}\n`);
  process.exit(1);
}

// ---------- Pure helpers (exported for direct unit tests) ----------

export function parseMarker(body: string): number[] | null {
  const plural = body.match(/<!--\s*project-pr-checkins:\s*([^>]*?)\s*-->/);
  if (plural) {
    const list = plural[1].trim();
    if (!list) return null;
    const tokens = list.split(',').map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return null;
    const nums: number[] = [];
    for (const t of tokens) {
      if (!/^\d+$/.test(t)) return null;
      nums.push(Number(t));
    }
    if (nums.some((n) => !Number.isInteger(n) || n <= 0)) return null;
    return nums.sort((a, b) => a - b);
  }
  const singular = body.match(/<!--\s*project-pr-checkin:\s*([^>]*?)\s*-->/);
  if (singular) {
    const tok = singular[1].trim();
    if (!/^\d+$/.test(tok)) return null;
    const n = Number(tok);
    if (!Number.isInteger(n) || n <= 0) return null;
    return [n];
  }
  return null;
}

export function compareState(markerSet: number[] | null, disk: number[]): Exclude<State, 'new'> {
  // Caller emits 'new' directly when no PR exists. compareState assumes a PR is present.
  if (markerSet === null) return 'stale';
  const M = new Set(markerSet);
  const D = new Set(disk);
  if (M.size === D.size && [...M].every((n) => D.has(n))) return 'fresh';
  if ([...M].every((n) => D.has(n))) return 'stale';
  return 'drift';
}

export function checkRationale(text: string): boolean {
  return RATIONALE_RE.test(text);
}

export function analyzeWhyCheck(
  planContext: string | null,
  phaseLead: string | null,
  phaseTitle: string,
  checkinGoals: string[],
): WhyCheckResult {
  const contextSubstantive = (() => {
    if (!planContext) return false;
    const stripped = planContext.replace(/\s+/g, ' ').trim();
    return stripped.length > 80;
  })();
  const phaseLeadBeyondTitle = (() => {
    if (!phaseLead) return false;
    const stripped = phaseLead.replace(/\s+/g, ' ').trim();
    if (stripped.length === 0) return false;
    const titleStripped = phaseTitle.replace(/\s+/g, ' ').trim();
    return stripped.length > titleStripped.length + 20;
  })();
  const goalsRationale = checkinGoals.some((g) => checkRationale(g));
  const thin = !contextSubstantive && !phaseLeadBeyondTitle && !goalsRationale;
  return {
    thin,
    sourceSummary: {
      planContext: contextSubstantive ? planContext : null,
      phaseLead: phaseLeadBeyondTitle ? phaseLead : null,
      checkinGoalsRationale: goalsRationale,
    },
  };
}

export function enumerateCheckinFiles(branchDir: string): { number: number; path: string }[] {
  if (!existsSync(branchDir)) return [];
  const entries = readdirSync(branchDir);
  const out: { number: number; path: string }[] = [];
  for (const e of entries) {
    const m = e.match(/^(\d+)\.md$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (!Number.isInteger(n) || n <= 0) continue;
    out.push({ number: n, path: join(branchDir, e) });
  }
  return out.sort((a, b) => a.number - b.number);
}

function extractField(content: string, label: string): string {
  const re = new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, 'm');
  const m = content.match(re);
  return (m?.[1] ?? '').trim();
}

function extractContractGoal(content: string): string {
  const contractIdx = content.search(/^## Contract\s*$/m);
  if (contractIdx === -1) return '';
  const rest = content.slice(contractIdx);
  const m = rest.match(/\*\*Goal\*\*:?\s*([\s\S]+?)(?=\n\s*\*\*[A-Za-z]|\n##|$)/);
  return (m?.[1] ?? '').trim();
}

export function parseCheckin(filePath: string): CheckinMeta {
  const content = readFileSync(filePath, 'utf-8');
  const m = filePath.match(/(\d+)\.md$/);
  const number = m ? Number(m[1]) : 0;
  return {
    number,
    path: filePath,
    phase: extractField(content, 'Phase'),
    unit: extractField(content, 'Unit'),
    goal: extractContractGoal(content),
  };
}

// ---------- Subprocess wrapper ----------

type RunResult = { stdout: string; stderr: string; status: number };

function runCommand(cmd: string, args: string[], opts: { cwd?: string; input?: string } = {}): RunResult {
  const res = spawnSync(cmd, args, {
    encoding: 'utf-8',
    cwd: opts.cwd,
    input: opts.input,
    stdio: opts.input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

const FAST_BACKOFF = process.env.PR_PLUMBING_FAST_BACKOFF === '1';
const BACKOFF_MS = FAST_BACKOFF ? [0, 0, 0, 0] : [2000, 4000, 8000, 16000];

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  // Synchronous sleep using Atomics.wait on a SharedArrayBuffer.
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function isNetworkError(stderr: string): boolean {
  return /(?:Could not resolve host|Connection (?:reset|refused|timed out)|network|temporarily unavailable|TLS handshake)/i.test(
    stderr,
  );
}

function pushWithRetry(branch: string): void {
  let attempt = 0;
  for (;;) {
    const args = attempt === 0 ? ['push', '-u', 'origin', branch] : ['push', 'origin', branch];
    const res = runCommand('git', args);
    if (res.status === 0) return;
    if (!isNetworkError(res.stderr) || attempt >= BACKOFF_MS.length) {
      process.stderr.write(res.stderr);
      throw new PRPlumbingError('push-failed', `git push failed (attempt ${attempt + 1}): ${res.stderr.trim()}`);
    }
    sleepSync(BACKOFF_MS[attempt]);
    attempt += 1;
  }
}

// ---------- Project resolution ----------

function resolveSlug(arg: string): { slug: string; dir: string } {
  if (arg.includes('/')) {
    const dir = resolve(arg);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      fail('slug-unresolved', `not a directory: ${arg}`);
    }
    const slug = dir.split('/').pop() as string;
    return { slug, dir };
  }
  const exact = join(PROJECTS_ROOT, arg);
  if (existsSync(exact) && statSync(exact).isDirectory()) {
    return { slug: arg, dir: exact };
  }
  if (!existsSync(PROJECTS_ROOT)) {
    fail('slug-unresolved', `projects/ does not exist`);
  }
  const candidates = readdirSync(PROJECTS_ROOT)
    .filter((d) => d.endsWith(arg) && statSync(join(PROJECTS_ROOT, d)).isDirectory());
  if (candidates.length === 1) {
    const slug = candidates[0];
    return { slug, dir: join(PROJECTS_ROOT, slug) };
  }
  if (candidates.length === 0) {
    fail('slug-unresolved', `no project matches: ${arg}`);
  }
  fail('slug-ambiguous', `multiple matches for ${arg}: ${candidates.join(', ')}`);
}

// ---------- Repo + config parsing ----------

function parseRepoFromGitRemote(): { owner: string; name: string } {
  const res = runCommand('git', ['config', '--get', 'remote.origin.url']);
  if (res.status !== 0) fail('repo-unresolved', `git remote origin not set`);
  const url = res.stdout.trim();
  // Match git@github.com:owner/repo.git OR https://github.com/owner/repo(.git)
  // Repo name may contain dots (e.g. aart.camp), so strip a trailing .git first
  // and then accept any non-slash characters.
  const stripped = url.replace(/\.git$/, '');
  const ssh = stripped.match(/^[^:]+:([^/]+)\/([^/]+)$/);
  if (ssh) return { owner: ssh[1], name: ssh[2] };
  const https = stripped.match(/github\.com\/([^/]+)\/([^/]+)$/);
  if (https) return { owner: https[1], name: https[2] };
  fail('repo-unresolved', `cannot parse repo from remote URL: ${url}`);
}

function parseConfigBase(projectDir: string): string {
  const cfgPath = join(projectDir, 'config.md');
  if (!existsSync(cfgPath)) return 'main';
  const content = readFileSync(cfgPath, 'utf-8');
  const m = content.match(/^-?\s*Base branch:\s*(.+)$/m);
  return m ? m[1].trim() : 'main';
}

// ---------- Why-check source extraction ----------

function extractTopContext(planMd: string): string | null {
  const re = /^##\s+Context\s*$/m;
  const idx = planMd.search(re);
  if (idx === -1) return null;
  const rest = planMd.slice(idx).split('\n').slice(1).join('\n');
  const next = rest.search(/^##\s+/m);
  const body = next === -1 ? rest : rest.slice(0, next);
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractPhaseEntry(planMd: string, phase: string): { lead: string; title: string } | null {
  if (!phase) return null;
  const escaped = phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Phase entries look like `### Phase 1.5: Title` followed by paragraphs.
  const re = new RegExp(`^###\\s+Phase\\s+${escaped}\\s*:\\s*(.+)$`, 'm');
  const match = planMd.match(re);
  if (!match || match.index === undefined) return null;
  const title = match[1].trim();
  const after = planMd.slice(match.index + match[0].length);
  const next = after.search(/^###\s+/m);
  const body = (next === -1 ? after : after.slice(0, next)).trim();
  // Lead paragraph = first paragraph (until blank line or list marker).
  const para = body.split(/\n\s*\n/)[0]?.trim() ?? '';
  return { lead: para, title };
}

// ---------- gh helpers ----------

function ghFindOpenPR(
  repo: { owner: string; name: string },
  branch: string,
): { number: number; url: string } | null {
  const res = runCommand('gh', [
    'pr', 'list',
    '--repo', `${repo.owner}/${repo.name}`,
    '--head', branch,
    '--state', 'open',
    '--json', 'number,url',
  ]);
  if (res.status !== 0) {
    fail('gh-list-failed', res.stderr.trim() || `gh pr list failed`);
  }
  let parsed: Array<{ number: number; url: string }>;
  try {
    parsed = JSON.parse(res.stdout || '[]');
  } catch {
    fail('gh-list-failed', `gh pr list emitted non-JSON output`);
  }
  if (parsed.length === 0) return null;
  return parsed[0];
}

function ghReadPRBody(repo: { owner: string; name: string }, number: number): string {
  const res = runCommand('gh', [
    'pr', 'view', String(number),
    '--repo', `${repo.owner}/${repo.name}`,
    '--json', 'body',
  ]);
  if (res.status !== 0) {
    fail('gh-view-failed', res.stderr.trim() || `gh pr view failed`);
  }
  try {
    const parsed = JSON.parse(res.stdout) as { body: string };
    return parsed.body ?? '';
  } catch {
    fail('gh-view-failed', `gh pr view emitted non-JSON output`);
  }
}

function ghCreatePR(args: {
  repo: { owner: string; name: string };
  base: string;
  head: string;
  title: string;
  bodyFile: string;
}): { number: number; url: string } {
  const res = runCommand('gh', [
    'pr', 'create',
    '--repo', `${args.repo.owner}/${args.repo.name}`,
    '--base', args.base,
    '--head', args.head,
    '--title', args.title,
    '--body-file', args.bodyFile,
  ]);
  if (res.status !== 0) {
    fail('gh-create-failed', res.stderr.trim() || `gh pr create failed`);
  }
  const url = res.stdout.trim().split('\n').filter(Boolean).pop() ?? '';
  const m = url.match(/\/pull\/(\d+)/);
  if (!m) fail('gh-create-failed', `gh pr create emitted unparseable URL: ${url}`);
  return { number: Number(m[1]), url };
}

function ghEditPR(args: {
  repo: { owner: string; name: string };
  number: number;
  title: string;
  bodyFile: string;
}): void {
  const res = runCommand('gh', [
    'pr', 'edit', String(args.number),
    '--repo', `${args.repo.owner}/${args.repo.name}`,
    '--title', args.title,
    '--body-file', args.bodyFile,
  ]);
  if (res.status !== 0) {
    fail('gh-edit-failed', res.stderr.trim() || `gh pr edit failed`);
  }
}

// ---------- Verbs ----------

function verbInspect(slugArg: string, branch: string): void {
  const { slug, dir } = resolveSlug(slugArg);
  if (!branch) fail('args', `branch is required`);

  const verifyBranch = runCommand('git', ['rev-parse', '--verify', branch]);
  if (verifyBranch.status !== 0) {
    fail('branch-missing', `branch does not exist: ${branch}`);
  }

  const branchDir = join(dir, 'checkins', branch);
  const files = enumerateCheckinFiles(branchDir);
  const checkins: CheckinMeta[] = files.map((f) => parseCheckin(f.path));
  const disk = files.map((f) => f.number);

  const repo = parseRepoFromGitRemote();
  const base = parseConfigBase(dir);
  const existing = ghFindOpenPR(repo, branch);
  let pr: ExistingPR | null = null;
  let markerSet: number[] | null = null;
  let state: State;
  if (existing === null) {
    state = 'new';
  } else {
    const body = ghReadPRBody(repo, existing.number);
    pr = { number: existing.number, url: existing.url, body };
    markerSet = parseMarker(body);
    state = compareState(markerSet, disk);
  }

  const planPath = join(dir, 'PLAN.md');
  const planMd = existsSync(planPath) ? readFileSync(planPath, 'utf-8') : '';
  const planContext = extractTopContext(planMd);
  const firstPhase = checkins[0]?.phase ?? '';
  const phaseEntry = extractPhaseEntry(planMd, firstPhase);
  const checkinGoals = checkins.map((c) => c.goal);
  const whyCheck = analyzeWhyCheck(
    planContext,
    phaseEntry?.lead ?? null,
    phaseEntry?.title ?? '',
    checkinGoals,
  );

  const result: InspectResult = {
    state,
    disk,
    markerSet,
    checkins,
    pr,
    whyCheck,
    repo,
    base,
  };
  process.stdout.write(JSON.stringify(result) + '\n');
  void slug;
}

export function selectStagePaths(slug: string, branch: string, changed: string[], untracked: string[]): string[] {
  const checkinPrefix = `projects/${slug}/checkins/${branch}/`;
  const paths: string[] = [];
  for (const path of changed) {
    if (!path) continue;
    if (STAGE_EXCLUDES.has(path)) continue;
    paths.push(path);
  }
  for (const path of untracked) {
    if (!path) continue;
    if (STAGE_EXCLUDES.has(path)) continue;
    // Untracked: stage new checkin files for this branch, OR new code/skill/script files
    // (anything outside projects/ that isn't excluded). Avoid staging stray files that
    // happen to live under projects/ but aren't part of this branch's checkin set.
    if (path.startsWith('projects/')) {
      if (path.startsWith(checkinPrefix) && /\d+\.md$/.test(path)) paths.push(path);
      continue;
    }
    paths.push(path);
  }
  return paths;
}

function verbCommit(slugArg: string, branch: string, message: string, noPush: boolean): void {
  if (!message) fail('args', `--message is required and must be non-empty`);
  const { slug } = resolveSlug(slugArg);

  const diffRes = runCommand('git', ['diff', '--name-only', 'HEAD']);
  if (diffRes.status !== 0) fail('git-status-failed', diffRes.stderr.trim() || `git diff failed`);
  const lsRes = runCommand('git', ['ls-files', '--others', '--exclude-standard']);
  if (lsRes.status !== 0) fail('git-status-failed', lsRes.stderr.trim() || `git ls-files failed`);
  const changed = diffRes.stdout.split('\n').filter(Boolean);
  const untracked = lsRes.stdout.split('\n').filter(Boolean);
  const paths = selectStagePaths(slug, branch, changed, untracked);
  if (paths.length === 0) {
    process.stdout.write('no-op\n');
    return;
  }

  const addRes = runCommand('git', ['add', '--', ...paths]);
  if (addRes.status !== 0) fail('git-add-failed', addRes.stderr.trim());

  const commitRes = runCommand('git', ['commit', '-m', message]);
  if (commitRes.status !== 0) fail('git-commit-failed', commitRes.stderr.trim());

  const shaRes = runCommand('git', ['rev-parse', 'HEAD']);
  const sha = shaRes.status === 0 ? shaRes.stdout.trim().slice(0, 7) : 'unknown';

  if (noPush) {
    process.stdout.write(`${sha} commit-only\n`);
    return;
  }

  pushWithRetry(branch);
  process.stdout.write(`${sha} pushed\n`);
}

function verbPush(branch: string): void {
  if (!branch) fail('args', `branch is required`);
  pushWithRetry(branch);
  const sha = runCommand('git', ['rev-parse', 'HEAD']).stdout.trim().slice(0, 7);
  process.stdout.write(`pushed ${branch} @ ${sha}\n`);
}

function verbSubmit(
  slugArg: string,
  branch: string,
  title: string,
  bodyFile: string,
  phaseUpdate: string | undefined,
): void {
  if (!title) fail('args', `--title is required`);
  if (!bodyFile) fail('args', `--body-file is required`);
  if (!existsSync(bodyFile)) fail('args', `body file not found: ${bodyFile}`);

  const { slug, dir } = resolveSlug(slugArg);
  const repo = parseRepoFromGitRemote();
  const base = parseConfigBase(dir);

  const branchDir = join(dir, 'checkins', branch);
  const checkinFiles = enumerateCheckinFiles(branchDir);
  const checkinList = checkinFiles.map((f) => String(f.number).padStart(2, '0')).join(',');

  const existing = ghFindOpenPR(repo, branch);
  let prNumber: number;
  let event: 'pr-opened' | 'pr-updated';
  let trackingMessage: string;
  if (existing === null) {
    const created = ghCreatePR({ repo, base, head: branch, title, bodyFile });
    prNumber = created.number;
    event = 'pr-opened';
    trackingMessage = `Track PR #${prNumber} opened from checkin${checkinFiles.length === 1 ? '' : 's'} ${checkinList} in MANIFEST`;
  } else {
    ghEditPR({ repo, number: existing.number, title, bodyFile });
    prNumber = existing.number;
    event = 'pr-updated';
    trackingMessage = `Track PR #${prNumber} re-author for checkin${checkinFiles.length === 1 ? '' : 's'} ${checkinList} in MANIFEST`;
  }

  // Run autosave (resolve relative to this script's own location, not cwd, so
  // tests running from a fixture cwd still find the real autosave).
  const selfPath = import.meta.url.replace(/^file:\/\//, '');
  const autosavePath = resolve(selfPath, '..', 'autosave.ts');
  const autosaveArgs = [
    autosavePath,
    slug,
    `--event=${event}`,
    `--detail=#${prNumber}`,
  ];
  if (phaseUpdate) autosaveArgs.push(`--phase-update=${phaseUpdate}`);
  const autosaveRes = runCommand('node', autosaveArgs);
  if (autosaveRes.status !== 0) {
    process.stderr.write(autosaveRes.stderr);
    fail('autosave-failed', `autosave invocation failed for ${event} #${prNumber}`);
  }

  // Commit MANIFEST + push
  const manifestRel = `projects/${slug}/MANIFEST.md`;
  const addRes = runCommand('git', ['add', '--', manifestRel]);
  if (addRes.status !== 0) fail('git-add-failed', addRes.stderr.trim());

  const commitRes = runCommand('git', ['commit', '-m', trackingMessage]);
  if (commitRes.status !== 0) fail('git-commit-failed', commitRes.stderr.trim());

  pushWithRetry(branch);

  process.stdout.write(`pr: ${event === 'pr-opened' ? 'created' : 'updated'} #${prNumber}\n`);
}

// ---------- Entry ----------

function main(): void {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  if (!verb) {
    process.stderr.write(`pr-plumbing-error: usage: <inspect|commit|push|submit> ...\n`);
    process.exit(1);
  }

  const rest = argv.slice(1);

  try {
    if (verb === 'inspect') {
      const { positionals } = parseArgs({ options: {}, allowPositionals: true, args: rest });
      const [slug, branch] = positionals;
      verbInspect(slug, branch);
      return;
    }
    if (verb === 'commit') {
      const { values, positionals } = parseArgs({
        options: { message: { type: 'string' }, 'no-push': { type: 'boolean' } },
        allowPositionals: true,
        args: rest,
      });
      const [slug, branch] = positionals;
      verbCommit(slug, branch, (values.message as string) ?? '', Boolean(values['no-push']));
      return;
    }
    if (verb === 'push') {
      const { positionals } = parseArgs({ options: {}, allowPositionals: true, args: rest });
      const [branch] = positionals;
      verbPush(branch);
      return;
    }
    if (verb === 'submit') {
      const { values, positionals } = parseArgs({
        options: {
          title: { type: 'string' },
          'body-file': { type: 'string' },
          'phase-update': { type: 'string' },
        },
        allowPositionals: true,
        args: rest,
      });
      const [slug, branch] = positionals;
      verbSubmit(
        slug,
        branch,
        (values.title as string) ?? '',
        (values['body-file'] as string) ?? '',
        values['phase-update'] as string | undefined,
      );
      return;
    }
    fail('unknown-verb', `unknown verb: ${verb}`);
  } catch (err) {
    if (err instanceof PRPlumbingError) {
      fail(err.code, err.message);
    }
    throw err;
  }
}

// Run only when invoked directly
const invoked = resolve(process.argv[1] ?? '');
const self = resolve(import.meta.url.replace(/^file:\/\//, ''));
if (invoked === self) {
  main();
}
