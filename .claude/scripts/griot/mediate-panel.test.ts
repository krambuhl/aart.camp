import { test } from 'vitest';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/griot/mediate-panel.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(input: string): RunResult {
  const res = spawnSync('node', [SCRIPT], { input, encoding: 'utf-8' });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

const CONFIG = {
  consensus: { round_1_blind: 4, round_2_debate: 3 },
  tiebreak: { rule: 'top_tier_consensus', top_tier: 'opus' },
};

function makeRawOutput(
  verdict: string,
  opts: {
    control?: { assertion: string; passes: boolean }[];
    treatment?: { assertion: string; passes: boolean }[];
    reasoning?: string;
  } = {},
): string {
  const body = {
    verdict,
    control_evals: opts.control ?? [],
    treatment_evals: opts.treatment ?? [],
    reasoning: opts.reasoning ?? 'test reasoning',
  };
  return `Some pre-amble.\n\n\`\`\`verdict\n${JSON.stringify(body)}\n\`\`\`\n`;
}

type RawVerdict = { judge_id: string; tier: string; raw_output: string };

function fourJudgePanel(verdicts: [string, string, string, string]): RawVerdict[] {
  return [
    { judge_id: 'opus-A', tier: 'opus', raw_output: makeRawOutput(verdicts[0]) },
    { judge_id: 'opus-B', tier: 'opus', raw_output: makeRawOutput(verdicts[1]) },
    { judge_id: 'sonnet', tier: 'sonnet', raw_output: makeRawOutput(verdicts[2]) },
    { judge_id: 'haiku', tier: 'haiku', raw_output: makeRawOutput(verdicts[3]) },
  ];
}

test('empty stdin fails informatively', () => {
  const res = run('');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /empty input on stdin/);
});

test('non-JSON stdin fails with parse error', () => {
  const res = run('{not json');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /JSON parse error/);
});

test('missing top-level keys fails', () => {
  const res = run('{}');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /round_num/);
});

test('empty verdicts array fails', () => {
  const input = JSON.stringify({ round_num: 1, verdicts: [], config: CONFIG });
  const res = run(input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /verdicts array is empty/);
});

test('non-integer threshold fails', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'IMPROVED']),
    config: {
      consensus: { round_1_blind: 'four', round_2_debate: 3 },
      tiebreak: CONFIG.tiebreak,
    },
  });
  const res = run(input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /round_1_blind/);
});

test('round 1 unanimous IMPROVED → consensus IMPROVED, threshold met', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'IMPROVED']),
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.round, 1);
  assert.equal(out.consensus_verdict, 'IMPROVED');
  assert.equal(out.threshold_met, true);
  assert.equal(out.tally.IMPROVED, 4);
  assert.equal(out.tier_split, false);
  assert.equal(out.tiebreak_applied, false);
  assert.equal(out.tiebreak_verdict, null);
});

test('round 1 not unanimous (3/4) → no consensus, no tiebreak attempted', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.consensus_verdict, null);
  assert.equal(out.threshold_met, false);
  assert.equal(out.tally.IMPROVED, 3);
  assert.equal(out.tally.REGRESSED, 1);
  assert.equal(out.tiebreak_applied, false);
});

test('round 2 supermajority (3/4) → consensus, no tiebreak', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.consensus_verdict, 'IMPROVED');
  assert.equal(out.threshold_met, true);
  assert.equal(out.tiebreak_applied, false);
});

test('round 2 split 2-2 with both Opus agreeing → tiebreak fires', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.consensus_verdict, null);
  assert.equal(out.threshold_met, false);
  assert.equal(out.tiebreak_applied, true);
  assert.equal(out.tiebreak_verdict, 'IMPROVED');
});

test('round 2 split 2-2 with Opus disagreeing → tiebreak does not fire', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'REGRESSED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tiebreak_applied, false);
  assert.equal(out.tiebreak_verdict, null);
});

test('tier split detected when both Opus agree on opposite of non-Opus', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = run(input);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tier_split, true);
});

test('tier split is false when non-top tier disagrees among themselves', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'UNCHANGED']),
    config: CONFIG,
  });
  const res = run(input);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tier_split, false);
});

test('errored verdict (no verdict block) is excluded from tally', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: [
      { judge_id: 'opus-A', tier: 'opus', raw_output: 'no verdict block here' },
      { judge_id: 'opus-B', tier: 'opus', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'sonnet', tier: 'sonnet', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'haiku', tier: 'haiku', raw_output: makeRawOutput('IMPROVED') },
    ],
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.verdicts[0].errored, true);
  assert.match(out.verdicts[0].error_message, /not found/);
  assert.equal(out.tally.IMPROVED, 3);
  // 4-judge panel with 1 errored cannot reach 4/4 unanimity in round 1
  assert.equal(out.threshold_met, false);
});

test('errored verdict (malformed JSON) reports JSON parse error', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: [
      {
        judge_id: 'opus-A',
        tier: 'opus',
        raw_output: '```verdict\n{not json\n```',
      },
      { judge_id: 'opus-B', tier: 'opus', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'sonnet', tier: 'sonnet', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'haiku', tier: 'haiku', raw_output: makeRawOutput('IMPROVED') },
    ],
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.verdicts[0].errored, true);
  assert.match(out.verdicts[0].error_message, /parse error/);
});

test('errored verdict (unknown verdict value) is excluded', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: [
      {
        judge_id: 'opus-A',
        tier: 'opus',
        raw_output: makeRawOutput('MAYBE_IMPROVED'),
      },
      { judge_id: 'opus-B', tier: 'opus', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'sonnet', tier: 'sonnet', raw_output: makeRawOutput('IMPROVED') },
      { judge_id: 'haiku', tier: 'haiku', raw_output: makeRawOutput('IMPROVED') },
    ],
    config: CONFIG,
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.verdicts[0].errored, true);
  assert.match(out.verdicts[0].error_message, /unknown or missing verdict/);
  assert.equal(out.tally.IMPROVED, 3);
});

test('unknown tiebreak rule → no-op (no error)', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: { ...CONFIG, tiebreak: { rule: 'mystery_rule', top_tier: 'opus' } },
  });
  const res = run(input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tiebreak_applied, false);
  assert.equal(out.tiebreak_verdict, null);
});

test('parsed verdict preserves control/treatment evals and reasoning', () => {
  const rawOutput = makeRawOutput('IMPROVED', {
    control: [{ assertion: 'A', passes: false }],
    treatment: [{ assertion: 'A', passes: true }],
    reasoning: 'treatment fixes the failure',
  });
  const input = JSON.stringify({
    round_num: 1,
    verdicts: [
      { judge_id: 'opus-A', tier: 'opus', raw_output: rawOutput },
      { judge_id: 'opus-B', tier: 'opus', raw_output: rawOutput },
      { judge_id: 'sonnet', tier: 'sonnet', raw_output: rawOutput },
      { judge_id: 'haiku', tier: 'haiku', raw_output: rawOutput },
    ],
    config: CONFIG,
  });
  const res = run(input);
  const out = JSON.parse(res.stdout);
  assert.equal(out.verdicts[0].control_evals.length, 1);
  assert.equal(out.verdicts[0].treatment_evals.length, 1);
  assert.equal(out.verdicts[0].reasoning, 'treatment fixes the failure');
});
