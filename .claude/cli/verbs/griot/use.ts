import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { DispatchResult, GriotCliContext } from './index.ts';

// Hardcoded path: tier-separation invariant. The substrate's learnings
// system has multiple tiers; only the rollup is loaded at session time.
// Other learnings tiers are valid inputs only to /griot-compact and must
// not be read here. The CITATION_CONTRACT constant below documents the
// rule for the LLM consumer of this verb's output.
const ROLLUP_PATH = 'learnings/rollup.json';
// Legacy path used only for the format-detection error path that fires
// when a mid-flight session sees the pre-Phase-4-rollup file shape.
const LEGACY_ROLLUP_PATH = ROLLUP_PATH.replace(/\.json$/, '.md');

// Top-N cap on the `## Project antipatterns` section. Antipatterns earn
// fewer tokens-per-byte than learnings, so curating the section to a
// bounded prefix keeps /griot-use injection cost predictable as the
// section grows. Source-of-truth ordering is rollup.json's array order;
// "most relevant" reordering is post-Phase-5 work.
const ANTIPATTERN_TOP_N = 10;

type RollupEntry = {
  id: string;
  title: string;
  classification: 'L' | 'AP';
  promoted: string;
  origin: string;
  body: string;
  rubric: string[] | null;
  evaluator?: string;
  code?: string;
};

const CITATION_CONTRACT = `## Citation contract

For the remainder of this session: if you apply any of the learnings or antipatterns from the rollup to a response — whether avoiding a pattern it warns against, using a pattern it prefers, or structuring output the way an entry dictates — end that response with \`Applied: L-NNN\` (for learnings) or \`Applied: AP-NNN\` (for antipatterns), comma-separated when multiple apply: \`Applied: L-012, AP-003\`.

Only cite an entry when you actively used it. Don't cite one just because it was relevant-adjacent. The Stop hook greps the transcript for \`Applied: (L|AP)-\\d+\` and updates citations.json accordingly — padded citations poison that signal.

## Tier separation

Only the rollup is loaded at session time. Do not read \`learnings/session-notes/\`, \`learnings/nightly/\`, or anything else under the learnings folder during a session — those layers are allowed to contradict the rollup and are only valid inputs to \`/griot-compact\`.
`;

function renderLearning(e: RollupEntry): string {
  const parts: string[] = [`## ${e.id}: ${e.title}`, ''];
  if (e.promoted) parts.push(`Promoted: ${e.promoted}`);
  if (e.origin) parts.push(`Origin: ${e.origin}`);
  if (e.promoted || e.origin) parts.push('');
  parts.push('### Learning', '', e.body);
  if (e.rubric !== null && e.rubric.length > 0) {
    parts.push('', '### Rubric', '');
    for (const c of e.rubric) {
      parts.push(`- ${c}`);
    }
  }
  return `${parts.join('\n')}\n`;
}

function renderAntipattern(e: RollupEntry): string {
  const parts: string[] = [`### ${e.id}: ${e.title}`, ''];
  if (e.promoted) parts.push(`Promoted: ${e.promoted}`);
  if (e.origin) parts.push(`Origin: ${e.origin}`);
  parts.push('Classification: generator-antipattern');
  if (e.evaluator !== undefined) parts.push(`Evaluator: ${e.evaluator}`);
  if (e.code !== undefined) parts.push(`Code: ${e.code}`);
  parts.push('', e.body);
  return `${parts.join('\n')}\n`;
}

type RenderResult = {
  body: string;
  learningCount: number;
  antipatternCount: number;
};

function renderRollup(entries: RollupEntry[]): RenderResult {
  const learnings = entries.filter((e) => e.classification === 'L');
  const antipatterns = entries.filter((e) => e.classification === 'AP');

  const learningSection = learnings.map(renderLearning).join('\n');

  let antipatternSection = '';
  if (antipatterns.length > 0) {
    const capped = antipatterns.slice(0, ANTIPATTERN_TOP_N);
    const elidedCount = antipatterns.length - capped.length;
    antipatternSection = `## Project antipatterns\n\n${capped.map(renderAntipattern).join('\n')}`;
    if (elidedCount > 0) {
      antipatternSection += `\n_(+${elidedCount} more antipatterns not shown — top-${ANTIPATTERN_TOP_N} curated)_\n`;
    }
  }

  const body =
    antipatterns.length > 0
      ? `${learningSection}\n${antipatternSection}`
      : learningSection;
  return {
    body,
    learningCount: learnings.length,
    antipatternCount: antipatterns.length,
  };
}

export function useVerb(rest: string[], ctx: GriotCliContext): DispatchResult {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        as: { type: 'string' },
      },
      allowPositionals: false,
      args: rest,
    });
  } catch (err) {
    return {
      stderr: `griot-use-error: argument parse failure: ${(err as Error).message}`,
      exitCode: 1,
    };
  }
  const asValue = parsed.values.as ?? 'llm';
  if (asValue !== 'llm') {
    return {
      stderr: `griot-use-error: unknown --as value '${asValue}' (supported: llm)`,
      exitCode: 1,
    };
  }

  const rollupPath = resolve(ctx.cwd, ROLLUP_PATH);
  const legacyPath = resolve(ctx.cwd, LEGACY_ROLLUP_PATH);

  // Format-detection error path (whiteboard skeptic Finding 1 / Phase 4
  // rollup): if the legacy rollup.md is present but rollup.json is
  // missing, the cutover hasn't happened yet — fail loudly rather than
  // silently mis-loading or returning no-rollup-yet.
  if (!existsSync(rollupPath) && existsSync(legacyPath)) {
    return {
      stderr: `griot-use-error: legacy ${LEGACY_ROLLUP_PATH} present but ${ROLLUP_PATH} missing — Phase 4 rollup cutover incomplete. Run \`node .claude/scripts/migrate-rollup-md-to-json.ts\` and restart session.`,
      exitCode: 1,
    };
  }

  if (!existsSync(rollupPath)) {
    return {
      stdout: 'griot-use: no rollup yet — run `/griot-compact` once captures exist',
      exitCode: 0,
    };
  }

  let entries: RollupEntry[];
  try {
    const raw = readFileSync(rollupPath, 'utf-8');
    entries = JSON.parse(raw);
  } catch (err) {
    return {
      stderr: `griot-use-error: unable to read or parse ${ROLLUP_PATH}: ${(err as Error).message}`,
      exitCode: 1,
    };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      stdout: 'griot-use: rollup empty — no validated learnings yet',
      exitCode: 0,
    };
  }

  const { body, learningCount, antipatternCount } = renderRollup(entries);

  const statusLine =
    antipatternCount === 0
      ? `griot-use: loaded ${learningCount} learnings from ${ROLLUP_PATH}\n`
      : `griot-use: loaded ${learningCount} learnings + ${antipatternCount} antipatterns from ${ROLLUP_PATH}\n`;

  const stdout = `${statusLine}\n${body}\n${CITATION_CONTRACT.trimEnd()}`;
  return { stdout, exitCode: 0 };
}
