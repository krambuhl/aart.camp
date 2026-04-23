import fs from 'node:fs';
import path from 'node:path';
import { resolvePath } from './config';
import type { Config, SessionNote } from './types';

export function readTextOrEmpty(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

export function writeTextAtomic(p: string, content: string): void {
  ensureDir(path.dirname(p));
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, p);
}

export function appendJsonlLine(p: string, obj: unknown): void {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, `${JSON.stringify(obj)}\n`);
}

export function listSessionNotes(config: Config): SessionNote[] {
  const root = resolvePath(config.paths.session_notes);
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const notes: SessionNote[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === 'archived') continue;
    const dir = path.join(root, ent.name);
    notes.push({
      dir,
      slug: ent.name,
      prompt: readTextOrEmpty(path.join(dir, 'prompt.md')),
      wrong: readTextOrEmpty(path.join(dir, 'wrong.md')),
      correction: readTextOrEmpty(path.join(dir, 'correction.md')),
      learning: readTextOrEmpty(path.join(dir, 'learning.md')),
      rubric: fs.existsSync(path.join(dir, 'rubric.md')) ? readTextOrEmpty(path.join(dir, 'rubric.md')) : null,
    });
  }
  notes.sort((a, b) => a.slug.localeCompare(b.slug));
  return notes;
}

export function archiveSessionNote(config: Config, note: SessionNote): void {
  const archived = resolvePath(config.paths.archived);
  ensureDir(archived);
  const dest = path.join(archived, note.slug);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.renameSync(note.dir, dest);
}

export function writeLearning(note: SessionNote, newText: string): void {
  const p = path.join(note.dir, 'learning.md');
  writeTextAtomic(p, newText);
  note.learning = newText;
}

export function writeRubric(note: SessionNote, rubricText: string): void {
  const p = path.join(note.dir, 'rubric.md');
  if (fs.existsSync(p)) {
    // Rubrics are immutable once written. Refuse.
    throw new Error(`rubric.md already exists for ${note.slug}; rubrics are immutable`);
  }
  writeTextAtomic(p, rubricText);
  note.rubric = rubricText;
}

export function rubricOnDisk(note: SessionNote): string | null {
  const p = path.join(note.dir, 'rubric.md');
  return fs.existsSync(p) ? readTextOrEmpty(p) : null;
}

export function writeRunTranscript(config: Config, learningId: string, transcript: unknown): string {
  const dir = resolvePath(path.join(config.paths.runs, learningId));
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = path.join(dir, `${ts}.json`);
  writeTextAtomic(p, JSON.stringify(transcript, null, 2));
  return p;
}
