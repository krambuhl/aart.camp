import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readManifest, writeManifest } from './manifest.ts';
import type { Manifest } from './types.ts';

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

test('writeManifest round-trips through readManifest', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loom-manifest-write-'));
  const target = join(tmp, 'manifest.json');
  const original = readManifest(FIXTURE);
  writeManifest(target, original);
  const roundTripped = readManifest(target);
  expect(roundTripped).toEqual(original);
  rmSync(tmp, { recursive: true, force: true });
});

test('writeManifest produces pretty-printed JSON (2-space indent)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loom-manifest-write-pretty-'));
  const target = join(tmp, 'manifest.json');
  const manifest: Manifest = {
    schema_version: 1,
    title: 't',
    slug: 's',
    started: '2026-05-15',
    status: 'active',
    current_branch: null,
    latest_checkin: null,
    strategy: 'x',
    phases: [],
  };
  writeManifest(target, manifest);
  const { readFileSync } = require('node:fs');
  const raw = readFileSync(target, 'utf8') as string;
  expect(raw).toContain('\n  ');
  rmSync(tmp, { recursive: true, force: true });
});
