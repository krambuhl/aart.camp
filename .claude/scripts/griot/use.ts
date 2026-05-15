#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Hardcoded path: tier-separation invariant. The substrate's learnings
// system has multiple tiers; only the rollup is loaded at session time.
// Other learnings tiers are valid inputs only to /griot-compact and must
// not be read here. The contract block below documents the rule for the
// LLM consumer of this script's output.
const ROLLUP_PATH = 'learnings/rollup.md';

// Top-N cap on the `## Project antipatterns` section. Antipatterns earn
// fewer tokens-per-byte than learnings, so curating the section to a
// bounded prefix keeps /griot-use injection cost predictable as the
// section grows. Source-of-truth ordering is rollup.md's promotion
// order; "most relevant" reordering is post-Phase-5 work.
const ANTIPATTERN_TOP_N = 10;

function fail(reason: string): never {
  process.stderr.write(`griot-use-error: ${reason}\n`);
  process.exit(1);
}

function countLearnings(content: string): number {
  // Match `## L-NNN` headings anywhere on a line.
  const re = /^## L-\d+\b/gm;
  return (content.match(re) ?? []).length;
}

function countAntipatterns(content: string): number {
  // Match `### AP-NNN` headings (third-level — antipatterns nest under
  // the `## Project antipatterns` section header).
  const re = /^### AP-\d+\b/gm;
  return (content.match(re) ?? []).length;
}

function curateAntipatterns(content: string): { curated: string; elidedCount: number } {
  // Find the `## Project antipatterns` section. If absent, no-op.
  const sectionRe = /^## Project antipatterns\s*$/m;
  const match = content.match(sectionRe);
  if (!match || match.index === undefined) {
    return { curated: content, elidedCount: 0 };
  }
  const sectionStart = match.index;
  const sectionHeaderEnd = sectionStart + match[0].length;
  // Section extends until the next `## ` header (or end of file).
  const rest = content.slice(sectionHeaderEnd);
  const nextSection = rest.search(/^## /m);
  const sectionEnd = nextSection === -1 ? content.length : sectionHeaderEnd + nextSection;
  const sectionBody = content.slice(sectionHeaderEnd, sectionEnd);

  // Split section body into AP-NNN entries by `### AP-` boundaries.
  const entryRe = /^### AP-\d+\b/gm;
  const entryStarts: number[] = [];
  for (const m of sectionBody.matchAll(entryRe)) {
    if (m.index !== undefined) entryStarts.push(m.index);
  }
  if (entryStarts.length <= ANTIPATTERN_TOP_N) {
    return { curated: content, elidedCount: 0 };
  }

  // Keep entries [0..TOP_N); elide remainder; append tail summary.
  const cutoff = entryStarts[ANTIPATTERN_TOP_N];
  const keptBody = sectionBody.slice(0, cutoff);
  const elidedCount = entryStarts.length - ANTIPATTERN_TOP_N;
  const tail = `\n_(+${elidedCount} more antipatterns not shown — top-${ANTIPATTERN_TOP_N} curated)_\n\n`;

  const curated = content.slice(0, sectionHeaderEnd) + keptBody + tail + content.slice(sectionEnd);
  return { curated, elidedCount };
}

const CITATION_CONTRACT = `## Citation contract

For the remainder of this session: if you apply any of the learnings or antipatterns from \`rollup.md\` to a response — whether avoiding a pattern it warns against, using a pattern it prefers, or structuring output the way an entry dictates — end that response with \`Applied: L-NNN\` (for learnings) or \`Applied: AP-NNN\` (for antipatterns), comma-separated when multiple apply: \`Applied: L-012, AP-003\`.

Only cite an entry when you actively used it. Don't cite one just because it was relevant-adjacent. The Stop hook greps the transcript for \`Applied: (L|AP)-\\d+\` and updates citations.json accordingly — padded citations poison that signal.

## Tier separation

Only \`rollup.md\` is loaded at session time. Do not read \`learnings/session-notes/\`, \`learnings/nightly/\`, or anything else under \`learnings/\` during a session — those layers are allowed to contradict the rollup and are only valid inputs to \`/griot-compact\`.
`;

function main(): void {
  const rollupPath = resolve(process.cwd(), ROLLUP_PATH);

  if (!existsSync(rollupPath)) {
    process.stdout.write('griot-use: no rollup yet — run `/griot-compact` once captures exist\n');
    process.exit(0);
  }

  let content: string;
  try {
    content = readFileSync(rollupPath, 'utf-8');
  } catch (err) {
    fail(`unable to read ${ROLLUP_PATH}: ${(err as Error).message}`);
  }

  const learningCount = countLearnings(content);
  const antipatternCount = countAntipatterns(content);

  if (learningCount === 0 && antipatternCount === 0) {
    process.stdout.write('griot-use: rollup empty — no validated learnings yet\n');
    process.exit(0);
  }

  // Status line. Preserve the legacy single-noun shape when there are
  // zero antipatterns so existing callers don't see surprise text.
  const statusLine = antipatternCount === 0
    ? `griot-use: loaded ${learningCount} learnings from ${ROLLUP_PATH}\n\n`
    : `griot-use: loaded ${learningCount} learnings + ${antipatternCount} antipatterns from ${ROLLUP_PATH}\n\n`;

  const { curated } = curateAntipatterns(content);

  process.stdout.write(statusLine);
  process.stdout.write(curated);
  if (!curated.endsWith('\n')) process.stdout.write('\n');
  process.stdout.write('\n');
  process.stdout.write(CITATION_CONTRACT);
}

main();
