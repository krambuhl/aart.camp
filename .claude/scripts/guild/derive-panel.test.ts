import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  globToRegex,
  parseRules,
  parsePrecedence,
  matchPath,
  derivePanel,
  loadSpec,
  type Spec,
} from './derive-panel.ts';

const SCRIPT = join(process.cwd(), '.claude/scripts/guild/derive-panel.ts');

type RunResult = { stdout: string; stderr: string; status: number };

function run(args: string[] = [], input?: string): RunResult {
  const res = spawnSync('node', [SCRIPT, ...args], {
    input,
    encoding: 'utf-8',
  });
  return {
    stdout: (res.stdout ?? '').replace(/\n$/, ''),
    stderr: res.stderr ?? '',
    status: res.status ?? 1,
  };
}

function loadRealSpec(): Spec {
  return loadSpec(process.cwd());
}

// ---- Pure-function unit tests on the parsed spec ----

describe('derivePanel (live spec)', () => {
  const spec = loadRealSpec();

  test('empty file list → contract-fit only', () => {
    assert.deepEqual(derivePanel([], spec), ['evaluator-contract-fit']);
  });

  test('single .tsx → contract-fit + a11y + nextjs + react-api + naming', () => {
    assert.deepEqual(
      derivePanel(['components/Foo.tsx'], spec),
      [
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-naming',
      ]
    );
  });

  test('single .jsx → same panel as .tsx', () => {
    assert.deepEqual(
      derivePanel(['legacy/Foo.jsx'], spec),
      [
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-naming',
      ]
    );
  });

  test('single .module.css → contract-fit + tokens + naming', () => {
    assert.deepEqual(
      derivePanel(['components/Foo.module.css'], spec),
      ['evaluator-contract-fit', 'evaluator-tokens', 'evaluator-naming']
    );
  });

  test('single .css (non-module) → contract-fit + tokens', () => {
    assert.deepEqual(
      derivePanel(['styles/globals.css'], spec),
      ['evaluator-contract-fit', 'evaluator-tokens']
    );
  });

  test('single .ts (non-JSX) → contract-fit + react-api + naming', () => {
    assert.deepEqual(
      derivePanel(['lib/util.ts'], spec),
      ['evaluator-contract-fit', 'evaluator-react-api', 'evaluator-naming']
    );
  });

  test('single .md (prose) → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['README.md'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('single .json → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['package.json'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('substrate doc (.claude/agents/*.md) → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['.claude/agents/evaluator-foo.md'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('substrate skill (.claude/skills/foo/SKILL.md) → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['.claude/skills/foo/SKILL.md'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('checkin file under projects/ → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['projects/2026-05-02-agent-guilds/checkins/ev.foo/01.md'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('substrate script (.claude/scripts/foo/bar.ts) → contract-fit + naming', () => {
    assert.deepEqual(
      derivePanel(['.claude/scripts/foo/bar.ts'], spec),
      ['evaluator-contract-fit', 'evaluator-naming']
    );
  });

  test('substrate test (.claude/scripts/foo/bar.test.ts) → contract-fit only', () => {
    assert.deepEqual(
      derivePanel(['.claude/scripts/foo/bar.test.ts'], spec),
      ['evaluator-contract-fit']
    );
  });

  test('multi-file union (.tsx + .module.css) → all five domain lenses + contract-fit, precedence-ordered', () => {
    assert.deepEqual(
      derivePanel(['components/Foo.tsx', 'components/Foo.module.css'], spec),
      [
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-tokens',
        'evaluator-naming',
      ]
    );
  });

  test('sketch file (sketches/53-foo.tsx) → same as plain .tsx (carve-outs are the evaluator concern)', () => {
    assert.deepEqual(
      derivePanel(['sketches/53-foo.tsx'], spec),
      [
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-naming',
      ]
    );
  });

  test('duplicates deduped across multiple .tsx files', () => {
    assert.deepEqual(
      derivePanel(['app/page.tsx', 'app/about/page.tsx', 'components/Foo.tsx'], spec),
      [
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-naming',
      ]
    );
  });
});

// ---- globToRegex ----

describe('globToRegex', () => {
  test('*.tsx matches plain and nested .tsx files', () => {
    const re = globToRegex('*.tsx');
    assert.ok(re.test('Foo.tsx'));
    assert.ok(!re.test('Foo.ts'));
  });

  test('** matches any path segments', () => {
    const re = globToRegex('.claude/scripts/**/*.ts');
    assert.ok(re.test('.claude/scripts/guild/derive-panel.ts'));
    assert.ok(re.test('.claude/scripts/trout/autosave.ts'));
    assert.ok(!re.test('app/foo/bar.ts'));
  });

  test('* does not cross directory boundaries', () => {
    const re = globToRegex('.claude/agents/*.md');
    assert.ok(re.test('.claude/agents/foo.md'));
    assert.ok(!re.test('.claude/agents/sub/foo.md'));
  });

  test('escapes regex metacharacters', () => {
    const re = globToRegex('package.json');
    assert.ok(re.test('package.json'));
    assert.ok(!re.test('packageXjson'));
  });
});

// ---- CLI ----

describe('derive-panel CLI', () => {
  test('--files= with single .tsx', () => {
    const res = run(['--files=components/Foo.tsx']);
    assert.equal(res.status, 0);
    assert.equal(
      res.stdout,
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-naming'
    );
  });

  test('--files= with comma-separated multi-file union', () => {
    const res = run(['--files=Foo.tsx,Foo.module.css']);
    assert.equal(res.status, 0);
    assert.equal(
      res.stdout,
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming'
    );
  });

  test('stdin variant (newline-delimited paths)', () => {
    const res = run([], 'components/Foo.tsx\ncomponents/Foo.module.css\n');
    assert.equal(res.status, 0);
    assert.equal(
      res.stdout,
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming'
    );
  });

  test('stdin variant with empty input → baseline only', () => {
    const res = run([], '');
    assert.equal(res.status, 0);
    assert.equal(res.stdout, 'evaluator-contract-fit');
  });

  test('--files= with no files → baseline only', () => {
    const res = run(['--files=']);
    assert.equal(res.status, 0);
    assert.equal(res.stdout, 'evaluator-contract-fit');
  });
});

// ---- Defensive fallback ----

describe('loadSpec fallback', () => {
  test('returns valid spec from synthetic repo missing the file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'derive-panel-fallback-'));
    try {
      const spec = loadSpec(tmp);
      // Should return non-empty rules and precedence (the hardcoded
      // fallback values).
      assert.ok(spec.rules.length > 0, 'fallback rules non-empty');
      assert.ok(spec.precedence.length === 6, 'fallback precedence has all six');
      assert.equal(spec.precedence[0], 'evaluator-contract-fit');
      // And derive a valid panel from it.
      assert.deepEqual(
        derivePanel(['components/Foo.tsx'], spec),
        [
          'evaluator-contract-fit',
          'evaluator-a11y',
          'evaluator-nextjs',
          'evaluator-react-api',
          'evaluator-naming',
        ]
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('returns valid spec when the file is present but unparseable', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'derive-panel-bad-spec-'));
    try {
      mkdirSync(join(tmp, '.claude', 'agents'), { recursive: true });
      writeFileSync(
        join(tmp, '.claude', 'agents', 'PANEL-COMPOSITION.md'),
        '# nothing useful\n\nno sections.\n'
      );
      const spec = loadSpec(tmp);
      assert.ok(spec.rules.length > 0, 'fallback rules used');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---- Spec parsing matches CLI output ----

describe('spec parsing', () => {
  test('parseRules + parsePrecedence on live spec parse non-empty', () => {
    const spec = loadRealSpec();
    assert.ok(spec.rules.length >= 6, 'at least 6 rules parsed from live spec');
    assert.deepEqual(spec.precedence, [
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-tokens',
      'evaluator-naming',
    ]);
  });

  test('matchPath uses last-match-wins (substrate script over generic .ts)', () => {
    const spec = loadRealSpec();
    const matched = matchPath('.claude/scripts/foo/bar.ts', spec.rules);
    // Substrate-script row has just `naming`; generic `*.ts` row has
    // `react-api` + `naming`. Last-match-wins means substrate-script
    // wins → no react-api.
    assert.ok(!matched.includes('evaluator-react-api'));
    assert.ok(matched.includes('evaluator-naming'));
  });
});
