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

test('antipatterns: status line reports antipattern count when present', () => {
  const fx = makeFixture({ rollup: buildRollupWith({ learnings: 2, antipatterns: 3 }) });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: loaded 2 learnings \+ 3 antipatterns from learnings\/rollup\.md\n/);
  } finally {
    fx.cleanup();
  }
});

test('antipatterns: N=3 entries → all 3 emitted, no tail line', () => {
  const fx = makeFixture({ rollup: buildRollupWith({ learnings: 1, antipatterns: 3 }) });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    for (let i = 1; i <= 3; i++) {
      assert.ok(result.stdout.includes(`AP-00${i}`), `AP-00${i} should be present`);
    }
    assert.ok(!result.stdout.includes('more antipatterns not shown'), 'no tail line when N <= 10');
  } finally {
    fx.cleanup();
  }
});

test('antipatterns: N=12 entries → first 10 emitted, tail line summarizes remainder', () => {
  const fx = makeFixture({ rollup: buildRollupWith({ learnings: 1, antipatterns: 12 }) });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // First 10 present
    for (let i = 1; i <= 10; i++) {
      const tag = `AP-${String(i).padStart(3, '0')}`;
      assert.ok(result.stdout.includes(tag), `${tag} should be present`);
    }
    // Last 2 (AP-011, AP-012) NOT in emitted body
    assert.ok(!result.stdout.includes('AP-011:'), 'AP-011 must be elided (over top-10 cap)');
    assert.ok(!result.stdout.includes('AP-012:'), 'AP-012 must be elided (over top-10 cap)');
    // Tail line names the elided count
    assert.match(result.stdout, /\+2 more antipatterns not shown — top-10 curated/);
    // Status line still reports the full count
    assert.match(result.stdout, /loaded 1 learnings \+ 12 antipatterns from/);
  } finally {
    fx.cleanup();
  }
});

test('antipatterns: only antipatterns (0 learnings) → status reports both counts, content emitted', () => {
  const fx = makeFixture({ rollup: buildRollupWith({ learnings: 0, antipatterns: 2 }) });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // Must NOT say "rollup empty"
    assert.ok(!result.stdout.includes('rollup empty'), 'rollup with antipatterns is not empty');
    assert.match(result.stdout, /^griot-use: loaded 0 learnings \+ 2 antipatterns from/);
    assert.ok(result.stdout.includes('AP-001'));
    assert.ok(result.stdout.includes('AP-002'));
    // Citation contract still present (it's about both L-NNN and AP-NNN now)
    assert.ok(result.stdout.includes('Applied:'), 'citation contract should be present');
  } finally {
    fx.cleanup();
  }
});

test('antipatterns: zero learnings + zero antipatterns → existing rollup-empty message', () => {
  const fx = makeFixture({ rollup: '# Curated learnings\n\nNo entries.\n' });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^griot-use: rollup empty — no validated learnings yet\n$/);
  } finally {
    fx.cleanup();
  }
});

test('citation contract: mentions Applied: AP-NNN shape when antipatterns are present', () => {
  const fx = makeFixture({ rollup: buildRollupWith({ learnings: 1, antipatterns: 1 }) });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('Applied: L-NNN'), 'L-NNN citation form preserved');
    assert.ok(result.stdout.includes('Applied: AP-NNN'), 'AP-NNN citation form must be present');
  } finally {
    fx.cleanup();
  }
});

test('antipatterns: existing single-learning path still emits unchanged status (no antipatterns)', () => {
  // Regression: status line for 0-antipattern rollups stays in the legacy
  // "loaded N learnings from <path>" shape (no "+ 0 antipatterns" noise).
  // The citation-contract body may mention "antipatterns" as a known
  // citation form; we only assert the status line shape, not the whole body.
  const fx = makeFixture({ rollup: SAMPLE_ONE_LEARNING });
  try {
    const result = run(fx.root);
    assert.equal(result.status, 0);
    const statusLine = result.stdout.split('\n')[0];
    assert.equal(statusLine, 'griot-use: loaded 1 learnings from learnings/rollup.md');
    assert.ok(!statusLine.includes('antipatterns'), 'no antipatterns word in zero-antipattern status line');
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
