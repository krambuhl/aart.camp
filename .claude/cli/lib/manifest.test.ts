import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readManifest } from './manifest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixtures', 'manifest-basic.json');

test('readManifest loads a valid manifest.json', () => {
  const m = readManifest(FIXTURE);
  expect(m.schema_version).toBe(1);
  expect(m.title).toBe('Loom: JSON-first project-substrate CLI');
  expect(m.status).toBe('active');
  expect(m.phases).toHaveLength(4);
});

test('readManifest throws manifest-not-found on missing file', () => {
  expect(() => readManifest('/nonexistent/manifest.json')).toThrow(
    /manifest-not-found/,
  );
});

test('readManifest throws manifest-invalid-json on invalid JSON', () => {
  // Use a non-JSON fixture path — events.jsonl is line-delimited, not a JSON document
  const eventsPath = join(__dirname, '..', 'fixtures', 'events-all-types.jsonl');
  expect(() => readManifest(eventsPath)).toThrow(/manifest-invalid-json/);
});
