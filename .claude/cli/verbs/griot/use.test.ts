// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { GriotCliContext } from './index.ts';
import { useVerb } from './use.ts';

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

type RollupEntry = {
  id: string;
  title: string;
  classification: 'L' | 'AP';
  promoted: string;
  origin: string;
  body: string;
  rubric: string[] | null;
  evaluator?: string;
  code?: string;
};

function writeRollupJson(entries: RollupEntry[]): void {
  mkdirSync(join(workspace, 'learnings'), { recursive: true });
  writeFileSync(
    join(workspace, 'learnings', 'rollup.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
}

function writeLegacyRollupMd(content: string): void {
  mkdirSync(join(workspace, 'learnings'), { recursive: true });
  writeFileSync(join(workspace, 'learnings', 'rollup.md'), content);
}

function learning(n: number, title: string, body = `Body of learning ${n}.`): RollupEntry {
  return {
    id: `L-${String(n).padStart(3, '0')}`,
    title,
    classification: 'L',
    promoted: '2026-05-11',
    origin: `slug-${n}`,
    body,
    rubric: null,
  };
}

function antipattern(n: number, title: string): RollupEntry {
  return {
    id: `AP-${String(n).padStart(3, '0')}`,
    title,
    classification: 'AP',
    promoted: '2026-05-15',
    origin: `synthetic-${n}`,
    body: `Avoid this antipattern. Body of entry ${n}.`,
    rubric: null,
    evaluator: 'evaluator-x',
    code: `code-${n}`,
  };
}

test('loaded: one learning → status, content, citation contract', () => {
  writeRollupJson([learning(1, 'prefer X over Y', 'Body of the first learning. Some rationale here.')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^griot-use: loaded 1 learnings from learnings\/rollup\.json\n/);
  expect(result.stdout).toContain('## L-001: prefer X over Y');
  expect(result.stdout).toContain('Body of the first learning');
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('padded citations poison that signal');
  expect(result.stdout).toContain('Tier separation');
});

test('loaded: five learnings → status reports correct count', () => {
  const entries = [1, 2, 3, 4, 5].map((n) => learning(n, `title ${n}`));
  writeRollupJson(entries);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/^griot-use: loaded 5 learnings from learnings\/rollup\.json\n/);
  for (let i = 1; i <= 5; i++) {
    expect(result.stdout).toContain(`L-00${i}`);
  }
});

test('empty: rollup.json with no entries → empty message, no citation contract', () => {
  writeRollupJson([]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: rollup empty — no validated learnings yet');
  expect(result.stdout).not.toContain('Applied: L-NNN');
  expect(result.stdout).not.toContain('Tier separation');
});

test('missing: no rollup.json (learnings/ dir absent) → no-rollup-yet message, no citation contract', () => {
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: no rollup yet — run `/griot-compact` once captures exist');
  expect(result.stdout).not.toContain('Applied: L-NNN');
});

test('missing: learnings/ dir exists but rollup.json does not → same no-rollup-yet message', () => {
  mkdirSync(join(workspace, 'learnings'), { recursive: true });
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('griot-use: no rollup yet — run `/griot-compact` once captures exist');
});

test('format-detection: legacy rollup.md present but rollup.json missing → loud error', () => {
  writeLegacyRollupMd('## L-001: stale\n\nBody.\n');
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toMatch(/legacy learnings\/rollup\.md present but learnings\/rollup\.json missing/);
  expect(result.stderr).toMatch(/migrate-rollup-md-to-json\.ts/);
  expect(result.stderr).toMatch(/restart session/);
});

test('format-detection: both rollup.md and rollup.json present → reads rollup.json (no error)', () => {
  writeLegacyRollupMd('## L-001: stale\n\nBody.\n');
  writeRollupJson([learning(1, 'fresh title')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('L-001: fresh title');
});

test('--as=llm: explicit flag accepted, identical output to no-flag', () => {
  writeRollupJson([learning(1, 'title')]);
  const noFlag = useVerb([], ctx);
  const explicit = useVerb(['--as=llm'], ctx);
  expect(explicit.exitCode).toBe(0);
  expect(explicit.stdout).toBe(noFlag.stdout);
});

test('--as=unknown: rejected with valid-values hint', () => {
  writeRollupJson([learning(1, 'title')]);
  const result = useVerb(['--as=json'], ctx);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toMatch(/unknown --as value 'json'/);
  expect(result.stderr).toMatch(/supported: llm/);
});

test('citation contract: includes the three load-bearing phrases verbatim', () => {
  writeRollupJson([learning(1, 'title')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('padded citations poison that signal');
  expect(result.stdout).toContain('only valid inputs to `/griot-compact`');
});

test('antipatterns: status line reports antipattern count when present', () => {
  writeRollupJson([
    learning(1, 'title 1'),
    learning(2, 'title 2'),
    antipattern(1, 'ap 1'),
    antipattern(2, 'ap 2'),
    antipattern(3, 'ap 3'),
  ]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(
    /^griot-use: loaded 2 learnings \+ 3 antipatterns from learnings\/rollup\.json\n/,
  );
});

test('antipatterns: N=3 entries → all 3 emitted, no tail line', () => {
  writeRollupJson([
    learning(1, 'l'),
    antipattern(1, 'a'),
    antipattern(2, 'b'),
    antipattern(3, 'c'),
  ]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  for (let i = 1; i <= 3; i++) {
    expect(result.stdout).toContain(`AP-00${i}`);
  }
  expect(result.stdout).not.toContain('more antipatterns not shown');
});

test('antipatterns: N=12 entries → first 10 emitted, tail line summarizes remainder', () => {
  const entries = [learning(1, 'l')];
  for (let i = 1; i <= 12; i++) entries.push(antipattern(i, `ap ${i}`));
  writeRollupJson(entries);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  for (let i = 1; i <= 10; i++) {
    const tag = `AP-${String(i).padStart(3, '0')}`;
    expect(result.stdout).toContain(tag);
  }
  expect(result.stdout).not.toContain('AP-011');
  expect(result.stdout).not.toContain('AP-012');
  expect(result.stdout).toMatch(/\+2 more antipatterns not shown — top-10 curated/);
  expect(result.stdout).toMatch(/loaded 1 learnings \+ 12 antipatterns from/);
});

test('antipatterns: only antipatterns (0 learnings) → status reports both counts, content emitted', () => {
  writeRollupJson([antipattern(1, 'a'), antipattern(2, 'b')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toContain('rollup empty');
  expect(result.stdout).toMatch(/^griot-use: loaded 0 learnings \+ 2 antipatterns from/);
  expect(result.stdout).toContain('AP-001');
  expect(result.stdout).toContain('AP-002');
  expect(result.stdout).toContain('Applied:');
});

test('antipatterns: existing single-learning path still emits unchanged status (no antipatterns)', () => {
  writeRollupJson([learning(1, 'title')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  const statusLine = (result.stdout ?? '').split('\n')[0];
  expect(statusLine).toBe('griot-use: loaded 1 learnings from learnings/rollup.json');
  expect(statusLine).not.toContain('antipatterns');
});

test('citation contract: mentions Applied: AP-NNN shape when antipatterns are present', () => {
  writeRollupJson([learning(1, 'l'), antipattern(1, 'a')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('Applied: L-NNN');
  expect(result.stdout).toContain('Applied: AP-NNN');
});

test('rubric: learnings with rubric render the criteria as bulleted list', () => {
  const entry: RollupEntry = {
    ...learning(1, 'with rubric'),
    rubric: ['criterion 1', 'criterion 2', 'criterion 3'],
  };
  writeRollupJson([entry]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('### Rubric');
  expect(result.stdout).toContain('- criterion 1');
  expect(result.stdout).toContain('- criterion 2');
  expect(result.stdout).toContain('- criterion 3');
});

test('rubric: learnings without rubric do not emit a Rubric section', () => {
  writeRollupJson([learning(1, 'no rubric')]);
  const result = useVerb([], ctx);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toContain('### Rubric');
});

test('tier-separation invariant: verb source contains only the canonical learnings/ path and zero session-notes/nightly references', () => {
  const source = readFileSync(USE_SOURCE, 'utf-8');
  // Strip the citation-contract literal text — it intentionally documents
  // session-notes/nightly as paths the LLM must NOT read; that is prose,
  // not a filesystem-read pattern. We only care about actual fs.read
  // paths outside the documentation block.
  const docBlockRe = /const CITATION_CONTRACT[\s\S]*?^`;$/m;
  const sourceWithoutDocs = source.replace(docBlockRe, 'const CITATION_CONTRACT = "<elided>";');
  const learningsMatches = sourceWithoutDocs.match(/learnings\//g) ?? [];
  // One literal: the canonical rollup.json path. The legacy rollup.md
  // path is derived at runtime via .replace(), so it doesn't appear as
  // a separate `learnings/` literal.
  expect(learningsMatches.length).toBe(1);
  expect(sourceWithoutDocs).not.toContain('session-notes');
  expect(sourceWithoutDocs).not.toContain('nightly');
});
