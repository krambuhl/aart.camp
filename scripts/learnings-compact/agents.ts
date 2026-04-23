// Three agent roles: rubric-author, rewriter, operator.
//
// rubric-author: fresh context. Sees only correction.md and wrong.md.
//   Writes rubric.md — 2-3 binary assertions. After writing, immutable.
//
// rewriter: reads current learning, rubric, and last judge panel reasoning.
//   Proposes a new learning.md. Cannot modify rubric.md (enforced by io.ts
//   + operator verification before the mediator re-runs).
//
// operator: pipeline-wide invariant enforcer. Runs the corrective ladder
//   before escalating to humans. Logs every intervention.

import { callClaudeSafe, type ToolSpec } from './anthropic';
import { writeLearning, writeRubric } from './io';
import type { Config, JudgeVerdict, OperatorIntervention, Role, SessionNote, TokenUsage } from './types';

// ─── rubric-author ──────────────────────────────────────────────────────────

const RUBRIC_TOOL: ToolSpec = {
  name: 'submit_rubric',
  description: 'Submit a rubric of 2-3 binary assertions derived from the correction.',
  input_schema: {
    type: 'object',
    properties: {
      assertions: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'string',
          description: "A binary statement phrased as 'Output does X' or 'Output does not do X'. Concrete, regex-checkable where possible.",
        },
      },
    },
    required: ['assertions'],
  },
};

const RUBRIC_SYSTEM = `
You are the rubric-author for a self-validating learnings benchmark. You have
a fresh context: the ONLY inputs you have are the user's correction and
Claude's wrong output. You do NOT see the candidate learning.

Your job: produce 2-3 binary assertions that capture what the correction
demands. Each assertion is a single pass/fail check a judge can evaluate by
looking at a Claude output.

Good assertions:
  - "Output does not contain \`SpacerWithCss\`"
  - "Output uses \`Stack\` with a \`spacing\` prop for layout"
  - "\`Stack\` is imported from \`@patreon/studio-ui\`"

Bad assertions:
  - "Output is well-written" (not binary)
  - "Output follows project conventions" (not concrete)
  - "Output is correct" (not falsifiable)

Aim for cheap-regex-checkable where the subject matter allows. When the
lesson is about prose or structure, phrase the assertion so a judge can
answer yes/no from a single read.

Call submit_rubric exactly once.
`.trim();

interface RubricAuthorArgs {
  config: Config;
  note: SessionNote;
  onTokens?: (role: Role, usage: TokenUsage) => void;
}

export async function runRubricAuthor(args: RubricAuthorArgs): Promise<{ assertions: string[]; rubricMarkdown: string; usage: TokenUsage }> {
  const userMessage = [
    '## Wrong output (what Claude said/did)',
    '',
    '```',
    args.note.wrong.trim(),
    '```',
    '',
    "## Correction (user's ground truth)",
    '',
    args.note.correction.trim(),
    '',
    '---',
    '',
    'Derive 2-3 binary assertions. Submit via the `submit_rubric` tool.',
  ].join('\n');

  const res = await callClaudeSafe({
    model: args.config.agents.rubric_author.model,
    system: RUBRIC_SYSTEM,
    userMessage,
    maxTokens: args.config.agents.rubric_author.max_tokens,
    tool: RUBRIC_TOOL,
    timeoutMs: args.config.execution.agent_timeout_ms,
  });

  args.onTokens?.('rubric_author', res.usage);

  if (res.errored || !res.toolInput) {
    throw new Error(`rubric-author failed for ${args.note.slug}: ${res.errorMessage ?? 'no tool output'}`);
  }

  const { assertions } = res.toolInput as { assertions: string[] };
  const rubricMarkdown = [
    '# Rubric',
    '',
    '_Immutable. Written by rubric-author with fresh context. Any attempt to',
    'modify this file is a hard violation._',
    '',
    ...assertions.map((a) => `- ${a}`),
    '',
  ].join('\n');

  writeRubric(args.note, rubricMarkdown);

  return { assertions, rubricMarkdown, usage: res.usage };
}

// ─── rewriter ───────────────────────────────────────────────────────────────

const LEARNING_TOOL: ToolSpec = {
  name: 'submit_learning',
  description: 'Submit a revised learning.md body.',
  input_schema: {
    type: 'object',
    properties: {
      learning: {
        type: 'string',
        description: 'The revised lesson, 1-2 paragraphs, concrete and actionable. Name forbidden and preferred things.',
      },
    },
    required: ['learning'],
  },
};

const REWRITER_SYSTEM = `
You are the rewriter for a self-validating learnings benchmark. The previous
learning text failed the judge panel. Your job: propose a revised learning.md
that passes the rubric when injected into Claude's system prompt.

HARD RULES:
  - You cannot change the rubric. The rubric is immutable. Attempting to
    describe or reference changing it will cause immediate escalation.
  - Rewrite the learning text so Claude applying it to the origin prompt
    produces output that satisfies every rubric assertion.
  - Keep it 1-2 paragraphs. Concrete, actionable. Name forbidden things and
    preferred things. Don't explain architecture.

You may consider: what assertion did the previous attempt fail? Make the
lesson sharper on that axis. If the panel thought the lesson was too broad,
narrow it. If too narrow, generalise.

Call submit_learning exactly once.
`.trim();

interface RewriterArgs {
  config: Config;
  note: SessionNote;
  lastVerdicts: JudgeVerdict[];
  attemptNumber: number;
  onTokens?: (role: Role, usage: TokenUsage) => void;
}

export async function runRewriter(args: RewriterArgs): Promise<{ newLearning: string; usage: TokenUsage }> {
  const panelSummary = args.lastVerdicts
    .filter((v) => !v.errored)
    .map((v) => `- **${v.judge_id}** voted ${v.verdict}: ${v.reasoning}`)
    .join('\n');

  const userMessage = [
    `## Attempt ${args.attemptNumber} of ${args.config.rewrite.max_attempts}`,
    '',
    '## Origin prompt',
    '',
    args.note.prompt.trim(),
    '',
    '## Correction (ground truth)',
    '',
    args.note.correction.trim(),
    '',
    '## Current learning (failed)',
    '',
    args.note.learning.trim(),
    '',
    '## Rubric (immutable)',
    '',
    (args.note.rubric ?? '').trim(),
    '',
    '## Last judge panel reasoning',
    '',
    panelSummary,
    '',
    '---',
    '',
    'Revise the learning. Submit via `submit_learning` tool.',
  ].join('\n');

  const res = await callClaudeSafe({
    model: args.config.agents.rewriter.model,
    system: REWRITER_SYSTEM,
    userMessage,
    maxTokens: args.config.agents.rewriter.max_tokens,
    tool: LEARNING_TOOL,
    timeoutMs: args.config.execution.agent_timeout_ms,
  });

  args.onTokens?.('rewriter', res.usage);

  if (res.errored || !res.toolInput) {
    throw new Error(`rewriter failed for ${args.note.slug} attempt ${args.attemptNumber}: ${res.errorMessage ?? 'no tool output'}`);
  }

  const { learning } = res.toolInput as { learning: string };
  writeLearning(args.note, learning);
  return { newLearning: learning, usage: res.usage };
}

// ─── operator ───────────────────────────────────────────────────────────────

// The operator is not a single Claude call — it's a sequence of invariant
// checks and, where a check fires, a corrective step. Some steps use Claude
// (to diagnose patterns for human-review PRs); most are deterministic.
//
// Operator responsibilities:
//   1. Detect rubric tampering between rewriter runs.
//   2. Detect failure patterns after 5 failed rewrites.
//   3. Log every intervention to operator-log.jsonl.
//   4. Decide whether to escalate to a human-review PR.

import fs from 'node:fs';
import path from 'node:path';
import { resolvePath } from './config';
import { appendJsonlLine } from './io';

export function verifyRubricUnchanged(note: SessionNote, expectedRubric: string): { ok: true } | { ok: false; actual: string } {
  const rubricPath = path.join(note.dir, 'rubric.md');
  const actual = fs.readFileSync(rubricPath, 'utf8');
  if (actual !== expectedRubric) {
    return { ok: false, actual };
  }
  return { ok: true };
}

export function logOperator(config: Config, intervention: OperatorIntervention): void {
  appendJsonlLine(resolvePath(config.paths.operator_log), intervention);
}

const DIAGNOSIS_TOOL: ToolSpec = {
  name: 'submit_diagnosis',
  description: 'Submit a diagnosis categorising why the 5 rewrite attempts failed.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['same_assertion_fails_every_attempt', 'different_assertions_fail_each_attempt', 'control_and_treatment_always_identical', 'other'],
      },
      notes: {
        type: 'string',
        description: 'One or two sentences expanding on the category with specifics from the attempts.',
      },
    },
    required: ['category', 'notes'],
  },
};

const OPERATOR_SYSTEM = `
You are the operator for a self-validating learnings benchmark. Five rewrite
attempts have failed for a single candidate learning. You do NOT propose a
fix — you categorise the failure so a human reviewer knows what kind of
decision to make.

Pick the one category that best fits. Be specific in notes.

Categories:
  - same_assertion_fails_every_attempt — rubric is likely wrong.
  - different_assertions_fail_each_attempt — multi-faceted; consider splitting.
  - control_and_treatment_always_identical — prompt doesn't reproduce.
  - other — explain in notes.
`.trim();

export interface OperatorDiagnosis {
  category: 'same_assertion_fails_every_attempt' | 'different_assertions_fail_each_attempt' | 'control_and_treatment_always_identical' | 'other';
  notes: string;
}

export async function diagnoseStuckLearning(args: {
  config: Config;
  note: SessionNote;
  attempts: { learningText: string; verdicts: JudgeVerdict[] }[];
  onTokens?: (role: Role, usage: TokenUsage) => void;
}): Promise<OperatorDiagnosis> {
  const attemptSummary = args.attempts
    .map(
      (att, i) =>
        `### Attempt ${i + 1}\n\nLearning:\n\n> ${att.learningText.replace(/\n/g, '\n> ')}\n\nVerdicts:\n\n${att.verdicts
          .filter((v) => !v.errored)
          .map(
            (v) =>
              `- ${v.judge_id}: ${v.verdict} (control ${v.control_pass_count}/${v.control_evals.length}, treatment ${v.treatment_pass_count}/${v.treatment_evals.length})`,
          )
          .join('\n')}`,
    )
    .join('\n\n---\n\n');

  const userMessage = [
    '## Rubric (immutable)',
    '',
    (args.note.rubric ?? '').trim(),
    '',
    '## Origin prompt',
    '',
    args.note.prompt.trim(),
    '',
    '## Correction',
    '',
    args.note.correction.trim(),
    '',
    '## Five attempts',
    '',
    attemptSummary,
    '',
    'Categorise via `submit_diagnosis` tool.',
  ].join('\n');

  const res = await callClaudeSafe({
    model: args.config.agents.operator.model,
    system: OPERATOR_SYSTEM,
    userMessage,
    maxTokens: args.config.agents.operator.max_tokens,
    tool: DIAGNOSIS_TOOL,
    timeoutMs: args.config.execution.agent_timeout_ms,
  });

  args.onTokens?.('operator', res.usage);

  if (res.errored || !res.toolInput) {
    return {
      category: 'other',
      notes: `diagnosis errored: ${res.errorMessage ?? 'unknown'}`,
    };
  }

  return res.toolInput as OperatorDiagnosis;
}
