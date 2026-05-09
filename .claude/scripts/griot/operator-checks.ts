#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';

const VALID_MODES = ['verify-rubric', 'log-intervention'] as const;
type Mode = (typeof VALID_MODES)[number];

function fail(reason: string): never {
  process.stderr.write(`operator-checks-error: ${reason}\n`);
  process.exit(1);
}

function readStdin(): string {
  return readFileSync(0, 'utf8');
}

function readMode(): Mode {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode === undefined) {
    fail(`missing mode; valid modes: ${VALID_MODES.join(', ')}`);
  }
  if (!(VALID_MODES as readonly string[]).includes(mode)) {
    fail(`unknown mode "${mode}"; valid modes: ${VALID_MODES.join(', ')}`);
  }
  return mode as Mode;
}

function readJsonStdin(): unknown {
  const stdin = readStdin();
  if (stdin.trim() === '') fail('empty input on stdin');
  try {
    return JSON.parse(stdin);
  } catch (err) {
    fail(`JSON parse error: ${(err as Error).message}`);
  }
}

function verifyRubric(input: unknown): void {
  if (!input || typeof input !== 'object') fail('input must be a JSON object');
  const obj = input as Record<string, unknown>;
  if (typeof obj.rubric_path !== 'string') fail('rubric_path must be a string');
  if (typeof obj.expected !== 'string') fail('expected must be a string');
  const rubricPath = obj.rubric_path;
  const expected = obj.expected;
  if (!existsSync(rubricPath)) {
    fail(`rubric file does not exist: ${rubricPath}`);
  }
  const actual = readFileSync(rubricPath, 'utf8');
  if (actual === expected) {
    process.stdout.write(`${JSON.stringify({ ok: true })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ ok: false, actual })}\n`);
  }
}

function logIntervention(input: unknown): void {
  if (!input || typeof input !== 'object') fail('input must be a JSON object');
  const obj = input as Record<string, unknown>;
  if (typeof obj.log_path !== 'string') fail('log_path must be a string');
  if (!('record' in obj)) fail('record field is required');
  const logPath = obj.log_path;
  const record = obj.record;
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(record)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, appended_to: logPath })}\n`);
}

function main(): void {
  const mode = readMode();
  const input = readJsonStdin();
  if (mode === 'verify-rubric') {
    verifyRubric(input);
  } else {
    logIntervention(input);
  }
}

main();
