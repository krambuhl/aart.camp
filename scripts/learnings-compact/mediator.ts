// The mediator is a pure router. It does NOT evaluate content. It:
//   1. Generates control + treatment outputs from the test-subject model
//   2. Dispatches the judge panel across up to 3 rounds
//   3. Applies consensus thresholds
//   4. Detects contested / tier-split patterns
//   5. Records per-judge and per-round token usage
//   6. Writes the full transcript to learnings/runs/<learning-id>/<ts>.json
//
// The mediator cannot override unanimous verdicts. If round 3 fails to reach
// 5/7 and no tiebreak applies, it returns NO_CONSENSUS and the operator
// takes over.

import { callClaudeSafe } from './anthropic';
import { runJudgePanel } from './judges';
import type { Config, JudgeVerdict, PanelResult, PanelRound, Role, TokenUsage, Verdict } from './types';
import { addUsage, emptyUsage } from './types';

// Summarise votes into { verdict → count } excluding errored judges.
function tally(verdicts: JudgeVerdict[]): Record<Verdict, number> {
  const out: Record<Verdict, number> = {
    IMPROVED: 0,
    UNCHANGED: 0,
    REGRESSED: 0,
    DID_NOT_REPRODUCE: 0,
  };
  for (const v of verdicts) {
    if (v.errored) continue;
    out[v.verdict]++;
  }
  return out;
}

function pickMajority(counts: Record<Verdict, number>): { verdict: Verdict; count: number } {
  let best: Verdict = 'UNCHANGED';
  let bestCount = -1;
  for (const [k, c] of Object.entries(counts) as [Verdict, number][]) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return { verdict: best, count: bestCount };
}

function isTiebreakOnTopTierA(config: Config, verdicts: JudgeVerdict[]): Verdict | null {
  // Per the design: if evenly split and both top-current ("4.7") judges agree,
  // their verdict wins.
  const topA = config.judges.filter((j) => j.tier === 'top-current');
  if (topA.length !== 2) return null;
  const topAVerdicts = topA.map((j) => verdicts.find((v) => v.judge_id === j.id));
  if (!topAVerdicts.every((v) => v && !v.errored)) return null;
  const [a, b] = topAVerdicts;
  if (a && b && a.verdict === b.verdict) return a.verdict;
  return null;
}

function detectTierSplit(config: Config, verdicts: JudgeVerdict[]): boolean {
  // "All top-tier (current + previous) vs. all non-top" pattern.
  const topIds = new Set(config.judges.filter((j) => j.tier === 'top-current' || j.tier === 'top-previous').map((j) => j.id));
  const top = verdicts.filter((v) => topIds.has(v.judge_id) && !v.errored);
  const rest = verdicts.filter((v) => !topIds.has(v.judge_id) && !v.errored);
  if (top.length === 0 || rest.length === 0) return false;
  const topSet = new Set(top.map((v) => v.verdict));
  const restSet = new Set(rest.map((v) => v.verdict));
  if (topSet.size !== 1 || restSet.size !== 1) return false;
  return [...topSet][0] !== [...restSet][0];
}

function roundResult(config: Config, verdicts: JudgeVerdict[], roundNum: 1 | 2 | 3): PanelRound {
  const counts = tally(verdicts);
  const { verdict: majority, count } = pickMajority(counts);

  const threshold = roundNum === 1 ? config.consensus.round_1_blind : roundNum === 2 ? config.consensus.round_2_debate : config.consensus.round_3_final;

  const thresholdMet = count >= threshold;
  return {
    round: roundNum,
    verdicts,
    consensus_verdict: thresholdMet ? majority : null,
    threshold_met: thresholdMet,
  };
}

interface RunPanelArgs {
  config: Config;
  prompt: string;
  correction: string;
  learning: string;
  rubric: string;
  onTokens?: (role: Role, usage: TokenUsage, judgeId?: string) => void;
}

async function generateOutput(args: {
  config: Config;
  prompt: string;
  injectedLearning: string | null;
  onTokens?: (role: Role, usage: TokenUsage) => void;
}): Promise<{ text: string; usage: TokenUsage }> {
  const system = args.injectedLearning
    ? `You are Claude, helping with a software task in the aart.camp repo. Before answering, consider this validated learning and apply it if relevant:\n\n<learning>\n${args.injectedLearning.trim()}\n</learning>`
    : 'You are Claude, helping with a software task in the aart.camp repo.';

  const res = await callClaudeSafe({
    model: args.config.test_subject.model,
    system,
    userMessage: args.prompt,
    maxTokens: args.config.test_subject.max_tokens,
    timeoutMs: args.config.execution.agent_timeout_ms,
  });

  args.onTokens?.('test_subject', res.usage);

  if (res.errored || !res.text) {
    return {
      text: `[test-subject call errored: ${res.errorMessage ?? 'unknown'}]`,
      usage: res.usage,
    };
  }
  return { text: res.text, usage: res.usage };
}

export async function runMediatedPanel(args: RunPanelArgs): Promise<PanelResult> {
  const rounds: PanelRound[] = [];
  const byJudge: Record<string, TokenUsage> = {};
  let total = emptyUsage();

  // Step 1: generate control + treatment. Both use the same user prompt;
  // only the system prompt differs.
  const control = await generateOutput({
    config: args.config,
    prompt: args.prompt,
    injectedLearning: null,
    onTokens: (role, usage) => args.onTokens?.(role, usage),
  });
  total = addUsage(total, control.usage);

  const treatment = await generateOutput({
    config: args.config,
    prompt: args.prompt,
    injectedLearning: args.learning,
    onTokens: (role, usage) => args.onTokens?.(role, usage),
  });
  total = addUsage(total, treatment.usage);

  // Step 2: up to 3 rounds.
  let priorRound: JudgeVerdict[] | undefined;
  for (const roundNum of [1, 2, 3] as const) {
    const verdicts = await runJudgePanel({
      config: args.config,
      prompt: args.prompt,
      correction: args.correction,
      learning: args.learning,
      rubric: args.rubric,
      output_control: control.text,
      output_treatment: treatment.text,
      priorRound,
    });

    for (const v of verdicts) {
      byJudge[v.judge_id] = addUsage(byJudge[v.judge_id] ?? emptyUsage(), v.tokens);
      total = addUsage(total, v.tokens);
      args.onTokens?.('judge', v.tokens, v.judge_id);
    }

    const round = roundResult(args.config, verdicts, roundNum);
    rounds.push(round);

    if (round.threshold_met) {
      return finalize(args.config, rounds, control.text, treatment.text, total, byJudge);
    }

    priorRound = verdicts;
  }

  // All three rounds exhausted without consensus. Try tier-weighted tiebreak.
  const last = rounds[rounds.length - 1].verdicts;
  const tiebreak = isTiebreakOnTopTierA(args.config, last);
  if (tiebreak) {
    return finalize(args.config, rounds, control.text, treatment.text, total, byJudge, tiebreak, /* contested */ true);
  }

  return finalize(args.config, rounds, control.text, treatment.text, total, byJudge, /* overrideVerdict */ null, /* contested */ true, /* noConsensus */ true);
}

function finalize(
  config: Config,
  rounds: PanelRound[],
  control: string,
  treatment: string,
  total: TokenUsage,
  byJudge: Record<string, TokenUsage>,
  overrideVerdict: Verdict | null = null,
  contestedOverride = false,
  noConsensus = false,
): PanelResult {
  const lastRound = rounds[rounds.length - 1];
  let finalVerdict: Verdict | 'NO_CONSENSUS';
  if (overrideVerdict) finalVerdict = overrideVerdict;
  else if (noConsensus) finalVerdict = 'NO_CONSENSUS';
  else finalVerdict = lastRound.consensus_verdict ?? 'NO_CONSENSUS';

  // A verdict is contested if it took more than one round or a tiebreak.
  const contested = contestedOverride || rounds.length > 1;

  const tierSplit = detectTierSplit(config, lastRound.verdicts);

  return {
    rounds,
    final_verdict: finalVerdict,
    contested,
    tier_split: tierSplit,
    output_control: control,
    output_treatment: treatment,
    tokens: total,
    by_judge: byJudge,
    timestamp: new Date().toISOString(),
  };
}
