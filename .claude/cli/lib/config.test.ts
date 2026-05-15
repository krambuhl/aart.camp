import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readConfig, writeConfig } from './config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixtures', 'config-basic.json');

test('readConfig loads a valid config.json', () => {
  const c = readConfig(FIXTURE);
  expect(c.schema_version).toBe(1);
  expect(c.base_branch).toBe('main');
  expect(c.verification).toContain('npm run test');
  expect(c.worker_bindings.default).toBe('ev-loop-interactive');
});

test('readConfig throws config-not-found on missing file', () => {
  expect(() => readConfig('/nonexistent/config.json')).toThrow(/config-not-found/);
});

test('writeConfig round-trips', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loom-config-write-'));
  const target = join(tmp, 'config.json');
  const original = readConfig(FIXTURE);
  writeConfig(target, original);
  const roundTripped = readConfig(target);
  expect(roundTripped).toEqual(original);
  rmSync(tmp, { recursive: true, force: true });
});
