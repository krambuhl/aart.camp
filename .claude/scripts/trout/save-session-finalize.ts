#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECTS_ROOT = resolve(process.cwd(), 'projects');
const ARCHIVE_ROOT = join(PROJECTS_ROOT, 'archive');
const CAPTURE_SCRIPT = resolve(process.cwd(), '.claude/scripts/griot/capture.ts');

const ARG_HINT = '<project-slug-or-path> --content-file=<path> [--date=<YYYY-MM-DD>]';

class FinalizeError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`save-session-finalize-error: ${reason}\n`);
  process.exit(1);
}

// ---------- Pure helpers (exported for direct unit tests) ----------

export function todayUTC(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function findNextLetter(sessionsDir: string, date: string): string {
  for (let code = 97; code <= 122; code++) {
    const letter = String.fromCharCode(code);
    const candidate = join(sessionsDir, `${date}-${letter}.md`);
    if (!existsSync(candidate)) return letter;
  }
  throw new FinalizeError(`all letters a-z taken for ${date}; manual intervention required`);
}

export function resolveProject(slug: string): string {
  if (slug.startsWith('.') || slug.startsWith('/')) {
    const abs = resolve(slug);
    if (abs.startsWith(ARCHIVE_ROOT + '/') || abs === ARCHIVE_ROOT) throw new FinalizeError(`project is archived (read-only): ${abs}`);
    if (!existsSync(abs)) throw new FinalizeError(`project not found: ${abs}`);
    if (!statSync(abs).isDirectory()) throw new FinalizeError(`project path is not a directory: ${abs}`);
    return abs;
  }
  if (!existsSync(PROJECTS_ROOT)) throw new FinalizeError(`projects root does not exist: ${PROJECTS_ROOT}`);
  const direct = join(PROJECTS_ROOT, slug);
  if (existsSync(direct) && statSync(direct).isDirectory()) return direct;
  const candidates = readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'archive')
    .map((e) => e.name)
    .filter((name) => name.endsWith(slug));
  if (candidates.length === 1) return join(PROJECTS_ROOT, candidates[0]);
  if (candidates.length > 1) throw new FinalizeError(`ambiguous slug "${slug}"; candidates: ${candidates.join(', ')}`);
  throw new FinalizeError(`project not found: slug "${slug}" did not match any directory under ${PROJECTS_ROOT}`);
}

export type ManifestEvent = { event: string; detail: string };

export function parseManifestEvents(manifest: string): ManifestEvent[] {
  const lines = manifest.split('\n');
  const headerIdx = lines.findIndex((l) => l.trim() === '## Events');
  if (headerIdx === -1) return [];
  const events: ManifestEvent[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) break;
    // table row format: | when | event | detail |
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;
    const event = m[2].trim();
    if (event === 'When' || /^[-:\s]+$/.test(event)) continue; // skip header + separator rows
    events.push({ event, detail: m[3].trim() });
  }
  return events;
}

export function sessionWindowCheckins(events: ManifestEvent[], projectPath: string): string[] {
  // Backward walk: collect checkin-created until we hit session-saved (cutoff).
  const checkins: string[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.event === 'session-saved') break;
    if (e.event !== 'checkin-created') continue;
    const m = e.detail.match(/^(\d+)\s+on\s+(.+)$/);
    if (!m) continue;
    checkins.unshift(join(projectPath, 'checkins', m[2].trim(), `${m[1].padStart(2, '0')}.md`));
  }
  return checkins;
}

export function extractNotesForPR(checkinContent: string): string {
  const re = /^## Notes for (?:the )?PR\s*$/m;
  const match = checkinContent.match(re);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = checkinContent.slice(start);
  const next = rest.search(/^## /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export function extractCorrections(notesForPR: string): string[] {
  // Mirrors capture.ts::extractCorrections — multi-line corrections continue
  // until the next bullet or blank line.
  const lines = notesForPR.split('\n');
  const corrections: string[] = [];
  let current: string | null = null;
  for (const line of lines) {
    const start = line.match(/^[-*]?\s*correction:\s*(.+)$/);
    if (start) {
      if (current !== null) corrections.push(current.trim());
      current = start[1];
      continue;
    }
    if (current !== null) {
      if (line.match(/^[-*]\s+/) || line.trim() === '') {
        corrections.push(current.trim());
        current = null;
      } else {
        current += ' ' + line.trim();
      }
    }
  }
  if (current !== null) corrections.push(current.trim());
  return corrections;
}

export function kebabize(s: string, maxTokens = 5): string {
  const tokens = s
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((t) => t.length > 0);
  return tokens.slice(0, maxTokens).join('-');
}

export function disambiguateSlugs(slugs: string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of slugs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const seen = new Map<string, number>();
  return slugs.map((s) => {
    if ((counts.get(s) ?? 0) === 1) return s;
    const idx = seen.get(s) ?? 0;
    seen.set(s, idx + 1);
    return `${s}-${String.fromCharCode(97 + idx)}`;
  });
}

// ---------- Main ----------

function captureCorrection(checkinPath: string, slug: string, text: string): void {
  const result = spawnSync('node', [CAPTURE_SCRIPT, `--from-checkin=${checkinPath}`, `--slug=${slug}`, `--correction-text=${text}`], { encoding: 'utf-8' });
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim() || `capture exited with status ${result.status}`;
    fail(`capture failed for ${checkinPath} (slug=${slug}): ${stderr}`);
  }
}

function tryOrFail<T>(fn: () => T): T {
  try { return fn(); } catch (err) {
    if (err instanceof FinalizeError) fail(err.message);
    throw err;
  }
}

function main(): void {
  const parsed = (() => {
    try {
      return parseArgs({ options: { 'content-file': { type: 'string' }, 'date': { type: 'string' } }, allowPositionals: true, args: process.argv.slice(2) });
    } catch (err) { fail(`argument parse failure: ${(err as Error).message}`); }
  })();
  const { values, positionals } = parsed;

  if (positionals.length === 0) fail(`missing project argument; usage: ${ARG_HINT}`);
  if (positionals.length > 1) fail(`too many positional arguments: expected 1, got ${positionals.length}`);

  const contentFile = values['content-file'] as string | undefined;
  if (!contentFile) fail(`--content-file is required; usage: ${ARG_HINT}`);
  const resolvedContentFile = resolve(contentFile);
  if (!existsSync(resolvedContentFile)) fail(`content file not found: ${contentFile}`);

  const projectPath = tryOrFail(() => resolveProject(positionals[0]));
  const date = (values.date as string | undefined) ?? todayUTC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`--date must be YYYY-MM-DD; got "${date}"`);

  const sessionsDir = join(projectPath, 'sessions');
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });

  const letter = tryOrFail(() => findNextLetter(sessionsDir, date));
  const sessionPath = join(sessionsDir, `${date}-${letter}.md`);
  writeFileSync(sessionPath, readFileSync(resolvedContentFile, 'utf-8'));

  const manifestPath = join(projectPath, 'MANIFEST.md');
  if (existsSync(manifestPath)) {
    const events = parseManifestEvents(readFileSync(manifestPath, 'utf-8'));
    for (const checkinPath of sessionWindowCheckins(events, projectPath)) {
      if (!existsSync(checkinPath)) continue;
      const corrections = extractCorrections(extractNotesForPR(readFileSync(checkinPath, 'utf-8')));
      if (corrections.length === 0) continue;
      const slugs = disambiguateSlugs(corrections.map((c) => kebabize(c)));
      for (let i = 0; i < corrections.length; i++) {
        captureCorrection(checkinPath, slugs[i], corrections[i]);
      }
    }
  }

  process.stdout.write(`session-saved: ${relative(process.cwd(), sessionPath)}\n`);
}

main();
