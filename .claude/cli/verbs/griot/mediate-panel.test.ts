import { test, expect } from 'vitest';
import { mediatePanelVerb } from './mediate-panel.ts';
import type { GriotCliContext } from './index.ts';

function ctx(stdin: string): GriotCliContext {
  return { cwd: '/tmp', stdin };
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
  const res = mediatePanelVerb([], ctx(''));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/empty input on stdin/);
});

test('non-JSON stdin fails with parse error', () => {
  const res = mediatePanelVerb([], ctx('{not json'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/JSON parse error/);
});

test('missing top-level keys fails', () => {
  const res = mediatePanelVerb([], ctx('{}'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/round_num/);
});

test('empty verdicts array fails', () => {
  const input = JSON.stringify({ round_num: 1, verdicts: [], config: CONFIG });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/verdicts array is empty/);
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
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/round_1_blind/);
});

test('round 1 unanimous IMPROVED → consensus IMPROVED, threshold met', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'IMPROVED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.round).toBe(1);
  expect(out.consensus_verdict).toBe('IMPROVED');
  expect(out.threshold_met).toBe(true);
  expect(out.tally.IMPROVED).toBe(4);
  expect(out.tier_split).toBe(false);
  expect(out.tiebreak_applied).toBe(false);
  expect(out.tiebreak_verdict).toBe(null);
});

test('round 1 not unanimous (3/4) → no consensus, no tiebreak attempted', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.consensus_verdict).toBe(null);
  expect(out.threshold_met).toBe(false);
  expect(out.tally.IMPROVED).toBe(3);
  expect(out.tally.REGRESSED).toBe(1);
  expect(out.tiebreak_applied).toBe(false);
});

test('round 2 supermajority (3/4) → consensus, no tiebreak', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.consensus_verdict).toBe('IMPROVED');
  expect(out.threshold_met).toBe(true);
  expect(out.tiebreak_applied).toBe(false);
});

test('round 2 split 2-2 with both Opus agreeing → tiebreak fires', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.consensus_verdict).toBe(null);
  expect(out.threshold_met).toBe(false);
  expect(out.tiebreak_applied).toBe(true);
  expect(out.tiebreak_verdict).toBe('IMPROVED');
});

test('round 2 split 2-2 with Opus disagreeing → tiebreak does not fire', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'REGRESSED', 'IMPROVED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.tiebreak_applied).toBe(false);
  expect(out.tiebreak_verdict).toBe(null);
});

test('tier split detected when both Opus agree on opposite of non-Opus', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  const out = JSON.parse(res.stdout as string);
  expect(out.tier_split).toBe(true);
});

test('tier split is false when non-top tier disagrees among themselves', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'UNCHANGED']),
    config: CONFIG,
  });
  const res = mediatePanelVerb([], ctx(input));
  const out = JSON.parse(res.stdout as string);
  expect(out.tier_split).toBe(false);
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
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.verdicts[0].errored).toBe(true);
  expect(out.verdicts[0].error_message).toMatch(/not found/);
  expect(out.tally.IMPROVED).toBe(3);
  expect(out.threshold_met).toBe(false);
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
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.verdicts[0].errored).toBe(true);
  expect(out.verdicts[0].error_message).toMatch(/parse error/);
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
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.verdicts[0].errored).toBe(true);
  expect(out.verdicts[0].error_message).toMatch(/unknown or missing verdict/);
  expect(out.tally.IMPROVED).toBe(3);
});

test('unknown tiebreak rule → no-op (no error)', () => {
  const input = JSON.stringify({
    round_num: 2,
    verdicts: fourJudgePanel(['IMPROVED', 'IMPROVED', 'REGRESSED', 'REGRESSED']),
    config: { ...CONFIG, tiebreak: { rule: 'mystery_rule', top_tier: 'opus' } },
  });
  const res = mediatePanelVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.tiebreak_applied).toBe(false);
  expect(out.tiebreak_verdict).toBe(null);
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
  const res = mediatePanelVerb([], ctx(input));
  const out = JSON.parse(res.stdout as string);
  expect(out.verdicts[0].control_evals.length).toBe(1);
  expect(out.verdicts[0].treatment_evals.length).toBe(1);
  expect(out.verdicts[0].reasoning).toBe('treatment fixes the failure');
});
