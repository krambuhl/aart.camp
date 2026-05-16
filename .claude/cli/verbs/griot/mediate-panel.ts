import type { DispatchResult, GriotCliContext } from './index.ts';

type Verdict = 'IMPROVED' | 'UNCHANGED' | 'REGRESSED' | 'DID_NOT_REPRODUCE';

const VERDICTS: readonly Verdict[] = [
  'IMPROVED',
  'UNCHANGED',
  'REGRESSED',
  'DID_NOT_REPRODUCE',
] as const;

type Tally = Record<Verdict, number>;

type RubricEval = {
  assertion: string;
  passes: boolean;
  reasoning?: string;
};

type ParsedVerdict = {
  judge_id: string;
  tier: string;
  verdict: Verdict;
  control_evals: RubricEval[];
  treatment_evals: RubricEval[];
  reasoning: string;
  errored: boolean;
  error_message?: string;
};

type RawVerdict = {
  judge_id: string;
  tier: string;
  raw_output: string;
};

type Input = {
  round_num: 1 | 2;
  verdicts: RawVerdict[];
  config: {
    consensus: { round_1_blind: number; round_2_debate: number };
    tiebreak: { rule: string; top_tier: string };
  };
};

type Output = {
  round: 1 | 2;
  verdicts: ParsedVerdict[];
  tally: Tally;
  consensus_verdict: Verdict | null;
  threshold_met: boolean;
  tier_split: boolean;
  tiebreak_applied: boolean;
  tiebreak_verdict: Verdict | null;
};

class ValidationError extends Error {}

function fail(reason: string): DispatchResult {
  return {
    stderr: `mediate-panel-error: ${reason}`,
    exitCode: 1,
  };
}

function isVerdict(s: unknown): s is Verdict {
  return typeof s === 'string' && (VERDICTS as readonly string[]).includes(s);
}

function emptyTally(): Tally {
  return { IMPROVED: 0, UNCHANGED: 0, REGRESSED: 0, DID_NOT_REPRODUCE: 0 };
}

const VERDICT_BLOCK_RE = /```\s*verdict\s*\n([\s\S]*?)```/;

function extractVerdictBlock(rawOutput: string): string | null {
  const m = rawOutput.match(VERDICT_BLOCK_RE);
  return m ? m[1].trim() : null;
}

function erroredVerdict(
  judgeId: string,
  tier: string,
  message: string,
): ParsedVerdict {
  // verdict field is a placeholder — the errored flag excludes it from tallies.
  return {
    judge_id: judgeId,
    tier,
    verdict: 'UNCHANGED',
    control_evals: [],
    treatment_evals: [],
    reasoning: '',
    errored: true,
    error_message: message,
  };
}

function parseSingleVerdict(input: RawVerdict): ParsedVerdict {
  const block = extractVerdictBlock(input.raw_output);
  if (block === null) {
    return erroredVerdict(
      input.judge_id,
      input.tier,
      'verdict block not found in raw_output',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (err) {
    return erroredVerdict(
      input.judge_id,
      input.tier,
      `verdict JSON parse error: ${(err as Error).message}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    return erroredVerdict(input.judge_id, input.tier, 'verdict block is not a JSON object');
  }
  const obj = parsed as {
    verdict?: unknown;
    control_evals?: unknown;
    treatment_evals?: unknown;
    reasoning?: unknown;
  };
  if (!isVerdict(obj.verdict)) {
    return erroredVerdict(
      input.judge_id,
      input.tier,
      `unknown or missing verdict: ${JSON.stringify(obj.verdict)}`,
    );
  }
  return {
    judge_id: input.judge_id,
    tier: input.tier,
    verdict: obj.verdict,
    control_evals: Array.isArray(obj.control_evals)
      ? (obj.control_evals as RubricEval[])
      : [],
    treatment_evals: Array.isArray(obj.treatment_evals)
      ? (obj.treatment_evals as RubricEval[])
      : [],
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
    errored: false,
  };
}

function tallyVerdicts(verdicts: ParsedVerdict[]): Tally {
  const t = emptyTally();
  for (const v of verdicts) {
    if (v.errored) continue;
    t[v.verdict]++;
  }
  return t;
}

function pickMajority(tally: Tally): { verdict: Verdict; count: number } {
  let best: Verdict = 'IMPROVED';
  let bestCount = -1;
  for (const v of VERDICTS) {
    if (tally[v] > bestCount) {
      best = v;
      bestCount = tally[v];
    }
  }
  return { verdict: best, count: bestCount };
}

function thresholdFor(roundNum: 1 | 2, config: Input['config']): number {
  return roundNum === 1
    ? config.consensus.round_1_blind
    : config.consensus.round_2_debate;
}

function detectTierSplit(verdicts: ParsedVerdict[], topTier: string): boolean {
  const top = verdicts.filter((v) => !v.errored && v.tier === topTier);
  const rest = verdicts.filter((v) => !v.errored && v.tier !== topTier);
  if (top.length === 0 || rest.length === 0) return false;
  const topVerdicts = new Set(top.map((v) => v.verdict));
  const restVerdicts = new Set(rest.map((v) => v.verdict));
  if (topVerdicts.size !== 1 || restVerdicts.size !== 1) return false;
  const [topV] = topVerdicts;
  const [restV] = restVerdicts;
  return topV !== restV;
}

function applyTiebreak(
  verdicts: ParsedVerdict[],
  tiebreak: Input['config']['tiebreak'],
): { applied: boolean; verdict: Verdict | null } {
  if (tiebreak.rule !== 'top_tier_consensus') {
    return { applied: false, verdict: null };
  }
  const top = verdicts.filter(
    (v) => !v.errored && v.tier === tiebreak.top_tier,
  );
  if (top.length < 2) {
    return { applied: false, verdict: null };
  }
  const verdictSet = new Set(top.map((v) => v.verdict));
  if (verdictSet.size !== 1) {
    return { applied: false, verdict: null };
  }
  const [v] = verdictSet;
  return { applied: true, verdict: v };
}

function isInteger(n: unknown): n is number {
  return Number.isInteger(n);
}

function validateInput(raw: unknown): Input {
  if (!raw || typeof raw !== 'object') throw new ValidationError('input must be a JSON object');
  const obj = raw as Record<string, unknown>;
  if (obj.round_num !== 1 && obj.round_num !== 2) {
    throw new ValidationError('round_num must be 1 or 2');
  }
  if (!Array.isArray(obj.verdicts)) throw new ValidationError('verdicts must be an array');
  if (obj.verdicts.length === 0) throw new ValidationError('verdicts array is empty');
  for (const v of obj.verdicts) {
    if (!v || typeof v !== 'object') throw new ValidationError('each verdict must be an object');
    const ve = v as Record<string, unknown>;
    if (typeof ve.judge_id !== 'string') throw new ValidationError('verdict.judge_id must be a string');
    if (typeof ve.tier !== 'string') throw new ValidationError('verdict.tier must be a string');
    if (typeof ve.raw_output !== 'string') throw new ValidationError('verdict.raw_output must be a string');
  }
  if (!obj.config || typeof obj.config !== 'object') {
    throw new ValidationError('config must be an object');
  }
  const config = obj.config as Record<string, unknown>;
  if (!config.consensus || typeof config.consensus !== 'object') {
    throw new ValidationError('config.consensus must be an object');
  }
  const consensus = config.consensus as Record<string, unknown>;
  if (!isInteger(consensus.round_1_blind)) {
    throw new ValidationError('config.consensus.round_1_blind must be an integer');
  }
  if (!isInteger(consensus.round_2_debate)) {
    throw new ValidationError('config.consensus.round_2_debate must be an integer');
  }
  if (!config.tiebreak || typeof config.tiebreak !== 'object') {
    throw new ValidationError('config.tiebreak must be an object');
  }
  const tiebreak = config.tiebreak as Record<string, unknown>;
  if (typeof tiebreak.rule !== 'string') throw new ValidationError('config.tiebreak.rule must be a string');
  if (typeof tiebreak.top_tier !== 'string') throw new ValidationError('config.tiebreak.top_tier must be a string');
  return obj as Input;
}

export function mediatePanelVerb(
  _rest: string[],
  ctx: GriotCliContext,
): DispatchResult {
  const stdin = ctx.stdin ?? '';
  if (stdin.trim() === '') return fail('empty input on stdin');
  let raw: unknown;
  try {
    raw = JSON.parse(stdin);
  } catch (err) {
    return fail(`JSON parse error: ${(err as Error).message}`);
  }
  let input: Input;
  try {
    input = validateInput(raw);
  } catch (err) {
    if (err instanceof ValidationError) return fail(err.message);
    throw err;
  }
  const parsed = input.verdicts.map(parseSingleVerdict);
  const tally = tallyVerdicts(parsed);
  const { count: majorityCount, verdict: majorityVerdict } = pickMajority(tally);
  const threshold = thresholdFor(input.round_num, input.config);
  const thresholdMet = majorityCount >= threshold;
  const consensusVerdict: Verdict | null = thresholdMet ? majorityVerdict : null;
  const tierSplit = detectTierSplit(parsed, input.config.tiebreak.top_tier);
  let tiebreakApplied = false;
  let tiebreakVerdict: Verdict | null = null;
  if (input.round_num === 2 && !thresholdMet) {
    const result = applyTiebreak(parsed, input.config.tiebreak);
    tiebreakApplied = result.applied;
    tiebreakVerdict = result.verdict;
  }
  const output: Output = {
    round: input.round_num,
    verdicts: parsed,
    tally,
    consensus_verdict: consensusVerdict,
    threshold_met: thresholdMet,
    tier_split: tierSplit,
    tiebreak_applied: tiebreakApplied,
    tiebreak_verdict: tiebreakVerdict,
  };
  return { stdout: JSON.stringify(output, null, 2), exitCode: 0 };
}
