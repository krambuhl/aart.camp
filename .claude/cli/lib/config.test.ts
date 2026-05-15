import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readConfig } from './config.ts';

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
