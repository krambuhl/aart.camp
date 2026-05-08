import { test } from 'vitest';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/guild/parse-and-aggregate.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(input: string): RunResult {
  const res = spawnSync('node', [SCRIPT], { input, encoding: 'utf-8' });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

function approvedOutput(): string {
  return `Some pre-amble that the evaluator might emit.

VERDICT: approved

Summary: everything checked out.
`;
}

function flaggedOutput(reasons: string[], remedies: string[] = []): string {
  const reasonLines = reasons.map((r) => `- ${r}`).join('\n');
  const remedyLines = remedies.length > 0
    ? `\nSuggested remedies:\n${remedies.map((r) => `- ${r}`).join('\n')}\n`
    : '';
  return `VERDICT: flagged

Reasons:
${reasonLines}
${remedyLines}`;
}

test('empty stdin fails informatively', () => {
  const res = run('');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /empty input on stdin/);
});

test('non-JSON input fails with parse error', () => {
  const res = run('{not json');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /JSON parse error/);
});

test('non-array input fails with shape error', () => {
  const res = run('{"agent": "x", "output": "y"}');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /must be a JSON array/);
});

test('entry missing agent field fails', () => {
  const res = run('[{"output": "x"}]');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /entry \[0\] must have a string `agent` field/);
});

test('entry missing output field fails', () => {
  const res = run('[{"agent": "x"}]');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /entry \[0\] must have a string `output` field/);
});

test('single approved evaluator → verdict approved, all empty', () => {
  const input = JSON.stringify([{ agent: 'evaluator-contract-fit', output: approvedOutput() }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'approved');
  assert.deepEqual(result.blocking_findings, []);
  assert.deepEqual(result.advisory_findings, []);
  assert.deepEqual(result.cli_runs, []);
  assert.deepEqual(result.conflicts, []);
});

test('single flagged evaluator with one reason → blocking finding emitted', () => {
  const output = flaggedOutput(['criterion-unmet: the test for X failed because Y']);
  const input = JSON.stringify([{ agent: 'evaluator-contract-fit', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'flagged');
  assert.equal(result.blocking_findings.length, 1);
  assert.equal(result.blocking_findings[0].evaluator, 'evaluator-contract-fit');
  assert.equal(result.blocking_findings[0].code, 'criterion-unmet');
  assert.match(result.blocking_findings[0].evidence, /the test for X failed because Y/);
  assert.equal(result.advisory_findings.length, 0);
});

test('reason with explicit BLOCKING: prefix routes to blocking', () => {
  const output = flaggedOutput(['BLOCKING: rules-violation: lint failed on src/foo.ts']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'flagged');
  assert.equal(result.blocking_findings.length, 1);
  assert.equal(result.blocking_findings[0].code, 'rules-violation');
});

test('reason with explicit ADVISORY: prefix routes to advisory (verdict approved if no blocking)', () => {
  const output = flaggedOutput(['ADVISORY: scope-creep: unrelated whitespace change']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'approved');
  assert.equal(result.advisory_findings.length, 1);
  assert.equal(result.advisory_findings[0].code, 'scope-creep');
  assert.equal(result.blocking_findings.length, 0);
});

test('reason without code prefix defaults to criterion-unmet', () => {
  const output = flaggedOutput(['the artifact does not satisfy the contract because of reasons']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.blocking_findings[0].code, 'criterion-unmet');
  assert.match(result.blocking_findings[0].evidence, /the artifact does not satisfy/);
});

test('reason with backtick-wrapped code and parenthetical context extracted correctly', () => {
  const output = flaggedOutput(['`disqualifier-fired` ("Hardcoded CONVENTIONS data without runtime read attempt"): autoload.ts never reads CONVENTIONS.md']);
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.blocking_findings[0].code, 'disqualifier-fired');
  assert.match(result.blocking_findings[0].evidence, /autoload\.ts never reads CONVENTIONS\.md/);
});

test('missing VERDICT line → parse-failure blocking finding', () => {
  const input = JSON.stringify([{ agent: 'evaluator-x', output: 'this output has no verdict line at all' }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'flagged');
  assert.equal(result.blocking_findings.length, 1);
  assert.equal(result.blocking_findings[0].code, 'parse-failure');
});

test('multiple evaluators mixed (one approved, one flagged) → aggregated correctly', () => {
  const input = JSON.stringify([
    { agent: 'evaluator-a', output: approvedOutput() },
    { agent: 'evaluator-b', output: flaggedOutput(['criterion-unmet: a thing'], ['fix the thing']) },
  ]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.verdict, 'flagged');
  assert.equal(result.blocking_findings.length, 1);
  assert.equal(result.blocking_findings[0].evaluator, 'evaluator-b');
  assert.equal(result.blocking_findings[0].remedy, 'fix the thing');
});

test('suggested remedies pair with reasons by index', () => {
  const output = flaggedOutput(
    ['criterion-unmet: first reason', 'criterion-unmet: second reason'],
    ['remedy for first', 'remedy for second'],
  );
  const input = JSON.stringify([{ agent: 'evaluator-x', output }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.equal(result.blocking_findings.length, 2);
  assert.equal(result.blocking_findings[0].remedy, 'remedy for first');
  assert.equal(result.blocking_findings[1].remedy, 'remedy for second');
});

test('output shape locked: all five fields present even when result is approved', () => {
  const input = JSON.stringify([{ agent: 'x', output: approvedOutput() }]);
  const res = run(input);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  const result = JSON.parse(res.stdout);
  assert.ok('verdict' in result);
  assert.ok('blocking_findings' in result);
  assert.ok('advisory_findings' in result);
  assert.ok('cli_runs' in result);
  assert.ok('conflicts' in result);
});
