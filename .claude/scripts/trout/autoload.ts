#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { PROJECTS_ROOT, ProjectResolveError, resolveProject } from './resolve-project.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const AUTOSAVE_PATH = join(SCRIPT_DIR, 'autosave.ts');

type Phase = {
  num: string;
  name: string;
  status: string;
  branch: string;
  checkin: string;
  pr: string;
};

type Manifest = {
  title: string;
  slug: string;
  status: string;
  currentBranch: string;
  latestCheckin: string;
  phasesTable: string;
  phases: Phase[];
  currentState: string;
};

type Config = {
  verification: string[];
  prBase: string;
};

type Session = {
  filename: string;
  openThreads: string;
};

type Checkin = {
  num: string;
  created: string;
  unit: string;
  verdict: string;
  notesGist: string;
};

const CONVENTIONS_PATH = resolve(PROJECTS_ROOT, 'CONVENTIONS.md');

// Hardcoded fallback used only if CONVENTIONS.md is unreadable. Source
// of truth is the `**Status values for a phase**` line in CONVENTIONS.md,
// parsed at runtime — this list mirrors it but is not the authority.
const FALLBACK_PHASE_STATUSES = ['not-started', 'in-progress', 'blocked', 'completed'];

const ARG_HINT = '<project-slug-or-path>';

class AutoloadError extends Error {
  candidates?: string[];
  constructor(message: string, candidates?: string[]) {
    super(message);
    this.candidates = candidates;
  }
}

function fail(reason: string, candidates?: string[]): never {
  let line = `autoload-error: ${reason}`;
  if (candidates && candidates.length > 0) {
    line += `; candidates: ${candidates.join(', ')}`;
  }
  process.stderr.write(line + '\n');
  process.exit(1);
}

function parseArguments(argv: string[]): { slug?: string; reconcile: boolean } {
  let parsed;
  try {
    parsed = parseArgs({
      options: { reconcile: { type: 'boolean', default: false } },
      allowPositionals: true,
      args: argv,
    });
  } catch (err) {
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const { positionals, values } = parsed;
  if (positionals.length > 1) {
    fail(`unexpected extra positional arguments: ${positionals.slice(1).join(' ')}`);
  }
  return { slug: positionals[0], reconcile: Boolean(values.reconcile) };
}

function listActiveProjects(): string[] {
  if (!existsSync(PROJECTS_ROOT)) return [];
  return readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .sort();
}

function resolveProjectOrFail(slug: string): string {
  try {
    return resolveProject(slug);
  } catch (err) {
    // err.message already inlines `; candidates: …` for ambiguous slugs, so
    // do not pass candidates separately or fail() would double-append it.
    if (err instanceof ProjectResolveError) fail(err.message);
    throw err;
  }
}

function parseRowCells(line: string): string[] | null {
  if (!line.startsWith('|')) return null;
  if (line.match(/^\|\s*-+/)) return null;
  if (line.match(/^\| #/) || line.match(/^\| When/)) return null;
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function parseManifest(content: string, knownPhaseStatuses: string[]): Manifest {
  const titleMatch = content.match(/^# Project: (.+)$/m);
  if (!titleMatch) throw new AutoloadError('manifest missing # Project: header');
  const title = titleMatch[1].trim();

  const slug = (content.match(/^\*\*Slug\*\*: (.+)$/m)?.[1] ?? '').trim();
  const status = (content.match(/^\*\*Status\*\*: (.+)$/m)?.[1] ?? 'active').trim();
  const currentBranch = (content.match(/^\*\*Current branch\*\*: (.+)$/m)?.[1] ?? '—').trim();
  const latestCheckin = (content.match(/^\*\*Latest checkin\*\*: (.+)$/m)?.[1] ?? '—').trim();

  const phasesIdx = content.indexOf('\n## Phases');
  if (phasesIdx === -1) throw new AutoloadError('manifest missing ## Phases section');
  const dependenciesIdx = content.indexOf('\n## Dependencies', phasesIdx);
  const phasesEnd = dependenciesIdx === -1 ? content.length : dependenciesIdx;
  const phasesSection = content.slice(phasesIdx, phasesEnd);
  const phasesTable = extractTable(phasesSection);
  const phases = parsePhasesTable(phasesSection, knownPhaseStatuses);

  const currentStateIdx = content.indexOf('\n## Current state');
  if (currentStateIdx === -1) throw new AutoloadError('manifest missing ## Current state section');
  const afterCurrentState = content.indexOf('\n', currentStateIdx + 1) + 1;
  const eventsIdx = content.indexOf('\n## Events', afterCurrentState);
  const currentStateEnd = eventsIdx === -1 ? content.length : eventsIdx;
  const currentState = content.slice(afterCurrentState, currentStateEnd).trim();

  return { title, slug, status, currentBranch, latestCheckin, phasesTable, phases, currentState };
}

function extractTable(section: string): string {
  const lines = section.split('\n');
  const out: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith('|')) {
      out.push(line);
      started = true;
    } else if (started) {
      break;
    }
  }
  return out.join('\n');
}

function parsePhasesTable(section: string, knownStatuses: string[]): Phase[] {
  const lines = section.split('\n');
  const phases: Phase[] = [];
  const knownSet = new Set(knownStatuses);
  for (const line of lines) {
    const cells = parseRowCells(line);
    if (!cells || cells.length < 6) continue;
    const status = cells[2];
    if (!knownSet.has(status)) {
      throw new AutoloadError(`unknown phase status "${status}" in row "${line.trim()}"; known statuses: ${knownStatuses.join(', ')}`);
    }
    phases.push({
      num: cells[0],
      name: cells[1],
      status,
      branch: cells[3],
      checkin: cells[4],
      pr: cells[5],
    });
  }
  return phases;
}

function parseConfig(content: string): Config {
  const verification: string[] = [];
  const verIdx = content.indexOf('## Verification');
  if (verIdx !== -1) {
    const tail = content.slice(verIdx);
    const lines = tail.split('\n').slice(1);
    for (const line of lines) {
      if (line.startsWith('## ')) break;
      const m = line.match(/^- `([^`]+)`/) ?? line.match(/^- (.+)$/);
      if (m) verification.push(m[1].trim());
    }
  }
  let prBase = '—';
  const prIdx = content.indexOf('## PR settings');
  if (prIdx !== -1) {
    const tail = content.slice(prIdx);
    const m = tail.match(/^- Base branch: (.+)$/m);
    if (m) prBase = m[1].trim();
  }
  return { verification, prBase };
}

function parseSession(filename: string, content: string): Session {
  let openThreads = '';
  const idx = content.indexOf('## Open threads');
  if (idx !== -1) {
    const afterHeader = content.indexOf('\n', idx) + 1;
    const next = content.indexOf('\n## ', afterHeader);
    const end = next === -1 ? content.length : next;
    openThreads = content.slice(afterHeader, end).trim();
  }
  return { filename, openThreads };
}

function parseCheckin(num: string, content: string): Checkin {
  const created = (content.match(/^\*\*Created\*\*: (.+)$/m)?.[1] ?? '').trim();
  const unit = (content.match(/^\*\*Unit\*\*: (.+)$/m)?.[1] ?? '').trim();
  let verdict = '';
  const verdictIdx = content.indexOf('## Evaluator verdict');
  if (verdictIdx !== -1) {
    const afterHeader = content.indexOf('\n', verdictIdx) + 1;
    const next = content.indexOf('\n## ', afterHeader);
    const end = next === -1 ? content.length : next;
    verdict = content.slice(afterHeader, end).trim().split('\n')[0]?.trim() ?? '';
  }
  let notesGist = '';
  const notesMatch = content.match(/^## Notes for (?:the )?PR$/m);
  if (notesMatch) {
    const notesIdx = content.indexOf(notesMatch[0]);
    const afterHeader = content.indexOf('\n', notesIdx) + 1;
    const next = content.indexOf('\n## ', afterHeader);
    const end = next === -1 ? content.length : next;
    const notes = content.slice(afterHeader, end).trim();
    const firstBullet = notes.split('\n').find((l) => l.startsWith('- '));
    if (firstBullet) {
      notesGist = firstBullet.replace(/^-\s+/, '').trim();
      if (notesGist.length > 200) notesGist = notesGist.slice(0, 197) + '...';
    }
  }
  return { num, created, unit, verdict, notesGist };
}

function loadPhaseStatuses(): string[] {
  let md: string;
  try {
    md = readFileSync(CONVENTIONS_PATH, 'utf-8');
  } catch {
    return FALLBACK_PHASE_STATUSES;
  }
  // Capture the whole paragraph; the line in CONVENTIONS.md may wrap.
  const m = md.match(/\*\*Status values for a phase\*\*:\s*([\s\S]+?)(?=\n\n|\n##|$)/);
  if (!m) return FALLBACK_PHASE_STATUSES;
  const items = m[1].match(/`([a-z-]+)`/g);
  return items ? items.map((s) => s.replace(/`/g, '')) : FALLBACK_PHASE_STATUSES;
}

type GhState = 'open' | 'merged' | 'closed' | 'unavailable';

// Extract the integer PR number from a Phases-table PR cell like `#33 (merged)`.
// Returns null for `—`, empty cells, or anything without a `#<digits>` shape.
function extractPrNumber(prCell: string): number | null {
  const m = prCell.match(/#(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Read the lifecycle state out of a PR cell. The Phases-table convention is
// `#<N> (<state>)` where state is `open` / `merged` / `closed`. Anything else
// (bare `—`, no parens, novel state word) returns `unknown` — we cannot
// reason about drift there.
function parsePrCellState(prCell: string): 'open' | 'merged' | 'closed' | 'unknown' {
  if (prCell.includes('(merged)')) return 'merged';
  if (prCell.includes('(open)')) return 'open';
  if (prCell.includes('(closed)')) return 'closed';
  return 'unknown';
}

// Spawn `gh pr view <N> --json state,mergedAt` and resolve to a normalized
// GhState. Any failure (gh not installed, network down, not authenticated,
// non-zero exit) collapses to `'unavailable'`. Never rejects — callers can
// always Promise.all without try/catch.
function queryGhPrState(prNumber: number): Promise<GhState> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('gh', ['pr', 'view', String(prNumber), '--json', 'state,mergedAt'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      resolve('unavailable');
      return;
    }
    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.on('error', () => resolve('unavailable'));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve('unavailable');
        return;
      }
      try {
        const obj = JSON.parse(stdout) as { state?: string; mergedAt?: string | null };
        if (obj.mergedAt) {
          resolve('merged');
        } else if (obj.state === 'MERGED') {
          resolve('merged');
        } else if (obj.state === 'OPEN') {
          resolve('open');
        } else if (obj.state === 'CLOSED') {
          resolve('closed');
        } else {
          resolve('unavailable');
        }
      } catch {
        resolve('unavailable');
      }
    });
  });
}

async function queryGhPrStates(prNumbers: number[]): Promise<Map<number, GhState>> {
  const results = await Promise.all(
    prNumbers.map(async (n) => [n, await queryGhPrState(n)] as const),
  );
  return new Map(results);
}

// Invoke `autosave --event=pr-merged --detail=#<N>` so the manifest write goes
// through the same path skills already use. Returns true on success, false on
// failure (autosave's stderr is forwarded). Best-effort: a failed reconcile
// doesn't abort orientation, it just leaves the drift surfaced.
function invokeAutosaveForMerge(slug: string, prNumber: number): boolean {
  const result = spawnSync(
    'node',
    [AUTOSAVE_PATH, slug, '--event=pr-merged', `--detail=#${prNumber}`],
    { encoding: 'utf-8' },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? `autosave invocation failed for #${prNumber}\n`);
    return false;
  }
  return true;
}

function renderPhasesTable(phases: Phase[], ghStates: Map<number, GhState> | null): string {
  const lines: string[] = [];
  lines.push('| # | Name | Status | Branch | Latest checkin | PR |');
  lines.push('|---|------|--------|--------|----------------|----|');
  for (const p of phases) {
    let prCell = p.pr;
    const prNum = extractPrNumber(prCell);
    if (prNum !== null && ghStates) {
      const ghState = ghStates.get(prNum);
      const manifestState = parsePrCellState(prCell);
      if (
        ghState &&
        ghState !== 'unavailable' &&
        manifestState !== 'unknown' &&
        ghState !== manifestState
      ) {
        prCell = `#${prNum} (${manifestState} ⚠ ${ghState} on gh)`;
      }
    }
    lines.push(`| ${p.num} | ${p.name} | ${p.status} | ${p.branch} | ${p.checkin} | ${prCell} |`);
  }
  return lines.join('\n');
}

function getCurrentBranch(): string {
  try {
    return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function findLatestSessionFile(projectPath: string): string | null {
  const sessionsDir = join(projectPath, 'sessions');
  if (!existsSync(sessionsDir)) return null;
  const files = readdirSync(sessionsDir)
    .filter((n) => n.endsWith('.md'))
    .sort()
    .reverse();
  return files[0] ?? null;
}

function suggestNextAction(manifest: Manifest, hasFreshCheckin: boolean): string {
  if (manifest.status === 'archived') {
    return 'Project is archived — read RETROSPECTIVE.md directly.';
  }
  const completed = manifest.phases.filter((p) => p.status === 'completed').length;
  if (completed === manifest.phases.length && manifest.phases.length > 0) {
    return `All phases complete — run \`/trout-archive ${manifest.slug}\`.`;
  }
  const blocked = manifest.phases.find((p) => p.status === 'blocked');
  if (blocked) {
    return `Phase ${blocked.num} (${blocked.name}) is blocked — resolve before resuming.`;
  }
  const inProgress = manifest.phases.find((p) => p.status === 'in-progress');
  if (inProgress) {
    const openPrMatch = inProgress.pr.match(/#(\d+)\s*\(open\)/);
    if (openPrMatch) {
      return `Phase ${inProgress.num} has open PR #${openPrMatch[1]} — consider \`/trout-pr-respond ${manifest.slug} ${openPrMatch[1]}\` if there are new comments, otherwise continue the loop.`;
    }
    if (hasFreshCheckin && inProgress.branch !== '—') {
      return `Phase ${inProgress.num} has a fresh checkin and no open PR — run \`/trout-pull-request ${manifest.slug} ${inProgress.branch}\`.`;
    }
    return `Phase ${inProgress.num} (${inProgress.name}) is in-progress — resume via the loop bound in config.md.`;
  }
  const notStarted = manifest.phases.find((p) => p.status === 'not-started');
  if (notStarted) {
    const priorOpenPr = manifest.phases
      .filter((p) => Number(p.num) < Number(notStarted.num))
      .map((p) => p.pr.match(/#(\d+)\s*\(open\)/)?.[1])
      .find((n): n is string => Boolean(n));
    if (priorOpenPr) {
      return `Phase ${notStarted.num} (${notStarted.name}) is waiting on PR #${priorOpenPr} to merge.`;
    }
    return `Phase ${notStarted.num} (${notStarted.name}) is ready to start — run \`/ev-run ${manifest.slug}\`.`;
  }
  return 'No actionable phase identified — review MANIFEST manually.';
}

function buildBriefing(
  manifest: Manifest,
  config: Config | null,
  session: Session | null,
  checkin: Checkin | null,
  gitBranch: string,
  ghStates: Map<number, GhState> | null,
  ghAllUnavailable: boolean,
  reconciledPrNumbers: number[],
): string {
  const lines: string[] = [];
  lines.push(`## Project orientation: ${manifest.title} (${manifest.slug})`);
  lines.push('');
  const branchArrow = `${manifest.currentBranch} → ${gitBranch || '(not in a git repo)'}`;
  lines.push(`**Status**: ${manifest.status}  **Branch (manifest → actual)**: ${branchArrow}`);
  lines.push('');
  lines.push('### Phases');
  lines.push(renderPhasesTable(manifest.phases, ghStates));
  if (ghAllUnavailable && ghStates !== null && ghStates.size > 0) {
    lines.push('');
    lines.push('> _gh unavailable — PR states shown are manifest-only._');
  }
  for (const pr of reconciledPrNumbers) {
    lines.push('');
    lines.push(`> Reconciled drift: PR #${pr} marked merged (was open).`);
  }
  lines.push('');
  lines.push('### Current state');
  lines.push(manifest.currentState);
  lines.push('');

  if (checkin) {
    const dateOnly = checkin.created.split(' ')[0];
    lines.push(`### Last checkin (${checkin.num}, ${dateOnly})`);
    if (checkin.unit) lines.push(`- **Unit**: ${checkin.unit}`);
    if (checkin.verdict) lines.push(`- **Verdict**: ${checkin.verdict}`);
    if (checkin.notesGist) lines.push(`- **Notes**: ${checkin.notesGist}`);
    lines.push('');
  }

  if (session) {
    lines.push(`### Last session (${session.filename})`);
    lines.push(`- **Open threads**: ${session.openThreads || '(none)'}`);
    lines.push('');
  }

  if (config) {
    lines.push('### Config highlights');
    if (config.verification.length > 0) {
      lines.push(`- Verification: ${config.verification.map((v) => `\`${v}\``).join(', ')}`);
    }
    lines.push(`- PR base: ${config.prBase}`);
    lines.push('');
  }

  const driftDetected = gitBranch && manifest.currentBranch !== '—' && gitBranch !== manifest.currentBranch;
  if (driftDetected) {
    lines.push(`> Drift: manifest says ${manifest.currentBranch}, git is on ${gitBranch}.`);
    lines.push('');
  }

  const hasFreshCheckin = checkin !== null;
  lines.push('### Suggested next action');
  lines.push(suggestNextAction(manifest, hasFreshCheckin));
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const { slug, reconcile } = parseArguments(process.argv.slice(2));
  if (!slug) {
    const active = listActiveProjects();
    process.stderr.write('autoload-error: missing project identifier\n');
    if (active.length > 0) {
      process.stderr.write(`active projects: ${active.join(', ')}\n`);
    }
    process.stderr.write(`usage: ${ARG_HINT}\n`);
    process.exit(1);
  }

  const projectPath = resolveProjectOrFail(slug);
  const manifestPath = join(projectPath, 'MANIFEST.md');
  if (!existsSync(manifestPath)) {
    fail(`no manifest found — project scaffolding may be incomplete: ${manifestPath}`);
  }

  const knownPhaseStatuses = loadPhaseStatuses();
  let manifest: Manifest;
  try {
    manifest = parseManifest(readFileSync(manifestPath, 'utf-8'), knownPhaseStatuses);
  } catch (err) {
    if (err instanceof AutoloadError) fail(err.message);
    throw err;
  }

  // Query gh for the live state of every PR referenced in the Phases table.
  // Runs in parallel; any failure mode collapses to 'unavailable' so the
  // briefing always renders.
  const prNumbers = manifest.phases
    .map((p) => extractPrNumber(p.pr))
    .filter((n): n is number => n !== null);
  let ghStates: Map<number, GhState> | null = null;
  let ghAllUnavailable = false;
  const reconciledPrNumbers: number[] = [];
  if (prNumbers.length > 0) {
    ghStates = await queryGhPrStates(prNumbers);
    const stateValues = [...ghStates.values()];
    ghAllUnavailable = stateValues.length > 0 && stateValues.every((s) => s === 'unavailable');

    if (reconcile && !ghAllUnavailable) {
      // Auto-correct `(open) → merged` drift only. The merged→open case is
      // surfaced as a warning by renderPhasesTable but not auto-fixed —
      // flipping there would erase a recorded pr-merged event.
      for (const phase of manifest.phases) {
        const prNum = extractPrNumber(phase.pr);
        if (prNum === null) continue;
        const manifestState = parsePrCellState(phase.pr);
        const ghState = ghStates.get(prNum);
        if (manifestState === 'open' && ghState === 'merged') {
          if (invokeAutosaveForMerge(slug, prNum)) {
            reconciledPrNumbers.push(prNum);
          }
        }
      }
      // Re-parse manifest after autosave invocations so the rendered table
      // reflects the post-reconcile state.
      if (reconciledPrNumbers.length > 0) {
        try {
          manifest = parseManifest(readFileSync(manifestPath, 'utf-8'), knownPhaseStatuses);
        } catch (err) {
          if (err instanceof AutoloadError) fail(err.message);
          throw err;
        }
      }
    }
  }

  const configPath = join(projectPath, 'config.md');
  const config = existsSync(configPath) ? parseConfig(readFileSync(configPath, 'utf-8')) : null;

  let session: Session | null = null;
  const sessionFilename = findLatestSessionFile(projectPath);
  if (sessionFilename) {
    const sessionPath = join(projectPath, 'sessions', sessionFilename);
    session = parseSession(sessionFilename, readFileSync(sessionPath, 'utf-8'));
  }

  let checkin: Checkin | null = null;
  if (manifest.latestCheckin && manifest.latestCheckin !== '—') {
    const checkinPath = join(projectPath, manifest.latestCheckin);
    if (existsSync(checkinPath)) {
      const num = basename(manifest.latestCheckin, '.md');
      checkin = parseCheckin(num, readFileSync(checkinPath, 'utf-8'));
    }
  }

  const gitBranch = getCurrentBranch();
  const briefing = buildBriefing(
    manifest,
    config,
    session,
    checkin,
    gitBranch,
    ghStates,
    ghAllUnavailable,
    reconciledPrNumbers,
  );
  process.stdout.write(briefing);
}

main().catch((err) => {
  process.stderr.write(`autoload-error: ${(err as Error).message}\n`);
  process.exit(1);
});
