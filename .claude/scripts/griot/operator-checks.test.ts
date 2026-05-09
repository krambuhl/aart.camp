import { test, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

const SCRIPT = join(process.cwd(), '.claude/scripts/griot/operator-checks.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(mode: string | undefined, input: string): RunResult {
  const args = mode === undefined ? [SCRIPT] : [SCRIPT, mode];
  const res = spawnSync('node', args, { input, encoding: 'utf-8' });
  return {
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = mkdtempSync(join(tmpdir(), 'operator-checks-test-'));
});

afterEach(() => {
  rmSync(TMPDIR, { recursive: true, force: true });
});

// ─── mode dispatch ─────────────────────────────────────────────────────────

test('missing mode fails with valid-modes hint', () => {
  const res = run(undefined, '{}');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /missing mode/);
  assert.match(res.stderr, /verify-rubric/);
  assert.match(res.stderr, /log-intervention/);
});

test('unknown mode fails with valid-modes hint', () => {
  const res = run('something-else', '{}');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown mode "something-else"/);
  assert.match(res.stderr, /verify-rubric/);
});

test('empty stdin in verify-rubric fails informatively', () => {
  const res = run('verify-rubric', '');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /empty input on stdin/);
});

test('empty stdin in log-intervention fails informatively', () => {
  const res = run('log-intervention', '');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /empty input on stdin/);
});

test('non-JSON stdin fails with parse error', () => {
  const res = run('verify-rubric', '{not json');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /JSON parse error/);
});

// ─── verify-rubric ─────────────────────────────────────────────────────────

test('verify-rubric: exact match returns ok:true', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const content = '# Rubric\n\n- assertion 1\n- assertion 2\n';
  writeFileSync(rubricPath, content);
  const input = JSON.stringify({ rubric_path: rubricPath, expected: content });
  const res = run('verify-rubric', input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.actual, undefined);
});

test('verify-rubric: content differs returns ok:false with actual', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const onDisk = '# Rubric\n\n- tampered assertion\n';
  const expected = '# Rubric\n\n- original assertion\n';
  writeFileSync(rubricPath, onDisk);
  const input = JSON.stringify({ rubric_path: rubricPath, expected });
  const res = run('verify-rubric', input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, false);
  assert.equal(out.actual, onDisk);
});

test('verify-rubric: does not write the file when content differs', () => {
  const rubricPath = join(TMPDIR, 'rubric.md');
  const onDisk = 'on-disk content';
  writeFileSync(rubricPath, onDisk);
  const input = JSON.stringify({ rubric_path: rubricPath, expected: 'something else' });
  run('verify-rubric', input);
  const after = readFileSync(rubricPath, 'utf8');
  assert.equal(after, onDisk);
});

test('verify-rubric: missing rubric file fails informatively', () => {
  const rubricPath = join(TMPDIR, 'does-not-exist.md');
  const input = JSON.stringify({ rubric_path: rubricPath, expected: 'whatever' });
  const res = run('verify-rubric', input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /rubric file does not exist/);
  assert.match(res.stderr, /does-not-exist\.md/);
});

test('verify-rubric: missing rubric_path field fails', () => {
  const input = JSON.stringify({ expected: 'whatever' });
  const res = run('verify-rubric', input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /rubric_path/);
});

test('verify-rubric: missing expected field fails', () => {
  const input = JSON.stringify({ rubric_path: '/tmp/whatever' });
  const res = run('verify-rubric', input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /expected/);
});

// ─── log-intervention ──────────────────────────────────────────────────────

test('log-intervention: appends to existing file', () => {
  const logPath = join(TMPDIR, 'operator-log.jsonl');
  writeFileSync(logPath, '{"existing":true}\n');
  const record = { ts: '2026-05-08T19:00:00Z', category: 'rubric_tampered' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = run('log-intervention', input);
  assert.equal(res.status, 0);
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '{"existing":true}');
  assert.deepEqual(JSON.parse(lines[1]), record);
});

test('log-intervention: creates file when not exists', () => {
  const logPath = join(TMPDIR, 'fresh-log.jsonl');
  assert.equal(existsSync(logPath), false);
  const record = { category: 'first_entry' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = run('log-intervention', input);
  assert.equal(res.status, 0);
  assert.equal(existsSync(logPath), true);
  const content = readFileSync(logPath, 'utf8');
  assert.equal(content, `${JSON.stringify(record)}\n`);
});

test('log-intervention: creates parent directory when not exists', () => {
  const logPath = join(TMPDIR, 'nested', 'deep', 'log.jsonl');
  const record = { category: 'in_nested_dir' };
  const input = JSON.stringify({ log_path: logPath, record });
  const res = run('log-intervention', input);
  assert.equal(res.status, 0);
  assert.equal(existsSync(logPath), true);
});

test('log-intervention: multiple calls append in order', () => {
  const logPath = join(TMPDIR, 'multi.jsonl');
  for (let i = 0; i < 3; i++) {
    const input = JSON.stringify({ log_path: logPath, record: { i } });
    const res = run('log-intervention', input);
    assert.equal(res.status, 0);
  }
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[0]).i, 0);
  assert.equal(JSON.parse(lines[1]).i, 1);
  assert.equal(JSON.parse(lines[2]).i, 2);
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
    const res = run('log-intervention', input);
    assert.equal(res.status, 0);
  }
  const lines = readFileSync(logPath, 'utf8').split('\n').filter((l) => l !== '');
  assert.equal(lines.length, records.length);
  for (let i = 0; i < records.length; i++) {
    assert.deepEqual(JSON.parse(lines[i]), records[i]);
  }
});

test('log-intervention: returns ok:true with appended_to in stdout', () => {
  const logPath = join(TMPDIR, 'ack.jsonl');
  const input = JSON.stringify({ log_path: logPath, record: { ok: 'check' } });
  const res = run('log-intervention', input);
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.appended_to, logPath);
});

test('log-intervention: missing log_path field fails', () => {
  const input = JSON.stringify({ record: {} });
  const res = run('log-intervention', input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /log_path/);
});

test('log-intervention: missing record field fails', () => {
  const input = JSON.stringify({ log_path: '/tmp/whatever' });
  const res = run('log-intervention', input);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /record/);
});
