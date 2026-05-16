import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import {
  VERBS,
  dispatch,
  formatHelp,
  formatUnknownVerbError,
  parseInvocation,
} from './griot.ts';
import type { GriotCliContext } from './griot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRIOT_ENTRY = join(__dirname, 'griot.ts');
const BIN_GRIOT = join(__dirname, '..', '..', 'bin', 'griot');

function makeCtx(): GriotCliContext {
  return { cwd: mkdtempSync(join(tmpdir(), 'griot-dispatch-test-')) };
}

function cleanup(ctx: GriotCliContext): void {
  rmSync(ctx.cwd, { recursive: true, force: true });
}

// ---------- Pure helper tests ----------

test('parseInvocation: no args → help', () => {
  expect(parseInvocation([])).toEqual({ kind: 'help' });
});

test('parseInvocation: --help → help', () => {
  expect(parseInvocation(['--help'])).toEqual({ kind: 'help' });
});

test('parseInvocation: -h → help', () => {
  expect(parseInvocation(['-h'])).toEqual({ kind: 'help' });
});

test('parseInvocation: known verb → verb with rest', () => {
  expect(parseInvocation(['use'])).toEqual({
    kind: 'verb',
    verb: 'use',
    rest: [],
  });
});

test('parseInvocation: unknown verb → unknown', () => {
  expect(parseInvocation(['xyzzy'])).toEqual({ kind: 'unknown', verb: 'xyzzy' });
});

test('parseInvocation: --help anywhere routes to help', () => {
  expect(parseInvocation(['use', '--help'])).toEqual({ kind: 'help' });
});

test('parseInvocation: leading flag → unknown', () => {
  expect(parseInvocation(['--unknown-flag'])).toEqual({
    kind: 'unknown',
    verb: '--unknown-flag',
  });
});

test('formatHelp: includes CLI name and every registered verb', () => {
  const help = formatHelp();
  expect(help).toContain('griot — learnings-substrate CLI');
  for (const verb of Object.keys(VERBS)) {
    expect(help).toContain(verb);
  }
});

test('formatUnknownVerbError: returns structured JSON with candidates', () => {
  const payload = JSON.parse(formatUnknownVerbError('bogus'));
  expect(payload.error).toBe('unknown-verb');
  expect(payload.message).toBe('unknown verb: bogus');
  expect(payload.candidates).toEqual(Object.keys(VERBS));
});

test('formatUnknownVerbError: empty verb → "no verb specified"', () => {
  const payload = JSON.parse(formatUnknownVerbError(''));
  expect(payload.message).toBe('no verb specified');
});

// ---------- dispatch() tests ----------

test('dispatch: help invocation returns the help text on stdout', () => {
  const ctx = makeCtx();
  try {
    const result = dispatch({ kind: 'help' }, ctx);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('griot — learnings-substrate CLI');
  } finally {
    cleanup(ctx);
  }
});

test('dispatch: unknown verb returns structured error on stderr, exit 1', () => {
  const ctx = makeCtx();
  try {
    const result = dispatch({ kind: 'unknown', verb: 'bogus' }, ctx);
    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.stderr as string);
    expect(payload.error).toBe('unknown-verb');
  } finally {
    cleanup(ctx);
  }
});

test('dispatch: known verb (no rollup) routes to use handler', () => {
  const ctx = makeCtx();
  try {
    const result = dispatch({ kind: 'verb', verb: 'use', rest: [] }, ctx);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('no rollup yet');
  } finally {
    cleanup(ctx);
  }
});

// ---------- Integration: bin/griot smoke test ----------

test('bin/griot --help: prints help and exits 0', () => {
  const result = spawnSync(BIN_GRIOT, ['--help'], { encoding: 'utf-8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('griot — learnings-substrate CLI');
  expect(result.stdout).toContain('use');
});

test('bin/griot bogus: prints structured error and exits 1', () => {
  const result = spawnSync(BIN_GRIOT, ['bogus'], { encoding: 'utf-8' });
  expect(result.status).toBe(1);
  const payload = JSON.parse(result.stderr);
  expect(payload.error).toBe('unknown-verb');
  expect(payload.candidates).toContain('use');
});

test('bin/griot use: runs in a fresh cwd with no rollup', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'griot-bin-test-'));
  try {
    const result = spawnSync(BIN_GRIOT, ['use'], { cwd, encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('no rollup yet');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('node entry: GRIOT_ENTRY is the dispatcher loaded by the bin shim', () => {
  // Sanity guard: if the entry path moves, the shim diverges and bin/griot
  // breaks. This test pins the expected location so a future rename has
  // to update both the shim and this test together.
  const result = spawnSync(process.execPath, [GRIOT_ENTRY, '--help'], {
    encoding: 'utf-8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('griot — learnings-substrate CLI');
});

test('bin/griot operator-checks: pipes stdin through to the verb', () => {
  const input = JSON.stringify({
    rubric_path: '/tmp/__griot_test_does_not_exist__.md',
    expected: 'whatever',
  });
  const result = spawnSync(BIN_GRIOT, ['operator-checks', 'verify-rubric'], {
    input,
    encoding: 'utf-8',
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/rubric file does not exist/);
});

test('bin/griot mediate-panel: pipes stdin through to the verb', () => {
  const input = JSON.stringify({
    round_num: 1,
    verdicts: [
      {
        judge_id: 'opus-A',
        tier: 'opus',
        raw_output: '```verdict\n{"verdict": "IMPROVED", "reasoning": "r"}\n```',
      },
    ],
    config: {
      consensus: { round_1_blind: 1, round_2_debate: 1 },
      tiebreak: { rule: 'top_tier_consensus', top_tier: 'opus' },
    },
  });
  const result = spawnSync(BIN_GRIOT, ['mediate-panel'], {
    input,
    encoding: 'utf-8',
  });
  expect(result.status).toBe(0);
  const out = JSON.parse(result.stdout);
  expect(out.consensus_verdict).toBe('IMPROVED');
  expect(out.threshold_met).toBe(true);
});
