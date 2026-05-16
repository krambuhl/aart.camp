import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DispatchResult, GriotCliContext } from './index.ts';

const VALID_MODES = ['verify-rubric', 'log-intervention'] as const;
type Mode = (typeof VALID_MODES)[number];

function fail(reason: string): DispatchResult {
  return {
    stderr: `operator-checks-error: ${reason}`,
    exitCode: 1,
  };
}

function isMode(s: string): s is Mode {
  return (VALID_MODES as readonly string[]).includes(s);
}

function parseStdinJson(stdin: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (stdin.trim() === '') return { ok: false, error: 'empty input on stdin' };
  try {
    return { ok: true, value: JSON.parse(stdin) };
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
  }
}

function verifyRubric(input: unknown): DispatchResult {
  if (!input || typeof input !== 'object') {
    return fail('input must be a JSON object');
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.rubric_path !== 'string') return fail('rubric_path must be a string');
  if (typeof obj.expected !== 'string') return fail('expected must be a string');
  const rubricPath = obj.rubric_path;
  const expected = obj.expected;
  if (!existsSync(rubricPath)) {
    return fail(`rubric file does not exist: ${rubricPath}`);
  }
  const actual = readFileSync(rubricPath, 'utf8');
  const payload = actual === expected ? { ok: true } : { ok: false, actual };
  return { stdout: JSON.stringify(payload), exitCode: 0 };
}

function logIntervention(input: unknown): DispatchResult {
  if (!input || typeof input !== 'object') {
    return fail('input must be a JSON object');
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.log_path !== 'string') return fail('log_path must be a string');
  if (!('record' in obj)) return fail('record field is required');
  const logPath = obj.log_path;
  const record = obj.record;
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(record)}\n`);
  return {
    stdout: JSON.stringify({ ok: true, appended_to: logPath }),
    exitCode: 0,
  };
}

export function operatorChecksVerb(
  rest: string[],
  ctx: GriotCliContext,
): DispatchResult {
  const mode = rest[0];
  if (mode === undefined) {
    return fail(`missing mode; valid modes: ${VALID_MODES.join(', ')}`);
  }
  if (!isMode(mode)) {
    return fail(`unknown mode "${mode}"; valid modes: ${VALID_MODES.join(', ')}`);
  }
  const parsed = parseStdinJson(ctx.stdin ?? '');
  if (!parsed.ok) {
    return fail(parsed.error);
  }
  return mode === 'verify-rubric'
    ? verifyRubric(parsed.value)
    : logIntervention(parsed.value);
}
