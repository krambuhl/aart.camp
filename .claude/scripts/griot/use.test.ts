// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/griot/use.ts');
const NODE_BIN = process.execPath;

type RunResult = { stdout: string; stderr: string; status: number };

function run(cwd: string): RunResult {
  try {
    const stdout = execFileSync(NODE_BIN, [SCRIPT], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
      status: e.status ?? 1,
    };
  }
}

function makeFixture(opts: { rollup?: string; createLearningsDir?: boolean } = {}): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'griot-use-test-'));
  if (opts.rollup !== undefined) {
    mkdirSync(join(root, 'learnings'), { recursive: true });
    writeFileSync(join(root, 'learnings', 'rollup.md'), opts.rollup);
  } else if (opts.createLearningsDir) {
    mkdirSync(join(root, 'learnings'), { recursive: true });
  }
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
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

test('loaded: one learning → status, content, citation contract', () => {
  const fx = makeFixture({ rollup: SAMPLE_ONE_LEARNING });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: loaded 1 learnings from learnings\/rollup\.md\n/);
    // Content present
    assert.ok(result.stdout.includes('## L-001: prefer X over Y'), 'rollup content should be present');
    assert.ok(result.stdout.includes('Body of the first learning'), 'learning body should be present');
    // Citation contract present
    assert.ok(result.stdout.includes('Applied: L-NNN'), 'citation contract Applied: marker should be present');
    assert.ok(result.stdout.includes('padded citations poison that signal'), 'citation discipline reminder should be present');
    assert.ok(result.stdout.includes('Tier separation'), 'tier-separation header should be present');
  } finally {
    fx.cleanup();
  }
});

test('loaded: five learnings → status reports correct count', () => {
  const fx = makeFixture({ rollup: SAMPLE_FIVE_LEARNINGS });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: loaded 5 learnings from learnings\/rollup\.md\n/);
    // All five entries present
    for (let i = 1; i <= 5; i++) {
      const tag = `L-00${i}`;
      assert.ok(result.stdout.includes(tag), `${tag} should be present`);
    }
  } finally {
    fx.cleanup();
  }
});

test('empty: rollup with no L-NNN headings → empty message, no citation contract', () => {
  const fx = makeFixture({ rollup: EMPTY_ROLLUP });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: rollup empty — no validated learnings yet\n$/);
    assert.ok(!result.stdout.includes('Applied: L-NNN'), 'citation contract must NOT be printed on empty');
    assert.ok(!result.stdout.includes('Tier separation'), 'tier-separation block must NOT be printed on empty');
  } finally {
    fx.cleanup();
  }
});

test('missing: no rollup.md (learnings/ dir absent) → no-rollup-yet message, no citation contract', () => {
  const fx = makeFixture();
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: no rollup yet — run `\/griot-compact` once captures exist\n$/);
    assert.ok(!result.stdout.includes('Applied: L-NNN'));
  } finally {
    fx.cleanup();
  }
});

test('missing: learnings/ dir exists but rollup.md does not → same no-rollup-yet message', () => {
  const fx = makeFixture({ createLearningsDir: true });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: no rollup yet — run `\/griot-compact` once captures exist\n$/);
  } finally {
    fx.cleanup();
  }
});

test('citation contract: includes the three load-bearing phrases verbatim', () => {
  const fx = makeFixture({ rollup: SAMPLE_ONE_LEARNING });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0);
    // The three phrases that the deleted SKILL.md identified as the contract's load-bearing parts.
    assert.ok(result.stdout.includes('Applied: L-NNN'), 'phrase 1: Applied: L-NNN');
    assert.ok(result.stdout.includes('padded citations poison that signal'), 'phrase 2: discipline');
    assert.ok(result.stdout.includes('only valid inputs to `/griot-compact`'), 'phrase 3: tier-separation invariant');
  } finally {
    fx.cleanup();
  }
});

test('tier-separation invariant: script source contains exactly one learnings/ path and zero session-notes/nightly references', () => {
  const source = readFileSync(SCRIPT, 'utf-8');
  // Strip the citation-contract literal text — it intentionally documents
  // session-notes/nightly as paths the LLM must NOT read; that is prose,
  // not a filesystem-read pattern. We only care about actual fs.read paths
  // outside the documentation block.
  const docBlockRe = /const CITATION_CONTRACT[\s\S]*?^`;$/m;
  const sourceWithoutDocs = source.replace(docBlockRe, 'const CITATION_CONTRACT = "<elided>";');
  // Outside the doc block, there should be exactly one `learnings/` reference
  // (the ROLLUP_PATH constant) and zero `session-notes` or `nightly` references.
  const learningsMatches = sourceWithoutDocs.match(/learnings\//g) ?? [];
  assert.equal(learningsMatches.length, 1, `expected exactly 1 learnings/ reference outside doc block, found ${learningsMatches.length}`);
  assert.ok(!sourceWithoutDocs.includes('session-notes'), 'script must not reference session-notes outside doc block');
  assert.ok(!sourceWithoutDocs.includes('nightly'), 'script must not reference nightly outside doc block');
});
