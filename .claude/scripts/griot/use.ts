#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Hardcoded path: tier-separation invariant. The substrate's learnings
// system has multiple tiers; only the rollup is loaded at session time.
// Other learnings tiers are valid inputs only to /griot-compact and must
// not be read here. The contract block below documents the rule for the
// LLM consumer of this script's output.
const ROLLUP_PATH = 'learnings/rollup.md';

function fail(reason: string): never {
  process.stderr.write(`griot-use-error: ${reason}\n`);
  process.exit(1);
}

function countLearnings(content: string): number {
  // Match `## L-NNN` headings anywhere on a line (not just first).
  const re = /^## L-\d+\b/gm;
  return (content.match(re) ?? []).length;
}

const CITATION_CONTRACT = `## Citation contract

For the remainder of this session: if you apply any of the learnings from \`rollup.md\` to a response — whether avoiding a pattern it warns against, using a pattern it prefers, or structuring output the way an entry dictates — end that response with \`Applied: L-NNN\` (or comma-separated: \`Applied: L-012, L-027\`) on its own line.

Only cite a learning when you actively used it. Don't cite a learning just because it was relevant-adjacent. The Stop hook greps the transcript for \`Applied: L-\\d+\` and updates citations.json accordingly — padded citations poison that signal.

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

  const count = countLearnings(content);
  if (count === 0) {
    process.stdout.write('griot-use: rollup empty — no validated learnings yet\n');
    process.exit(0);
  }

  process.stdout.write(`griot-use: loaded ${count} learnings from ${ROLLUP_PATH}\n\n`);
  process.stdout.write(content);
  if (!content.endsWith('\n')) process.stdout.write('\n');
  process.stdout.write('\n');
  process.stdout.write(CITATION_CONTRACT);
}

main();
