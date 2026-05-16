import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  derivePanel,
  derivePanelVerb,
  globToRegex,
  loadSpec,
  matchPath,
  parsePrecedence,
  parseRules,
  type Spec,
} from './derive-panel.ts';
import type { GuildCliContext } from './index.ts';

function loadRealSpec(): Spec {
  return loadSpec(process.cwd()).spec;
}

function run(args: string[], stdin?: string) {
  const ctx: GuildCliContext = { cwd: process.cwd(), stdin: stdin ?? '' };
  return derivePanelVerb(args, ctx);
}

// ---- Pure-function unit tests on the parsed spec ----

describe('derivePanel (live spec)', () => {
  const spec = loadRealSpec();

  test('empty file list → contract-fit only', () => {
    expect(derivePanel([], spec)).toEqual(['evaluator-contract-fit']);
  });

  test('single .tsx → contract-fit + a11y + nextjs + react-api + naming', () => {
    expect(derivePanel(['components/Foo.tsx'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-naming',
    ]);
  });

  test('single .jsx → same panel as .tsx', () => {
    expect(derivePanel(['legacy/Foo.jsx'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-naming',
    ]);
  });

  test('single .module.css → contract-fit + tokens + naming', () => {
    expect(derivePanel(['components/Foo.module.css'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-tokens',
      'evaluator-naming',
    ]);
  });

  test('single .css (non-module) → contract-fit + tokens', () => {
    expect(derivePanel(['styles/globals.css'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-tokens',
    ]);
  });

  test('single .ts (non-JSX) → contract-fit + react-api + naming', () => {
    expect(derivePanel(['lib/util.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-react-api',
      'evaluator-naming',
    ]);
  });

  test('single .md (prose) → contract-fit only', () => {
    expect(derivePanel(['README.md'], spec)).toEqual(['evaluator-contract-fit']);
  });

  test('single .json → contract-fit only', () => {
    expect(derivePanel(['package.json'], spec)).toEqual(['evaluator-contract-fit']);
  });

  test('substrate doc (.claude/agents/*.md) → contract-fit only', () => {
    expect(derivePanel(['.claude/agents/evaluator-foo.md'], spec)).toEqual([
      'evaluator-contract-fit',
    ]);
  });

  test('substrate skill (.claude/skills/foo/SKILL.md) → contract-fit only', () => {
    expect(derivePanel(['.claude/skills/foo/SKILL.md'], spec)).toEqual([
      'evaluator-contract-fit',
    ]);
  });

  test('checkin file under projects/ → contract-fit only', () => {
    expect(
      derivePanel(['projects/2026-05-02-agent-guilds/checkins/ev.foo/01.md'], spec),
    ).toEqual(['evaluator-contract-fit']);
  });

  test('substrate script (.claude/scripts/foo/bar.ts) → contract-fit + naming', () => {
    expect(derivePanel(['.claude/scripts/foo/bar.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-naming',
    ]);
  });

  test('substrate test (.claude/scripts/foo/bar.test.ts) → contract-fit + test-unit', () => {
    expect(derivePanel(['.claude/scripts/foo/bar.test.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-test-unit',
    ]);
  });

  test('substrate CLI test (.claude/cli/foo/bar.test.ts) → contract-fit + test-unit', () => {
    expect(derivePanel(['.claude/cli/foo/bar.test.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-test-unit',
    ]);
  });

  test('general unit test (scripts/check-nextjs.test.ts) → contract-fit + test-unit', () => {
    expect(derivePanel(['scripts/check-nextjs.test.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-test-unit',
    ]);
  });

  test('general spec file (utilities/foo.spec.ts) → contract-fit + test-unit', () => {
    expect(derivePanel(['utilities/foo.spec.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-test-unit',
    ]);
  });

  test('integration spec (tests/e2e/index.spec.ts) → contract-fit + test-integration', () => {
    expect(derivePanel(['tests/e2e/index.spec.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-test-integration',
    ]);
  });

  test('a11y e2e spec (tests/e2e/a11y/home.spec.ts) → contract-fit + a11y (overrides test-integration)', () => {
    expect(derivePanel(['tests/e2e/a11y/home.spec.ts'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
    ]);
  });

  test('multi-file union (.tsx + .module.css) → all five domain lenses + contract-fit', () => {
    expect(
      derivePanel(['components/Foo.tsx', 'components/Foo.module.css'], spec),
    ).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-tokens',
      'evaluator-naming',
    ]);
  });

  test('sketch file (sketches/53-foo.tsx) → same as plain .tsx', () => {
    expect(derivePanel(['sketches/53-foo.tsx'], spec)).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-naming',
    ]);
  });

  test('duplicates deduped across multiple .tsx files', () => {
    expect(
      derivePanel(
        ['app/page.tsx', 'app/about/page.tsx', 'components/Foo.tsx'],
        spec,
      ),
    ).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-react-api',
      'evaluator-naming',
    ]);
  });
});

// ---- globToRegex ----

describe('globToRegex', () => {
  test('*.tsx matches plain and nested .tsx files', () => {
    const re = globToRegex('*.tsx');
    expect(re.test('Foo.tsx')).toBe(true);
    expect(re.test('Foo.ts')).toBe(false);
  });

  test('** matches any path segments', () => {
    const re = globToRegex('.claude/scripts/**/*.ts');
    expect(re.test('.claude/scripts/guild/derive-panel.ts')).toBe(true);
    expect(re.test('.claude/scripts/griot/capture.ts')).toBe(true);
    expect(re.test('app/foo/bar.ts')).toBe(false);
  });

  test('* does not cross directory boundaries', () => {
    const re = globToRegex('.claude/agents/*.md');
    expect(re.test('.claude/agents/foo.md')).toBe(true);
    expect(re.test('.claude/agents/sub/foo.md')).toBe(false);
  });

  test('escapes regex metacharacters', () => {
    const re = globToRegex('package.json');
    expect(re.test('package.json')).toBe(true);
    expect(re.test('packageXjson')).toBe(false);
  });
});

// ---- Verb tests ----

describe('derivePanelVerb', () => {
  test('--files= with single .tsx', () => {
    const res = run(['--files=components/Foo.tsx']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe(
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-naming',
    );
  });

  test('--files= with comma-separated multi-file union', () => {
    const res = run(['--files=Foo.tsx,Foo.module.css']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe(
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming',
    );
  });

  test('stdin variant (newline-delimited paths)', () => {
    const res = run([], 'components/Foo.tsx\ncomponents/Foo.module.css\n');
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe(
      'evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming',
    );
  });

  test('stdin variant with empty input → baseline only', () => {
    const res = run([], '');
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('evaluator-contract-fit');
  });

  test('--files= with no files → baseline only', () => {
    const res = run(['--files=']);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('evaluator-contract-fit');
  });
});

// ---- Defensive fallback ----

describe('loadSpec fallback', () => {
  test('returns valid spec from synthetic repo missing the file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'derive-panel-fallback-'));
    try {
      const { spec, warning } = loadSpec(tmp);
      expect(spec.rules.length).toBeGreaterThan(0);
      expect(spec.precedence.length).toBe(8);
      expect(spec.precedence[0]).toBe('evaluator-contract-fit');
      expect(warning).toMatch(/panel-spec-unreadable/);
      expect(derivePanel(['components/Foo.tsx'], spec)).toEqual([
        'evaluator-contract-fit',
        'evaluator-a11y',
        'evaluator-nextjs',
        'evaluator-react-api',
        'evaluator-naming',
      ]);
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
        '# nothing useful\n\nno sections.\n',
      );
      const { spec, warning } = loadSpec(tmp);
      expect(spec.rules.length).toBeGreaterThan(0);
      expect(warning).toMatch(/mapping-section-missing/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('verb surfaces fallback warning on stderr without affecting exit code', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'derive-panel-verb-fallback-'));
    try {
      const ctx: GuildCliContext = { cwd: tmp, stdin: '' };
      const res = derivePanelVerb(['--files=Foo.tsx'], ctx);
      expect(res.exitCode).toBe(0);
      expect(res.stderr).toMatch(/derive-panel-error: panel-spec-unreadable/);
      expect(res.stdout).toContain('evaluator-contract-fit');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---- Spec parsing matches verb output ----

describe('spec parsing', () => {
  test('parseRules + parsePrecedence on live spec parse non-empty', () => {
    const spec = loadRealSpec();
    expect(spec.rules.length).toBeGreaterThanOrEqual(6);
    expect(spec.precedence).toEqual([
      'evaluator-contract-fit',
      'evaluator-a11y',
      'evaluator-nextjs',
      'evaluator-css-architecture',
      'evaluator-react-api',
      'evaluator-test-integration',
      'evaluator-test-unit',
      'evaluator-tokens',
      'evaluator-naming',
    ]);
  });

  test('matchPath uses most-specific-wins (substrate script over generic .ts)', () => {
    const spec = loadRealSpec();
    const matched = matchPath('.claude/scripts/foo/bar.ts', spec.rules);
    expect(matched).not.toContain('evaluator-react-api');
    expect(matched).toContain('evaluator-naming');
  });

  test('parseRules is callable directly on a synthetic spec', () => {
    const synthetic = [
      '# Panel composition',
      '',
      '## File-type → evaluator mapping',
      '',
      '| File pattern | Evaluators added |',
      '|--------------|------------------|',
      '| `*.ts` | `evaluator-naming` |',
      '',
      '## Precedence',
      '',
      '1. **`evaluator-contract-fit`** — baseline',
      '2. **`evaluator-naming`** — readability',
    ].join('\n');
    expect(parseRules(synthetic)).toHaveLength(1);
    expect(parsePrecedence(synthetic)).toEqual([
      'evaluator-contract-fit',
      'evaluator-naming',
    ]);
  });
});
