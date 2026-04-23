import fs from 'node:fs';
import { resolvePath } from './config';
import { readTextOrEmpty, writeTextAtomic } from './io';
import type { Config } from './types';

// Parse the rollup for existing L-NNN ids. Not a full markdown parser —
// just finds the highest `## L-NNN` header.
export function nextLearningId(config: Config): string {
  const path = resolvePath(config.paths.rollup);
  const existing = readTextOrEmpty(path);
  const ids = Array.from(existing.matchAll(/^##\s+(L-(\d+))/gm)).map((m) => Number.parseInt(m[2], 10));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `L-${String(next).padStart(3, '0')}`;
}

export interface RollupEntry {
  id: string;
  title: string;
  promoted: string; // ISO date
  originSlug: string;
  learning: string;
  rubric: string;
}

export function appendToRollup(config: Config, entry: RollupEntry): void {
  const path = resolvePath(config.paths.rollup);
  const existing = readTextOrEmpty(path);
  const header = existing.length > 0 ? existing : '# Rollup\n\n';

  const block = [
    `## ${entry.id} — ${entry.title}`,
    `_Promoted: ${entry.promoted}. Origin: \`learnings/session-notes/archived/${entry.originSlug}/\`_`,
    '',
    entry.learning.trim(),
    '',
    '**Rubric (from origin case):**',
    '',
    entry.rubric.trim(),
    '',
    '---',
    '',
  ].join('\n');

  writeTextAtomic(path, header + block);
}

export function readAllRollupEntries(config: Config): RollupEntry[] {
  const path = resolvePath(config.paths.rollup);
  const content = readTextOrEmpty(path);
  if (!content) return [];

  const entries: RollupEntry[] = [];
  const sections = content.split(/^## (L-\d+)\s+—\s+(.+)$/m);
  // split captures id and title as pairs; walk them.
  for (let i = 1; i < sections.length; i += 3) {
    const id = sections[i];
    const title = sections[i + 1];
    const body = sections[i + 2] ?? '';
    const promotedMatch = body.match(/_Promoted:\s+([\d-]+)\.\s+Origin:\s+`([^`]+)`/);
    const rubricMatch = body.match(/\*\*Rubric \(from origin case\):\*\*\s*\n+([\s\S]*?)\n---/);
    const learningMatch = body
      .replace(/_Promoted:[^_]+_/, '')
      .replace(/\*\*Rubric[\s\S]*$/, '')
      .trim();
    entries.push({
      id,
      title: title.trim(),
      promoted: promotedMatch?.[1] ?? 'unknown',
      originSlug: (promotedMatch?.[2] ?? '').replace(/^learnings\/session-notes\/archived\//, '').replace(/\/$/, ''),
      learning: learningMatch,
      rubric: rubricMatch?.[1].trim() ?? '',
    });
  }
  return entries;
}

// Extract a short title from a learning body — first sentence or first
// sub-12-word phrase. Crude but good enough for a title field.
export function titleFromLearning(learning: string): string {
  const firstLine = learning.trim().split(/\n/)[0] ?? '';
  const firstSentence = firstLine.split(/[.!?]/)[0] ?? firstLine;
  const words = firstSentence.split(/\s+/).slice(0, 10).join(' ');
  return words.replace(/^[^A-Za-z0-9]+/, '').slice(0, 80);
}

// Check the tracked placeholder — if someone freshly cloned and the file
// doesn't exist, create it with an empty header so append works.
export function ensureRollupExists(config: Config): void {
  const path = resolvePath(config.paths.rollup);
  if (!fs.existsSync(path)) {
    writeTextAtomic(path, '# Rollup\n\nNo validated learnings yet. `/learnings-compact` promotes entries here when the judge panel returns `IMPROVED`.\n\n');
  }
}
