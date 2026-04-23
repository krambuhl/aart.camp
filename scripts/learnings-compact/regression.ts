// After all session-notes are processed, re-run the full rollup against every
// archived origin prompt to detect regressions.
//
// For each rollup entry (L-NNN):
//   1. Load its origin prompt + rubric from the archived session-note.
//   2. Run the test subject on the prompt with the CURRENT full rollup injected.
//   3. Ask one judge (we keep the regression suite cheap — single judge, top
//      tier) whether the output passes every rubric assertion.
//   4. If not, append to regressions.jsonl.

import fs from 'node:fs';
import path from 'node:path';
import { callClaudeSafe, type ToolSpec } from './anthropic';
import { resolvePath } from './config';
import { appendJsonlLine, readTextOrEmpty } from './io';
import { readAllRollupEntries } from './rollup';
import type { Config, Role, TokenUsage } from './types';
import { addUsage, emptyUsage } from './types';

const PASS_CHECK_TOOL: ToolSpec = {
  name: 'submit_check',
  description: 'Report whether the treatment output passes every rubric assertion.',
  input_schema: {
    type: 'object',
    properties: {
      all_pass: { type: 'boolean' },
      failed_assertions: {
        type: 'array',
        items: { type: 'string' },
      },
      reasoning: { type: 'string' },
    },
    required: ['all_pass', 'failed_assertions', 'reasoning'],
  },
};

export interface RegressionResult {
  passing: number;
  failing: number;
  new_failures: { id: string; failed_assertions: string[]; reasoning: string }[];
  tokens: TokenUsage;
}

export async function runRegressionSuite(args: {
  config: Config;
  previousPassing: Set<string>; // ids known to have passed in the prior bench-history line
  onTokens?: (role: Role, usage: TokenUsage) => void;
}): Promise<RegressionResult> {
  const entries = readAllRollupEntries(args.config);
  if (entries.length === 0) {
    return { passing: 0, failing: 0, new_failures: [], tokens: emptyUsage() };
  }

  const fullRollup = readTextOrEmpty(resolvePath(args.config.paths.rollup));
  let tokens = emptyUsage();
  let passing = 0;
  let failing = 0;
  const newFailures: { id: string; failed_assertions: string[]; reasoning: string }[] = [];

  // Run sequentially to avoid rate-limit spikes; the full rollup can be large.
  for (const entry of entries) {
    const archivedDir = path.join(resolvePath(args.config.paths.archived), entry.originSlug);
    const promptPath = path.join(archivedDir, 'prompt.md');
    if (!fs.existsSync(promptPath)) {
      continue; // can't regression-test an entry whose origin is missing
    }
    const prompt = readTextOrEmpty(promptPath);

    // Generate treatment with the FULL current rollup as context.
    const treatmentRes = await callClaudeSafe({
      model: args.config.test_subject.model,
      system: `You are Claude. Apply the validated learnings below where relevant.\n\n${fullRollup}`,
      userMessage: prompt,
      maxTokens: args.config.test_subject.max_tokens,
      timeoutMs: args.config.execution.agent_timeout_ms,
    });
    tokens = addUsage(tokens, treatmentRes.usage);
    args.onTokens?.('regression_suite', treatmentRes.usage);
    if (treatmentRes.errored || !treatmentRes.text) continue;

    // Check pass.
    const checkRes = await callClaudeSafe({
      model: 'claude-opus-4-7',
      system: 'You evaluate whether a Claude output passes every assertion in a rubric. Binary. Use the submit_check tool.',
      userMessage: ['## Rubric', '', entry.rubric, '', '## Output to check', '', '```', treatmentRes.text, '```'].join('\n'),
      maxTokens: 1200,
      tool: PASS_CHECK_TOOL,
      timeoutMs: args.config.execution.agent_timeout_ms,
    });
    tokens = addUsage(tokens, checkRes.usage);
    args.onTokens?.('regression_suite', checkRes.usage);

    if (checkRes.errored || !checkRes.toolInput) {
      continue;
    }
    const check = checkRes.toolInput as {
      all_pass: boolean;
      failed_assertions: string[];
      reasoning: string;
    };

    if (check.all_pass) {
      passing++;
    } else {
      failing++;
      const wasPassing = args.previousPassing.has(entry.id);
      if (wasPassing) {
        appendJsonlLine(resolvePath(args.config.paths.regressions), {
          timestamp: new Date().toISOString(),
          learning_id: entry.id,
          failed_assertions: check.failed_assertions,
          reasoning: check.reasoning,
        });
        newFailures.push({
          id: entry.id,
          failed_assertions: check.failed_assertions,
          reasoning: check.reasoning,
        });
      }
    }
  }

  return { passing, failing, new_failures: newFailures, tokens };
}

// Read the previous bench-history line's "passing" set from an attached
// helper field. We store the set of passing ids in each bench-history line
// so the next run can compare. If the file doesn't exist, every entry is
// treated as "new."
export function previousPassingSet(config: Config): Set<string> {
  const p = resolvePath(config.paths.bench_history);
  if (!fs.existsSync(p)) return new Set();
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return new Set();
  try {
    const last = JSON.parse(lines[lines.length - 1]);
    return new Set<string>(last.passing_ids ?? []);
  } catch {
    return new Set();
  }
}
