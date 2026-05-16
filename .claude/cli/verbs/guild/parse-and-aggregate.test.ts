import { test, expect } from 'vitest';
import { parseAndAggregateVerb } from './parse-and-aggregate.ts';
import type { GuildCliContext } from './index.ts';

function ctx(stdin: string): GuildCliContext {
  return { cwd: '/tmp', stdin };
}

function approvedOutput(): string {
  return `Some pre-amble that the evaluator might emit.

VERDICT: approved

Summary: everything checked out.
`;
}

function flaggedOutput(reasons: string[], remedies: string[] = []): string {
  const reasonLines = reasons.map((r) => `- ${r}`).join('\n');
  const remedyLines =
    remedies.length > 0
      ? `\nSuggested remedies:\n${remedies.map((r) => `- ${r}`).join('\n')}\n`
      : '';
  return `VERDICT: flagged

Reasons:
${reasonLines}
${remedyLines}`;
}

test('empty stdin fails informatively', () => {
  const res = parseAndAggregateVerb([], ctx(''));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/empty input on stdin/);
});

test('non-JSON input fails with parse error', () => {
  const res = parseAndAggregateVerb([], ctx('{not json'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/JSON parse error/);
});

test('non-array input fails with shape error', () => {
  const res = parseAndAggregateVerb([], ctx('{"agent": "x", "output": "y"}'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/must be a JSON array/);
});

test('entry missing agent field fails', () => {
  const res = parseAndAggregateVerb([], ctx('[{"output": "x"}]'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/entry \[0\] must have a string `agent` field/);
});

test('entry missing output field fails', () => {
  const res = parseAndAggregateVerb([], ctx('[{"agent": "x"}]'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/entry \[0\] must have a string `output` field/);
});

test('single approved evaluator → verdict approved, all empty', () => {
  const input = JSON.stringify([
    { agent: 'evaluator-contract-fit', output: approvedOutput() },
  ]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('approved');
  expect(result.blocking_findings).toEqual([]);
  expect(result.advisory_findings).toEqual([]);
  expect(result.cli_runs).toEqual([]);
  expect(result.conflicts).toEqual([]);
});

test('single flagged evaluator with one reason → blocking finding emitted', () => {
  const output = flaggedOutput(['criterion-unmet: the test for X failed because Y']);
  const input = JSON.stringify([{ agent: 'evaluator-contract-fit', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('flagged');
  expect(result.blocking_findings.length).toBe(1);
  expect(result.blocking_findings[0].evaluator).toBe('evaluator-contract-fit');
  expect(result.blocking_findings[0].code).toBe('criterion-unmet');
  expect(result.blocking_findings[0].evidence).toMatch(/the test for X failed because Y/);
  expect(result.advisory_findings.length).toBe(0);
});

test('reason with explicit BLOCKING: prefix routes to blocking', () => {
  const output = flaggedOutput(['BLOCKING: rules-violation: lint failed on src/foo.ts']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('flagged');
  expect(result.blocking_findings.length).toBe(1);
  expect(result.blocking_findings[0].code).toBe('rules-violation');
});

test('reason with explicit ADVISORY: prefix routes to advisory (verdict approved if no blocking)', () => {
  const output = flaggedOutput(['ADVISORY: scope-creep: unrelated whitespace change']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('approved');
  expect(result.advisory_findings.length).toBe(1);
  expect(result.advisory_findings[0].code).toBe('scope-creep');
  expect(result.blocking_findings.length).toBe(0);
});

test('reason without code prefix defaults to criterion-unmet', () => {
  const output = flaggedOutput(['the artifact does not satisfy the contract because of reasons']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.blocking_findings[0].code).toBe('criterion-unmet');
  expect(result.blocking_findings[0].evidence).toMatch(/the artifact does not satisfy/);
});

test('reason with backtick-wrapped code and parenthetical context extracted correctly', () => {
  const output = flaggedOutput([
    '`disqualifier-fired` ("Hardcoded CONVENTIONS data without runtime read attempt"): autoload.ts never reads CONVENTIONS.md',
  ]);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.blocking_findings[0].code).toBe('disqualifier-fired');
  expect(result.blocking_findings[0].evidence).toMatch(/autoload\.ts never reads CONVENTIONS\.md/);
});

test('missing VERDICT line → parse-failure blocking finding', () => {
  const input = JSON.stringify([
    { agent: 'evaluator-x', output: 'this output has no verdict line at all' },
  ]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('flagged');
  expect(result.blocking_findings.length).toBe(1);
  expect(result.blocking_findings[0].code).toBe('parse-failure');
});

test('multiple evaluators mixed (one approved, one flagged) → aggregated correctly', () => {
  const input = JSON.stringify([
    { agent: 'evaluator-a', output: approvedOutput() },
    {
      agent: 'evaluator-b',
      output: flaggedOutput(['criterion-unmet: a thing'], ['fix the thing']),
    },
  ]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.verdict).toBe('flagged');
  expect(result.blocking_findings.length).toBe(1);
  expect(result.blocking_findings[0].evaluator).toBe('evaluator-b');
  expect(result.blocking_findings[0].remedy).toBe('fix the thing');
});

test('suggested remedies pair with reasons by index', () => {
  const output = flaggedOutput(
    ['criterion-unmet: first reason', 'criterion-unmet: second reason'],
    ['remedy for first', 'remedy for second'],
  );
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result.blocking_findings.length).toBe(2);
  expect(result.blocking_findings[0].remedy).toBe('remedy for first');
  expect(result.blocking_findings[1].remedy).toBe('remedy for second');
});

test('output shape locked: all five fields present even when result is approved', () => {
  const input = JSON.stringify([{ agent: 'x', output: approvedOutput() }]);
  const res = parseAndAggregateVerb([], ctx(input));
  expect(res.exitCode).toBe(0);
  const result = JSON.parse(res.stdout as string);
  expect(result).toHaveProperty('verdict');
  expect(result).toHaveProperty('blocking_findings');
  expect(result).toHaveProperty('advisory_findings');
  expect(result).toHaveProperty('cli_runs');
  expect(result).toHaveProperty('conflicts');
});
