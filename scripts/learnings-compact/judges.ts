import { callClaudeSafe, type ToolSpec } from './anthropic';
import type { Config, JudgeDef, JudgeVerdict, RubricEval, TokenUsage, Verdict } from './types';

const VERDICT_TOOL: ToolSpec = {
  name: 'submit_verdict',
  description: 'Submit a structured verdict comparing control vs treatment output against the rubric.',
  input_schema: {
    type: 'object',
    properties: {
      control_evals: {
        type: 'array',
        description: 'One entry per rubric assertion, in order. Evaluates the CONTROL output.',
        items: {
          type: 'object',
          properties: {
            assertion: { type: 'string' },
            passes: { type: 'boolean' },
            reasoning: { type: 'string' },
          },
          required: ['assertion', 'passes'],
        },
      },
      treatment_evals: {
        type: 'array',
        description: 'One entry per rubric assertion, in order. Evaluates the TREATMENT output.',
        items: {
          type: 'object',
          properties: {
            assertion: { type: 'string' },
            passes: { type: 'boolean' },
            reasoning: { type: 'string' },
          },
          required: ['assertion', 'passes'],
        },
      },
      verdict: {
        type: 'string',
        enum: ['IMPROVED', 'UNCHANGED', 'REGRESSED', 'DID_NOT_REPRODUCE'],
        description:
          'IMPROVED: treatment passes strictly more assertions than control AND every assertion control failed now passes AND treatment introduces no new failures. UNCHANGED: same pass count. REGRESSED: treatment passes fewer. DID_NOT_REPRODUCE: control already passes every assertion.',
      },
      reasoning: {
        type: 'string',
        description: 'One or two sentences explaining the verdict.',
      },
    },
    required: ['control_evals', 'treatment_evals', 'verdict', 'reasoning'],
  },
};

const BASE_SYSTEM = `
You are a stateless, headless judge for a self-validating learnings benchmark.
Your job: evaluate whether a candidate learning improves Claude's output on
the origin prompt that caused the failure.

You have no tools, no memory, and no context beyond what is in this single
message. Do not speculate about things not in the inputs.

Derive verdict from the rubric MECHANICALLY:
  - IMPROVED: strictly more treatment assertions pass than control,
              AND every assertion control failed now passes in treatment,
              AND treatment introduces no new failures.
  - UNCHANGED: same pass count across control and treatment.
  - REGRESSED: fewer treatment assertions pass than control.
  - DID_NOT_REPRODUCE: control already passes every assertion. The origin
                      prompt failed to reproduce the failure.

Use exact match on rubric assertion strings. If the control and treatment
outputs are effectively identical on every assertion, the verdict is
UNCHANGED (not DID_NOT_REPRODUCE — only use DID_NOT_REPRODUCE when control
already PASSES every assertion).

Evaluate each rubric assertion as plainly as you can. Binary. No hedging.
`.trim();

function buildUserMessage(args: {
  prompt: string;
  correction: string;
  learning: string;
  rubric: string;
  output_control: string;
  output_treatment: string;
  priorReasoning?: { judge_id: string; verdict: Verdict; reasoning: string }[];
}): string {
  const parts: string[] = [];
  parts.push(`## Origin prompt\n\n${args.prompt.trim()}`);
  parts.push(`## Correction (ground truth from the user)\n\n${args.correction.trim()}`);
  parts.push(`## Candidate learning (under evaluation)\n\n${args.learning.trim()}`);
  parts.push(`## Rubric (immutable, binary assertions)\n\n${args.rubric.trim()}`);
  parts.push(`## Control output (Claude given origin prompt with NO learning)\n\n\`\`\`\n${args.output_control}\n\`\`\``);
  parts.push(`## Treatment output (Claude given origin prompt WITH the learning injected)\n\n\`\`\`\n${args.output_treatment}\n\`\`\``);

  if (args.priorReasoning && args.priorReasoning.length > 0) {
    parts.push(
      "## Other judges' reasoning from the previous round\n\n" +
        args.priorReasoning.map((p) => `**${p.judge_id}** (voted ${p.verdict}): ${p.reasoning.trim()}`).join('\n\n'),
    );
    parts.push('You may revise your verdict or hold firm. Do not defer to others — vote your read.');
  }

  parts.push('Call the `submit_verdict` tool with a structured verdict. Evaluate each rubric assertion in order.');

  return parts.join('\n\n---\n\n');
}

interface RunArgs {
  config: Config;
  prompt: string;
  correction: string;
  learning: string;
  rubric: string;
  output_control: string;
  output_treatment: string;
  priorRound?: JudgeVerdict[]; // for debate rounds
}

export async function runJudgePanel(args: RunArgs): Promise<JudgeVerdict[]> {
  const priorReasoning = args.priorRound?.map((v) => ({
    judge_id: v.judge_id,
    verdict: v.verdict,
    reasoning: v.reasoning,
  }));

  const tasks = args.config.judges.map((judge) =>
    runSingleJudge({
      judge,
      prompt: args.prompt,
      correction: args.correction,
      learning: args.learning,
      rubric: args.rubric,
      output_control: args.output_control,
      output_treatment: args.output_treatment,
      priorReasoning,
      timeoutMs: args.config.execution.judge_timeout_ms,
    }),
  );

  // All judges run in parallel. Promise.all is fine because runSingleJudge
  // never throws — it returns an errored JudgeVerdict instead.
  return Promise.all(tasks);
}

async function runSingleJudge(args: {
  judge: JudgeDef;
  prompt: string;
  correction: string;
  learning: string;
  rubric: string;
  output_control: string;
  output_treatment: string;
  priorReasoning?: { judge_id: string; verdict: Verdict; reasoning: string }[];
  timeoutMs: number;
}): Promise<JudgeVerdict> {
  const userMessage = buildUserMessage({
    prompt: args.prompt,
    correction: args.correction,
    learning: args.learning,
    rubric: args.rubric,
    output_control: args.output_control,
    output_treatment: args.output_treatment,
    priorReasoning: args.priorReasoning,
  });

  const res = await callClaudeSafe({
    model: args.judge.model,
    system: BASE_SYSTEM,
    userMessage,
    maxTokens: 2000,
    tool: VERDICT_TOOL,
    timeoutMs: args.timeoutMs,
  });

  if (res.errored || !res.toolInput) {
    return erroredVerdict(args.judge, res.usage, res.errorMessage);
  }

  return parseVerdict(args.judge, res.toolInput, res.usage);
}

function erroredVerdict(judge: JudgeDef, usage: TokenUsage, errorMessage?: string): JudgeVerdict {
  return {
    judge_id: judge.id,
    verdict: 'UNCHANGED', // placeholder — excluded from counts via errored flag
    control_pass_count: 0,
    treatment_pass_count: 0,
    control_evals: [],
    treatment_evals: [],
    reasoning: `errored: ${errorMessage ?? 'unknown'}`,
    errored: true,
    error_message: errorMessage,
    tokens: usage,
  };
}

function parseVerdict(judge: JudgeDef, toolInput: unknown, usage: TokenUsage): JudgeVerdict {
  const input = toolInput as {
    control_evals?: RubricEval[];
    treatment_evals?: RubricEval[];
    verdict?: Verdict;
    reasoning?: string;
  };

  const controlEvals = input.control_evals ?? [];
  const treatmentEvals = input.treatment_evals ?? [];
  const controlPassCount = controlEvals.filter((e) => e.passes).length;
  const treatmentPassCount = treatmentEvals.filter((e) => e.passes).length;

  return {
    judge_id: judge.id,
    verdict: input.verdict ?? 'UNCHANGED',
    control_pass_count: controlPassCount,
    treatment_pass_count: treatmentPassCount,
    control_evals: controlEvals,
    treatment_evals: treatmentEvals,
    reasoning: input.reasoning ?? '',
    errored: false,
    tokens: usage,
  };
}
