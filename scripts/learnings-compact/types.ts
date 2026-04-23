// Types for the /learnings-compact orchestrator.
// Kept in one file because the pipeline is small and the types are shared.

export type Verdict = 'IMPROVED' | 'UNCHANGED' | 'REGRESSED' | 'DID_NOT_REPRODUCE';

export type Tier = 'top-current' | 'top-previous' | 'mid-current' | 'mid-previous' | 'fast-current' | 'fast-previous';

export interface JudgeDef {
  id: string;
  model: string;
  tier: Tier;
  weight: number;
}

export interface AgentDef {
  model: string;
  max_tokens: number;
}

export interface Config {
  judges: JudgeDef[];
  agents: {
    rubric_author: AgentDef;
    rewriter: AgentDef;
    mediator: AgentDef;
    operator: AgentDef;
  };
  test_subject: AgentDef;
  consensus: {
    round_1_blind: number;
    round_2_debate: number;
    round_3_final: number;
  };
  rewrite: {
    max_attempts: number;
  };
  alerts: {
    did_not_reproduce_rate_max: number;
    operator_interventions_per_run_max: number;
  };
  execution: {
    judge_parallelism: number;
    judge_timeout_ms: number;
    agent_timeout_ms: number;
  };
  paths: {
    root: string;
    session_notes: string;
    archived: string;
    nightly: string;
    runs: string;
    rollup: string;
    citations: string;
    regressions: string;
    bench_history: string;
    sessions: string;
    operator_log: string;
    judge_calibration: string;
    pr_templates: string;
  };
}

export interface TokenUsage {
  input: number;
  output: number;
  cache_read: number;
  cache_creation: number;
}

export const emptyUsage = (): TokenUsage => ({
  input: 0,
  output: 0,
  cache_read: 0,
  cache_creation: 0,
});

export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cache_read: a.cache_read + b.cache_read,
  cache_creation: a.cache_creation + b.cache_creation,
});

export interface SessionNote {
  dir: string; // absolute path to the session-note folder
  slug: string; // folder basename
  prompt: string;
  wrong: string;
  correction: string;
  learning: string; // current working draft
  rubric: string | null; // null until rubric-author writes it
}

export interface Rubric {
  assertions: string[]; // each a binary statement "output does X" / "output does not do X"
  raw: string; // original markdown as written
}

export interface RubricEval {
  assertion: string;
  passes: boolean;
  reasoning?: string;
}

export interface JudgeVerdict {
  judge_id: string;
  verdict: Verdict;
  control_pass_count: number;
  treatment_pass_count: number;
  control_evals: RubricEval[];
  treatment_evals: RubricEval[];
  reasoning: string;
  errored: boolean;
  error_message?: string;
  tokens: TokenUsage;
}

export interface PanelRound {
  round: 1 | 2 | 3;
  verdicts: JudgeVerdict[];
  consensus_verdict: Verdict | null; // null if threshold not met
  threshold_met: boolean;
}

export interface PanelResult {
  rounds: PanelRound[];
  final_verdict: Verdict | 'NO_CONSENSUS';
  contested: boolean;
  tier_split: boolean; // all top-tier disagree with all others
  output_control: string;
  output_treatment: string;
  tokens: TokenUsage;
  by_judge: Record<string, TokenUsage>;
  timestamp: string;
}

export interface OperatorIntervention {
  timestamp: string;
  violation_type: string;
  step_taken: 'reprompt' | 'constrain_toolset' | 'rollback_change_strategy' | 'open_human_review_pr';
  outcome: string;
  tokens_used: number;
}

export interface CompactionResult {
  date: string;
  notes_processed: string[]; // slugs
  promoted: { id: string; slug: string }[];
  rewritten_and_promoted: { id: string; slug: string; attempts: number }[];
  escalated: { slug: string; reason: string }[];
  did_not_reproduce: string[]; // slugs
  regressions: { id: string; reason: string }[];
  verdict_counts: Record<Verdict, number>;
  contested_count: number;
  tokens: {
    total: TokenUsage;
    by_role: Record<string, TokenUsage>;
    by_judge: Record<string, TokenUsage>;
  };
  operator_interventions: OperatorIntervention[];
}

// Role labels for token accounting.
export type Role = 'rubric_author' | 'rewriter' | 'mediator_overhead' | 'operator' | 'regression_suite' | 'test_subject' | 'judge';
