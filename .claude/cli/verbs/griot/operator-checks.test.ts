import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, beforeEach, afterEach } from 'vitest';
import { operatorChecksVerb } from './operator-checks.ts';
import type { GriotCliContext } from './index.ts';

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = mkdtempSync(join(tmpdir(), 'operator-checks-verb-test-'));
});

afterEach(() => {
  rmSync(TMPDIR, { recursive: true, force: true });
});

function ctx(stdin: string): GriotCliContext {
  return { cwd: TMPDIR, stdin };
}

// ---------- mode dispatch ----------

test('missing mode fails with valid-modes hint', () => {
  const res = operatorChecksVerb([], ctx('{}'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/missing mode/);
  expect(res.stderr).toMatch(/verify-rubric/);
  expect(res.stderr).toMatch(/log-intervention/);
});

test('unknown mode fails with valid-modes hint', () => {
  const res = operatorChecksVerb(['something-else'], ctx('{}'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/unknown mode "something-else"/);
  expect(res.stderr).toMatch(/verify-rubric/);
});

test('empty stdin in verify-rubric fails informatively', () => {
  const res = operatorChecksVerb(['verify-rubric'], ctx(''));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/empty input on stdin/);
});

test('empty stdin in log-intervention fails informatively', () => {
  const res = operatorChecksVerb(['log-intervention'], ctx(''));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/empty input on stdin/);
});

test('non-JSON stdin fails with parse error', () => {
  const res = operatorChecksVerb(['verify-rubric'], ctx('{not json'));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/JSON parse error/);
});

// ---------- verify-rubric ----------

test('verify-rubric: exact match returns ok:true', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const content = '# Rubric\n\n- assertion 1\n- assertion 2\n';
  writeFileSync(rubricPath, content);
  const input = JSON.stringify({ rubric_path: rubricPath, expected: content });
  const res = operatorChecksVerb(['verify-rubric'], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.ok).toBe(true);
  expect(out.actual).toBeUndefined();
});

test('verify-rubric: content differs returns ok:false with actual', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const onDisk = '# Rubric\n\n- tampered assertion\n';
  const expected = '# Rubric\n\n- original assertion\n';
  writeFileSync(rubricPath, onDisk);
  const input = JSON.stringify({ rubric_path: rubricPath, expected });
  const res = operatorChecksVerb(['verify-rubric'], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.ok).toBe(false);
  expect(out.actual).toBe(onDisk);
});

test('verify-rubric: does not write the file when content differs', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const onDisk = 'on-disk content';
  writeFileSync(rubricPath, onDisk);
  const input = JSON.stringify({ rubric_path: rubricPath, expected: 'something else' });
  operatorChecksVerb(['verify-rubric'], ctx(input));
  const after = readFileSync(rubricPath, 'utf8');
  expect(after).toBe(onDisk);
});

test('verify-rubric: missing rubric file fails informatively', () => {
  const rubricPath = join(TMPDIR, 'does-not-exist.md');
  const input = JSON.stringify({ rubric_path: rubricPath, expected: 'whatever' });
  const res = operatorChecksVerb(['verify-rubric'], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/rubric file does not exist/);
  expect(res.stderr).toMatch(/does-not-exist\.md/);
});

test('verify-rubric: missing rubric_path field fails', () => {
  const input = JSON.stringify({ expected: 'whatever' });
  const res = operatorChecksVerb(['verify-rubric'], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/rubric_path/);
});

test('verify-rubric: missing expected field fails', () => {
  const input = JSON.stringify({ rubric_path: '/tmp/whatever' });
  const res = operatorChecksVerb(['verify-rubric'], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/expected/);
});

// ---------- log-intervention ----------

test('log-intervention: appends to existing file', () => {
  const logPath = join(TMPDIR, 'operator-log.jsonl');
  writeFileSync(logPath, '{"existing":true}\n');
  const record = { ts: '2026-05-08T19:00:00Z', category: 'rubric_tampered' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(0);
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  expect(lines.length).toBe(2);
  expect(lines[0]).toBe('{"existing":true}');
  expect(JSON.parse(lines[1])).toEqual(record);
});

test('log-intervention: creates file when not exists', () => {
  const logPath = join(TMPDIR, 'fresh-log.jsonl');
  expect(existsSync(logPath)).toBe(false);
  const record = { category: 'first_entry' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(0);
  expect(existsSync(logPath)).toBe(true);
  const content = readFileSync(logPath, 'utf8');
  expect(content).toBe(`${JSON.stringify(record)}\n`);
});

test('log-intervention: creates parent directory when not exists', () => {
  const logPath = join(TMPDIR, 'nested', 'deep', 'log.jsonl');
  const record = { category: 'in_nested_dir' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(0);
  expect(existsSync(logPath)).toBe(true);
});

test('log-intervention: multiple calls append in order', () => {
  const logPath = join(TMPDIR, 'multi.jsonl');
  for (let i = 0; i < 3; i++) {
    const input = JSON.stringify({ log_path: logPath, record: { i } });
    const res = operatorChecksVerb(['log-intervention'], ctx(input));
    expect(res.exitCode).toBe(0);
  }
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  expect(lines.length).toBe(3);
  expect(JSON.parse(lines[0]).i).toBe(0);
  expect(JSON.parse(lines[1]).i).toBe(1);
  expect(JSON.parse(lines[2]).i).toBe(2);
});

test('log-intervention: accepts arbitrary JSON values as record', () => {
  const logPath = join(TMPDIR, 'mixed.jsonl');
  const records: unknown[] = [
    { ts: 'a', value: 1 },
    ['array', 'record'],
    'string-record',
    42,
    null,
  ];
  for (const record of records) {
    const input = JSON.stringify({ log_path: logPath, record });
    const res = operatorChecksVerb(['log-intervention'], ctx(input));
    expect(res.exitCode).toBe(0);
  }
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  expect(lines.length).toBe(records.length);
  for (let i = 0; i < records.length; i++) {
    expect(JSON.parse(lines[i])).toEqual(records[i]);
  }
});

test('log-intervention: returns ok:true with appended_to in stdout', () => {
  const logPath = join(TMPDIR, 'ack.jsonl');
  const input = JSON.stringify({ log_path: logPath, record: { ok: 'check' } });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(0);
  const out = JSON.parse(res.stdout as string);
  expect(out.ok).toBe(true);
  expect(out.appended_to).toBe(logPath);
});

test('log-intervention: missing log_path field fails', () => {
  const input = JSON.stringify({ record: {} });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/log_path/);
});

test('log-intervention: missing record field fails', () => {
  const input = JSON.stringify({ log_path: '/tmp/whatever' });
  const res = operatorChecksVerb(['log-intervention'], ctx(input));
  expect(res.exitCode).toBe(1);
  expect(res.stderr).toMatch(/record/);
});
