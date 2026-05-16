import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { parseRollup, runMigration } from './migrate-rollup-md-to-json.ts';

let root: string;
let mdPath: string;
let jsonPath: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'migrate-rollup-test-'));
  mkdirSync(join(root, 'learnings'), { recursive: true });
  mdPath = join(root, 'learnings', 'rollup.md');
  jsonPath = join(root, 'learnings', 'rollup.json');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const SINGLE_L_ENTRY = `## L-001: Node 24 strips TS — use \`node\` directly

Promoted: 2026-05-11
Origin: 2026-05-06T10-22-36-node-24-strips-types

### Learning

When authoring a TypeScript script for direct invocation under Node 24+, use \`node script.ts\` directly.

Caveat: erasable TypeScript only.

### Rubric

- Output invokes TypeScript scripts using \`node\` directly
- Output does not contain \`npx tsx\` as a runtime wrapper
- Output does not propose adding \`tsx\` as a dependency
`;

const TWO_L_ENTRIES = `## L-001: First learning

Promoted: 2026-05-11
Origin: slug-one

### Learning

Body of first learning.

### Rubric

- criterion 1
- criterion 2

## L-002: Second learning

Promoted: 2026-05-12
Origin: slug-two

### Learning

Body of second learning, multi-paragraph.

Second paragraph here.

### Rubric

- another criterion
`;

const L_PLUS_AP = `## L-001: Just a learning

Promoted: 2026-05-11
Origin: slug-learning

### Learning

Learning body.

### Rubric

- criterion

## Project antipatterns

### AP-001: Some antipattern

Promoted: 2026-05-12
Origin: slug-antipattern
Classification: generator-antipattern
Evaluator: evaluator-css-architecture
Code: css-arch-specificity-fight

Body of the antipattern, describing the bad pattern.
`;

test('parseRollup: single L entry produces one structured object', () => {
  const entries = parseRollup(SINGLE_L_ENTRY);
  expect(entries.length).toBe(1);
  const e = entries[0];
  expect(e.id).toBe('L-001');
  expect(e.title).toBe('Node 24 strips TS — use `node` directly');
  expect(e.classification).toBe('L');
  expect(e.promoted).toBe('2026-05-11');
  expect(e.origin).toBe('2026-05-06T10-22-36-node-24-strips-types');
  expect(e.body).toMatch(/^When authoring a TypeScript script/);
  expect(e.body).toMatch(/erasable TypeScript only\.$/);
  expect(e.rubric).toEqual([
    'Output invokes TypeScript scripts using `node` directly',
    'Output does not contain `npx tsx` as a runtime wrapper',
    'Output does not propose adding `tsx` as a dependency',
  ]);
});

test('parseRollup: multi-entry, preserves order', () => {
  const entries = parseRollup(TWO_L_ENTRIES);
  expect(entries.length).toBe(2);
  expect(entries[0].id).toBe('L-001');
  expect(entries[1].id).toBe('L-002');
  expect(entries[1].body).toMatch(/Second paragraph here\.$/);
});

test('parseRollup: L + AP entries — both kinds parsed', () => {
  const entries = parseRollup(L_PLUS_AP);
  expect(entries.length).toBe(2);
  const l = entries.find((e) => e.id === 'L-001');
  const ap = entries.find((e) => e.id === 'AP-001');
  expect(l?.classification).toBe('L');
  expect(l?.rubric).toEqual(['criterion']);
  expect(ap?.classification).toBe('AP');
  expect(ap?.evaluator).toBe('evaluator-css-architecture');
  expect(ap?.code).toBe('css-arch-specificity-fight');
  expect(ap?.body).toMatch(/^Body of the antipattern/);
  expect(ap?.rubric).toBe(null);
});

test('parseRollup: empty input returns empty array', () => {
  expect(parseRollup('')).toEqual([]);
});

test('runMigration: writes rollup.json from rollup.md', () => {
  writeFileSync(mdPath, SINGLE_L_ENTRY);
  const result = runMigration(mdPath, jsonPath);
  expect(result.action).toBe('migrated');
  expect(existsSync(jsonPath)).toBe(true);
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  expect(parsed.length).toBe(1);
  expect(parsed[0].id).toBe('L-001');
});

test('runMigration: idempotent — re-run with existing rollup.json is no-op', () => {
  writeFileSync(mdPath, SINGLE_L_ENTRY);
  runMigration(mdPath, jsonPath);
  const before = readFileSync(jsonPath, 'utf-8');
  const second = runMigration(mdPath, jsonPath);
  expect(second.action).toBe('skipped-already-migrated');
  expect(readFileSync(jsonPath, 'utf-8')).toBe(before);
});

test('runMigration: no rollup.md → no-source result, no rollup.json written', () => {
  const result = runMigration(mdPath, jsonPath);
  expect(result.action).toBe('no-source');
  expect(existsSync(jsonPath)).toBe(false);
});

test('runMigration: empty rollup.md → produces empty array', () => {
  writeFileSync(mdPath, '');
  const result = runMigration(mdPath, jsonPath);
  expect(result.action).toBe('migrated');
  expect(JSON.parse(readFileSync(jsonPath, 'utf-8'))).toEqual([]);
});
