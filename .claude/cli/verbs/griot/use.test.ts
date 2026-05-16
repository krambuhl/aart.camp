// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, beforeEach, afterEach } from 'vitest';
import { useVerb } from './use.ts';
import type { GriotCliContext } from './index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USE_SOURCE = join(__dirname, 'use.ts');

let workspace: string;
let ctx: GriotCliContext;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'griot-use-test-'));
  ctx = { cwd: workspace };
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function writeRollup(content: string): void {
  mkdirSync(join(workspace, 'learnings'), { recursive: true });
  writeFileSync(join(workspace, 'learnings', 'rollup.md'), content);
}

const SAMPLE_ONE_LEARNING = `# Curated learnings

## L-001: prefer X over Y

Body of the first learning. Some rationale here.
`;

const SAMPLE_FIVE_LEARNINGS = `# Curated learnings

## L-001: prefer X over Y

First.

## L-002: avoid Z under condition C

Second.

## L-003: pattern P emerges from frequency F

Third.

## L-004: catalog gap G observed

Fourth.

## L-005: generator antipattern A

Fifth.
`;

const EMPTY_ROLLUP = `# Curated learnings

No validated learnings yet — this file exists as a header so /griot-compact has a target to write into.
`;

function antipatternEntry(n: number, title: string): string {
  const id = `AP-${String(n).padStart(3, '0')}`;
  return `### ${id}: ${title}\n\nPromoted: 2026-05-15\nOrigin: synthetic-${n}\nClassification: generator-antipattern\nEvaluator: evaluator-x\nCode: code-${n}\n\nAvoid this antipattern. Body of entry ${n}.\n\n`;
}

function buildRollupWith(opts: { learnings: number; antipatterns: number }): string {
  let out = '# Curated learnings\n\n';
  for (let i = 1; i <= opts.learnings; i++) {
    out += `## L-${String(i).padStart(3, '0')}: learning ${i}\n\nBody of learning ${i}.\n\n`;
  }
  if (opts.antipatterns > 0) {
    out += '## Project antipatterns\n\n';
    for (let i = 1; i <= opts.antipatterns; i++) {
      out += antipatternEntry(i, `synthetic antipattern ${i}`);
    }
  }
  return out;
}

test('loaded: one learning → status, content, citation contract', () => {
  writeRollup(SAMPLE_ONE_LEARNING);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^griot-use: loaded 1 learnings from learnings\/rollup\.md\n/);
  expect(result.stdout).toContain('## L-001: prefer X over Y');
  expect(result.stdout).toContain('Body of the first learning');
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('padded citations poison that signal');
  expect(result.stdout).toContain('Tier separation');
});

test('loaded: five learnings → status reports correct count', () => {
  writeRollup(SAMPLE_FIVE_LEARNINGS);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^griot-use: loaded 5 learnings from learnings\/rollup\.md\n/);
  for (let i = 1; i <= 5; i++) {
    expect(result.stdout).toContain(`L-00${i}`);
  }
});

test('empty: rollup with no L-NNN headings → empty message, no citation contract', () => {
  writeRollup(EMPTY_ROLLUP);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: rollup empty — no validated learnings yet');
  expect(result.stdout).not.toContain('Applied: L-NNN');
  expect(result.stdout).not.toContain('Tier separation');
});

test('missing: no rollup.md (learnings/ dir absent) → no-rollup-yet message, no citation contract', () => {
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: no rollup yet — run `/griot-compact` once captures exist');
  expect(result.stdout).not.toContain('Applied: L-NNN');
});

test('missing: learnings/ dir exists but rollup.md does not → same no-rollup-yet message', () => {
  mkdirSync(join(workspace, 'learnings'), { recursive: true });
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: no rollup yet — run `/griot-compact` once captures exist');
});

test('citation contract: includes the three load-bearing phrases verbatim', () => {
  writeRollup(SAMPLE_ONE_LEARNING);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('padded citations poison that signal');
  expect(result.stdout).toContain('only valid inputs to `/griot-compact`');
});

test('antipatterns: status line reports antipattern count when present', () => {
  writeRollup(buildRollupWith({ learnings: 2, antipatterns: 3 }));
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^griot-use: loaded 2 learnings \+ 3 antipatterns from learnings\/rollup\.md\n/);
});

test('antipatterns: N=3 entries → all 3 emitted, no tail line', () => {
  writeRollup(buildRollupWith({ learnings: 1, antipatterns: 3 }));
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  for (let i = 1; i <= 3; i++) {
    expect(result.stdout).toContain(`AP-00${i}`);
  }
  expect(result.stdout).not.toContain('more antipatterns not shown');
});

test('antipatterns: N=12 entries → first 10 emitted, tail line summarizes remainder', () => {
  writeRollup(buildRollupWith({ learnings: 1, antipatterns: 12 }));
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  for (let i = 1; i <= 10; i++) {
    const tag = `AP-${String(i).padStart(3, '0')}`;
    expect(result.stdout).toContain(tag);
  }
  expect(result.stdout).not.toContain('AP-011:');
  expect(result.stdout).not.toContain('AP-012:');
  expect(result.stdout).toMatch(/\+2 more antipatterns not shown — top-10 curated/);
  expect(result.stdout).toMatch(/loaded 1 learnings \+ 12 antipatterns from/);
});

test('antipatterns: only antipatterns (0 learnings) → status reports both counts, content emitted', () => {
  writeRollup(buildRollupWith({ learnings: 0, antipatterns: 2 }));
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toContain('rollup empty');
  expect(result.stdout).toMatch(/^griot-use: loaded 0 learnings \+ 2 antipatterns from/);
  expect(result.stdout).toContain('AP-001');
  expect(result.stdout).toContain('AP-002');
  expect(result.stdout).toContain('Applied:');
});

test('antipatterns: zero learnings + zero antipatterns → existing rollup-empty message', () => {
  writeRollup('# Curated learnings\n\nNo entries.\n');
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: rollup empty — no validated learnings yet');
});

test('citation contract: mentions Applied: AP-NNN shape when antipatterns are present', () => {
  writeRollup(buildRollupWith({ learnings: 1, antipatterns: 1 }));
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('Applied: AP-NNN');
});

test('antipatterns: existing single-learning path still emits unchanged status (no antipatterns)', () => {
  // Regression: status line for 0-antipattern rollups stays in the legacy
  // "loaded N learnings from <path>" shape (no "+ 0 antipatterns" noise).
  writeRollup(SAMPLE_ONE_LEARNING);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  const statusLine = (result.stdout ?? '').split('\n')[0];
  expect(statusLine).toBe('griot-use: loaded 1 learnings from learnings/rollup.md');
  expect(statusLine).not.toContain('antipatterns');
});

test('tier-separation invariant: verb source contains exactly one learnings/ path and zero session-notes/nightly references', () => {
  const source = readFileSync(USE_SOURCE, 'utf-8');
  // Strip the citation-contract literal text — it intentionally documents
  // session-notes/nightly as paths the LLM must NOT read; that is prose,
  // not a filesystem-read pattern. We only care about actual fs.read
  // paths outside the documentation block.
  const docBlockRe = /const CITATION_CONTRACT[\s\S]*?^`;$/m;
  const sourceWithoutDocs = source.replace(docBlockRe, 'const CITATION_CONTRACT = "<elided>";');
  const learningsMatches = sourceWithoutDocs.match(/learnings\//g) ?? [];
  expect(learningsMatches.length).toBe(1);
  expect(sourceWithoutDocs).not.toContain('session-notes');
  expect(sourceWithoutDocs).not.toContain('nightly');
});
