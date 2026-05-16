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
} from './guild.ts';
import type { GuildCliContext } from './guild.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUILD_ENTRY = join(__dirname, 'guild.ts');
const BIN_GUILD = join(__dirname, '..', '..', 'bin', 'guild');

function makeCtx(): GuildCliContext {
  return { cwd: mkdtempSync(join(tmpdir(), 'guild-dispatch-test-')) };
}

function cleanup(ctx: GuildCliContext): void {
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
  expect(parseInvocation(['parse-and-aggregate'])).toEqual({
    kind: 'verb',
    verb: 'parse-and-aggregate',
    rest: [],
  });
});

test('parseInvocation: unknown verb → unknown', () => {
  expect(parseInvocation(['xyzzy'])).toEqual({ kind: 'unknown', verb: 'xyzzy' });
});

test('parseInvocation: --help anywhere routes to help', () => {
  expect(parseInvocation(['parse-and-aggregate', '--help'])).toEqual({ kind: 'help' });
});

test('parseInvocation: leading flag → unknown', () => {
  expect(parseInvocation(['--unknown-flag'])).toEqual({
    kind: 'unknown',
    verb: '--unknown-flag',
  });
});

test('formatHelp: includes CLI name and every registered verb', () => {
  const help = formatHelp();
  expect(help).toContain('guild — antagonist-panel substrate CLI');
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
    expect(result.stdout).toContain('guild — antagonist-panel substrate CLI');
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

test('dispatch: known verb (empty stdin) routes to parse-and-aggregate handler', () => {
  const ctx = makeCtx();
  try {
    const result = dispatch(
      { kind: 'verb', verb: 'parse-and-aggregate', rest: [] },
      ctx,
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/empty input on stdin/);
  } finally {
    cleanup(ctx);
  }
});

// ---------- Integration: bin/guild smoke test ----------

test('bin/guild --help: prints help and exits 0', () => {
  const result = spawnSync(BIN_GUILD, ['--help'], { encoding: 'utf-8' });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('guild — antagonist-panel substrate CLI');
  expect(result.stdout).toContain('parse-and-aggregate');
});

test('bin/guild bogus: prints structured error and exits 1', () => {
  const result = spawnSync(BIN_GUILD, ['bogus'], { encoding: 'utf-8' });
  expect(result.status).toBe(1);
  const payload = JSON.parse(result.stderr);
  expect(payload.error).toBe('unknown-verb');
  expect(payload.candidates).toContain('parse-and-aggregate');
});

test('bin/guild parse-and-aggregate: pipes stdin through to the verb', () => {
  const input = JSON.stringify([
    {
      agent: 'evaluator-x',
      output: 'preamble\n\nVERDICT: approved',
    },
  ]);
  const result = spawnSync(BIN_GUILD, ['parse-and-aggregate'], {
    input,
    encoding: 'utf-8',
  });
  expect(result.status).toBe(0);
  const out = JSON.parse(result.stdout);
  expect(out.verdict).toBe('approved');
});

test('node entry: GUILD_ENTRY is the dispatcher loaded by the bin shim', () => {
  const result = spawnSync(process.execPath, [GUILD_ENTRY, '--help'], {
    encoding: 'utf-8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('guild — antagonist-panel substrate CLI');
});
