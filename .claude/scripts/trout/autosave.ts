#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';

type PhaseUpdate = {
  phase: string;
  status: string;
  fields: Record<string, string>;
};

type Args = {
  slug: string;
  init: boolean;
  event?: string;
  detail?: string;
  currentState?: string;
  phaseUpdate?: PhaseUpdate;
};

type InitDetail = {
  title: string;
  slug: string;
  started: string;
  strategy: string;
  phases: Array<{ name: string; dependencies?: string[] }>;
};

const PHASE_STATUSES = new Set(['not-started', 'in-progress', 'blocked', 'completed']);
const PROJECTS_ROOT = resolve(process.cwd(), 'projects');
const ARCHIVE_ROOT = resolve(PROJECTS_ROOT, 'archive');
const CONVENTIONS_PATH = resolve(PROJECTS_ROOT, 'CONVENTIONS.md');

// Hardcoded fallback used only if CONVENTIONS.md is unreadable. Source of
// truth is the `## Event vocabulary` table in CONVENTIONS.md, parsed at
// runtime — this list mirrors it but is not the authority.
const FALLBACK_VOCABULARY = [
  'project-initialized', 'phase-started', 'phase-completed', 'phase-blocked',
  'phase-unblocked', 'checkin-created', 'pr-opened', 'pr-updated', 'pr-merged',
  'session-saved', 'retro-written', 'archived', 'note',
];

const ARG_HINT = '<project-slug-or-path> [--init] [--event=<name>] [--detail=<text>] [--current-state=<text>] [--phase-update=<n>:<status>[:<k=v>]*]';

class AutosaveError extends Error {
  candidates?: string[];
  constructor(message: string, candidates?: string[]) {
    super(message);
    this.candidates = candidates;
  }
}

function fail(reason: string, candidates?: string[]): never {
  let line = `autosave-error: ${reason}`;
  if (candidates && candidates.length > 0) {
    line += `; candidates: ${candidates.join(', ')}`;
  }
  process.stderr.write(line + '\n');
  process.exit(1);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parsePhaseUpdate(raw: string): PhaseUpdate {
  const parts = raw.split(':');
  if (parts.length < 2) {
    throw new AutosaveError(`malformed --phase-update (need at least <n>:<status>): ${raw}`);
  }
  const [phase, status, ...rest] = parts;
  if (!PHASE_STATUSES.has(status) && status !== '—') {
    throw new AutosaveError(`invalid phase status "${status}"; expected one of: ${[...PHASE_STATUSES].join(', ')}`);
  }
  const fields: Record<string, string> = {};
  for (const segment of rest) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx === -1) {
      throw new AutosaveError(`malformed --phase-update field (expected k=v): ${segment}`);
    }
    const key = segment.slice(0, eqIdx);
    const value = segment.slice(eqIdx + 1);
    fields[key] = value;
  }
  return { phase, status, fields };
}

function parseArguments(argv: string[]): Args {
  if (argv.length === 0) {
    process.stderr.write(`autosave-error: missing project identifier\nusage: ${ARG_HINT}\n`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        init: { type: 'boolean' },
        event: { type: 'string' },
        detail: { type: 'string' },
        'current-state': { type: 'string' },
        'phase-update': { type: 'string' },
      },
      allowPositionals: true,
      args: argv,
    });
  } catch (err) {
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const { values, positionals } = parsed;
  if (positionals.length === 0) {
    fail('missing project identifier');
  }
  if (positionals.length > 1) {
    fail(`unexpected extra positional arguments: ${positionals.slice(1).join(' ')}`);
  }
  const slug = positionals[0];
  const init = !!values.init;
  if (!init && !values.event) {
    fail('--event=<name> is required (unless --init)');
  }
  if (init && (values.event || values['current-state'] || values['phase-update'])) {
    fail('--init does not accept --event / --current-state / --phase-update');
  }
  let phaseUpdate: PhaseUpdate | undefined;
  if (values['phase-update']) {
    try {
      phaseUpdate = parsePhaseUpdate(values['phase-update'] as string);
    } catch (err) {
      fail((err as Error).message);
    }
  }
  return {
    slug,
    init,
    event: values.event as string | undefined,
    detail: values.detail as string | undefined,
    currentState: values['current-state'] as string | undefined,
    phaseUpdate,
  };
}

function resolveInitTarget(slug: string): string {
  if (slug.startsWith('.') || slug.startsWith('/')) {
    const abs = resolve(slug);
    if (abs.startsWith(ARCHIVE_ROOT + '/') || abs === ARCHIVE_ROOT) {
      fail(`project is archived (read-only): ${abs}`);
    }
    return abs;
  }
  return join(PROJECTS_ROOT, slug);
}

function resolveProject(slug: string): string {
  if (slug.startsWith('.') || slug.startsWith('/')) {
    const abs = resolve(slug);
    if (abs.startsWith(ARCHIVE_ROOT + '/') || abs === ARCHIVE_ROOT) {
      fail(`project is archived (read-only): ${abs}`);
    }
    if (!existsSync(abs)) {
      fail(`project path does not exist: ${abs}`);
    }
    if (!statSync(abs).isDirectory()) {
      fail(`project path is not a directory: ${abs}`);
    }
    return abs;
  }
  if (!existsSync(PROJECTS_ROOT)) {
    fail(`projects root does not exist: ${PROJECTS_ROOT}`);
  }
  const direct = join(PROJECTS_ROOT, slug);
  if (existsSync(direct) && statSync(direct).isDirectory()) {
    return direct;
  }
  if (existsSync(ARCHIVE_ROOT)) {
    const archivedMatch = readdirSync(ARCHIVE_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .find((name) => name === slug || name.endsWith(`-${slug}`));
    if (archivedMatch) {
      fail(`project is archived (read-only): ${join(ARCHIVE_ROOT, archivedMatch)}`);
    }
  }
  const entries = readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name);
  const matches = entries.filter((name) => name.endsWith(`-${slug}`));
  if (matches.length === 0) {
    fail(`project not found: ${slug} (try /trout-plan ${slug} to create one)`);
  }
  if (matches.length > 1) {
    fail(`multiple projects match "${slug}"`, matches);
  }
  return join(PROJECTS_ROOT, matches[0]);
}

function loadEventVocabulary(): string[] {
  let md: string;
  try {
    md = readFileSync(CONVENTIONS_PATH, 'utf-8');
  } catch {
    return FALLBACK_VOCABULARY;
  }
  const sectionMatch = md.split(/^## Event vocabulary/m)[1];
  if (!sectionMatch) return FALLBACK_VOCABULARY;
  const lines = sectionMatch.split('\n');
  const events: string[] = [];
  for (const line of lines) {
    if (line.startsWith('##')) break;
    const m = line.match(/^\| `([a-z-]+)` \|/);
    if (m) events.push(m[1]);
  }
  return events.length > 0 ? events : FALLBACK_VOCABULARY;
}

function appendEvent(content: string, when: string, event: string, detail: string): string {
  const eventsHeaderIdx = content.indexOf('\n## Events');
  if (eventsHeaderIdx === -1) {
    throw new AutosaveError('manifest missing ## Events section');
  }
  const tail = content.slice(eventsHeaderIdx);
  const lines = tail.split('\n');
  let lastRowIdx = -1;
  let pastTableHeader = false;
  let pastEventsHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Events')) { pastEventsHeader = true; continue; }
    if (pastEventsHeader && line.startsWith('## ')) break;
    if (line.startsWith('|---') || line.match(/^\|\s*-+/)) {
      pastTableHeader = true;
      continue;
    }
    if (pastTableHeader && line.startsWith('|')) {
      lastRowIdx = i;
    }
  }
  if (lastRowIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('|---') || lines[i].match(/^\|\s*-+/)) {
        lastRowIdx = i;
        break;
      }
    }
  }
  if (lastRowIdx === -1) {
    throw new AutosaveError('manifest ## Events section has no table');
  }
  const newRow = `| ${when} | ${event} | ${detail || '—'} |`;
  lines.splice(lastRowIdx + 1, 0, newRow);
  return content.slice(0, eventsHeaderIdx) + lines.join('\n');
}

function rewritePhaseRow(content: string, update: PhaseUpdate): string {
  const phasesHeaderIdx = content.indexOf('\n## Phases');
  if (phasesHeaderIdx === -1) {
    throw new AutosaveError('manifest missing ## Phases section');
  }
  const dependenciesIdx = content.indexOf('\n## Dependencies', phasesHeaderIdx);
  const sectionEnd = dependenciesIdx === -1 ? content.length : dependenciesIdx;
  const section = content.slice(phasesHeaderIdx, sectionEnd);
  const lines = section.split('\n');
  let updated = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = parseRowCells(line);
    if (!cells || cells.length < 6) continue;
    if (cells[0].trim() !== update.phase) continue;
    const newStatus = update.status === '—' ? cells[2] : update.status;
    const newBranch = update.fields.branch ?? cells[3];
    const newCheckin = update.fields.checkin ?? cells[4];
    const newPr = update.fields.pr ?? cells[5];
    lines[i] = `| ${cells[0]} | ${cells[1]} | ${newStatus} | ${newBranch} | ${newCheckin} | ${newPr} |`;
    updated = true;
    break;
  }
  if (!updated) {
    throw new AutosaveError(`phase ${update.phase} not found in Phases table`);
  }
  return content.slice(0, phasesHeaderIdx) + lines.join('\n') + content.slice(sectionEnd);
}

function parseRowCells(line: string): string[] | null {
  if (!line.startsWith('|')) return null;
  if (line.match(/^\|\s*-+/)) return null;
  if (line.match(/^\| #/) || line.match(/^\| When/)) return null;
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function applyPRMergedToPhaseRow(content: string, prDetail: string): string {
  const phasesHeaderIdx = content.indexOf('\n## Phases');
  if (phasesHeaderIdx === -1) return content;
  const dependenciesIdx = content.indexOf('\n## Dependencies', phasesHeaderIdx);
  const sectionEnd = dependenciesIdx === -1 ? content.length : dependenciesIdx;
  const section = content.slice(phasesHeaderIdx, sectionEnd);
  const lines = section.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const cells = parseRowCells(lines[i]);
    if (!cells || cells.length < 6) continue;
    const prCell = cells[5];
    if (!prCell.includes(prDetail)) continue;
    if (prCell.includes('(merged)')) return content;
    const newPr = prCell.includes('(open)')
      ? prCell.replace('(open)', '(merged)')
      : prCell.includes('(') ? prCell : `${prCell} (merged)`;
    lines[i] = `| ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]} | ${cells[4]} | ${newPr} |`;
    return content.slice(0, phasesHeaderIdx) + lines.join('\n') + content.slice(sectionEnd);
  }
  return content;
}

function replaceCurrentState(content: string, newState: string): string {
  const headerIdx = content.indexOf('\n## Current state');
  if (headerIdx === -1) {
    throw new AutosaveError('manifest missing ## Current state section');
  }
  const afterHeader = content.indexOf('\n', headerIdx + 1) + 1;
  const nextSectionIdx = content.indexOf('\n## ', afterHeader);
  const before = content.slice(0, afterHeader);
  const after = nextSectionIdx === -1 ? '' : content.slice(nextSectionIdx);
  return before + '\n' + newState + '\n' + after;
}

function updateLatestCheckin(content: string, branch: string, checkinNum: string): string {
  const fieldRe = /^\*\*Latest checkin\*\*: .*$/m;
  if (!fieldRe.test(content)) {
    throw new AutosaveError('manifest missing **Latest checkin** field');
  }
  const newPath = `checkins/${branch}/${checkinNum}.md`;
  return content.replace(fieldRe, `**Latest checkin**: ${newPath}`);
}

function parseCheckinDetail(detail: string): { num: string; branch: string } | null {
  const m = detail.match(/^(\d+)\s+on\s+(.+)$/);
  if (!m) return null;
  return { num: m[1], branch: m[2].trim() };
}

function runUpdate(projectPath: string, args: Args): { slug: string; event: string; when: string } {
  const manifestPath = join(projectPath, 'MANIFEST.md');
  if (!existsSync(manifestPath)) {
    fail(`manifest not found: ${manifestPath}`);
  }
  const event = args.event!;
  const vocabulary = loadEventVocabulary();
  if (!vocabulary.includes(event)) {
    fail(`unknown event "${event}"; valid: ${vocabulary.join(', ')}`);
  }
  let content = readFileSync(manifestPath, 'utf-8');
  const when = timestamp();
  try {
    if (args.phaseUpdate) {
      content = rewritePhaseRow(content, args.phaseUpdate);
    }
    if (event === 'pr-merged' && args.detail) {
      content = applyPRMergedToPhaseRow(content, args.detail);
    }
    if (args.currentState) {
      content = replaceCurrentState(content, args.currentState);
    }
    if (event === 'checkin-created' && args.detail) {
      const parsed = parseCheckinDetail(args.detail);
      if (parsed) {
        content = updateLatestCheckin(content, parsed.branch, parsed.num);
      }
    }
    content = appendEvent(content, when, event, args.detail ?? '');
  } catch (err) {
    if (err instanceof AutosaveError) fail(err.message);
    throw err;
  }
  writeFileSync(manifestPath, content);
  return { slug: basename(projectPath), event, when };
}

function runInit(projectPath: string, detailJson: string | undefined): { slug: string; when: string } {
  if (!detailJson) {
    fail('--init requires --detail with a JSON object (title, slug, started, strategy, phases)');
  }
  let detail: InitDetail;
  try {
    detail = JSON.parse(detailJson);
  } catch (err) {
    fail(`--init --detail JSON parse error: ${(err as Error).message}`);
  }
  for (const required of ['title', 'slug', 'started', 'strategy', 'phases']) {
    if (!(required in detail)) {
      fail(`--init --detail JSON missing required field: ${required}`);
    }
  }
  if (!Array.isArray(detail.phases)) {
    fail('--init --detail.phases must be an array');
  }
  if (existsSync(projectPath)) {
    fail(`project directory already exists: ${projectPath}`);
  }
  mkdirSync(projectPath, { recursive: true });
  mkdirSync(join(projectPath, 'sessions'), { recursive: true });
  mkdirSync(join(projectPath, 'checkins'), { recursive: true });

  const when = timestamp();
  const phaseRows = detail.phases.map((p, idx) => {
    const num = idx + 1;
    return `| ${num} | ${p.name} | not-started | — | — | — |`;
  }).join('\n');
  const dependencyLines = detail.phases.flatMap((p, idx) => {
    if (!p.dependencies || p.dependencies.length === 0) return [];
    return [`- Phase ${idx + 1}: ${p.dependencies.join('; ')}`];
  });
  const dependenciesBlock = dependencyLines.length > 0 ? dependencyLines.join('\n') : '- (none)';
  const manifest = `# Project: ${detail.title}

**Slug**: ${detail.slug}
**Started**: ${detail.started}
**Status**: active
**Current branch**: —
**Latest checkin**: —

## Strategy

${detail.strategy}

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
  writeFileSync(join(projectPath, 'MANIFEST.md'), manifest);
  const config = `# Project config

## Verification
- (fill in)

## PR settings
- Base branch: main
- Reviewers: —
- Labels: —

## Worker bindings
- (fill in)
`;
  writeFileSync(join(projectPath, 'config.md'), config);
  return { slug: basename(projectPath), when };
}

function main(): void {
  const args = parseArguments(process.argv.slice(2));
  if (args.init) {
    const projectPath = resolveInitTarget(args.slug);
    const { slug, when } = runInit(projectPath, args.detail);
    process.stdout.write(`autosave: ${slug} project-initialized @ ${when}\n`);
    return;
  }
  const projectPath = resolveProject(args.slug);
  const { slug, event, when } = runUpdate(projectPath, args);
  process.stdout.write(`autosave: ${slug} ${event} @ ${when}\n`);
}

main();
