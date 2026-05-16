import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DispatchResult, GuildCliContext } from './index.ts';

// derive-panel — read a list of file paths and emit the comma-separated
// agent list a /guild-validate panel should spawn for them.
//
// Source of truth for both the file-type → evaluator mapping and the
// precedence ordering is `.claude/agents/PANEL-COMPOSITION.md`. The
// verb parses it at runtime (per L-006: no parallel TS const, no
// drift-test). If the spec file is missing or unreadable, the
// hardcoded fallback below kicks in. The fallback is a defensive
// backup, NOT a second source of truth — when the two disagree,
// PANEL-COMPOSITION.md wins by design.

const SPEC_PATH = '.claude/agents/PANEL-COMPOSITION.md';
const BASELINE = 'evaluator-contract-fit';

type Rule = {
  patterns: { regex: RegExp; raw: string }[];
  evaluators: string[];
};

class DerivePanelError extends Error {}

// Convert a glob-ish pattern from the spec table into a regex.
// See legacy script header for full spec.
export function globToRegex(glob: string): RegExp {
  const trimmed = glob.trim().replace(/^`|`$/g, '');
  const hasSlash = trimmed.includes('/');
  let re = hasSlash ? '^' : '(?:^|/)';
  let i = 0;
  while (i < trimmed.length) {
    const c = trimmed[i];
    if (c === '*' && trimmed[i + 1] === '*') {
      re += '.*';
      i += 2;
    } else if (c === '*') {
      re += '[^/]*';
      i += 1;
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      re += `\\${c}`;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  re += '$';
  return new RegExp(re);
}

export function specificity(pattern: string): number {
  const literal = pattern.replace(/\*+/g, '').length;
  const slashes = (pattern.match(/\//g) ?? []).length;
  return literal * 10 + slashes;
}

export function parseRules(markdown: string): Rule[] {
  const tableStart = markdown.indexOf('## File-type → evaluator mapping');
  if (tableStart < 0) {
    throw new DerivePanelError('mapping-section-missing');
  }
  const tableSlice = markdown.slice(tableStart);
  const sectionEnd = tableSlice.indexOf('\n## ', 1);
  const tableBody = sectionEnd > 0 ? tableSlice.slice(0, sectionEnd) : tableSlice;
  const lines = tableBody.split('\n');
  const rules: Rule[] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('|---') || line.match(/^\|\s*-+/)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [patternCell, evaluatorCell] = cells;

    if (patternCell.toLowerCase().startsWith('file pattern')) continue;
    if (patternCell.includes('(any file)')) continue;
    if (!patternCell.includes('`')) continue;
    if (patternCell.toLowerCase().includes('files under')) continue;
    if (patternCell.toLowerCase().includes('same mapping')) continue;

    const patterns: { regex: RegExp; raw: string }[] = [];
    const patternMatches = patternCell.matchAll(/`([^`]+)`/g);
    for (const match of patternMatches) {
      const raw = match[1];
      if (raw.startsWith('(') && raw.endsWith(')')) continue;
      patterns.push({ regex: globToRegex(raw), raw });
    }
    if (patterns.length === 0) continue;

    const evaluators: string[] = [];
    const evaluatorMatches = evaluatorCell.matchAll(/`(evaluator-[\w-]+)`/g);
    for (const match of evaluatorMatches) {
      evaluators.push(match[1]);
    }

    rules.push({ patterns, evaluators });
  }
  if (rules.length === 0) {
    throw new DerivePanelError('no-rules-parsed');
  }
  return rules;
}

export function parsePrecedence(markdown: string): string[] {
  const section = markdown.indexOf('## Precedence');
  if (section < 0) {
    throw new DerivePanelError('precedence-section-missing');
  }
  const sectionSlice = markdown.slice(section);
  const nextHeading = sectionSlice.indexOf('\n## ', 1);
  const body = nextHeading > 0 ? sectionSlice.slice(0, nextHeading) : sectionSlice;
  const order: string[] = [];
  const matches = body.matchAll(/^\d+\.\s+\*\*`(evaluator-[\w-]+)`\*\*/gm);
  for (const m of matches) {
    order.push(m[1]);
  }
  if (order.length === 0) {
    throw new DerivePanelError('precedence-empty');
  }
  return order;
}

function fallbackRule(raws: string[], evaluators: string[]): Rule {
  return {
    patterns: raws.map((raw) => ({ regex: globToRegex(raw), raw })),
    evaluators,
  };
}

const FALLBACK_RULES: Rule[] = [
  fallbackRule(['*.tsx', '*.jsx'], ['evaluator-react-api', 'evaluator-naming', 'evaluator-a11y', 'evaluator-nextjs']),
  fallbackRule(['*.ts'], ['evaluator-react-api', 'evaluator-naming']),
  fallbackRule(['*.module.css'], ['evaluator-tokens', 'evaluator-naming']),
  fallbackRule(['*.css'], ['evaluator-tokens']),
  fallbackRule(['*.md'], []),
  fallbackRule(['*.json'], []),
  fallbackRule(
    [
      '.claude/agents/*.md',
      '.claude/skills/*/SKILL.md',
      '.claude/skills/**/*.md',
      'projects/**/checkins/**/*.md',
    ],
    [],
  ),
  fallbackRule(['.claude/scripts/**/*.ts'], ['evaluator-naming']),
  fallbackRule(['.claude/scripts/**/*.test.ts'], ['evaluator-test-unit']),
  fallbackRule(['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'], ['evaluator-test-unit']),
  fallbackRule(['tests/e2e/**', 'tests/integration/**', 'e2e/**'], ['evaluator-test-integration']),
  fallbackRule(['tests/e2e/a11y/**'], ['evaluator-a11y']),
];

const FALLBACK_PRECEDENCE = [
  'evaluator-contract-fit',
  'evaluator-a11y',
  'evaluator-nextjs',
  'evaluator-react-api',
  'evaluator-test-integration',
  'evaluator-test-unit',
  'evaluator-tokens',
  'evaluator-naming',
];

export type Spec = {
  rules: Rule[];
  precedence: string[];
};

export type LoadSpecResult = {
  spec: Spec;
  warning: string | null;
};

export function loadSpec(repoRoot: string = process.cwd()): LoadSpecResult {
  try {
    const path = resolve(repoRoot, SPEC_PATH);
    const markdown = readFileSync(path, 'utf8');
    return {
      spec: {
        rules: parseRules(markdown),
        precedence: parsePrecedence(markdown),
      },
      warning: null,
    };
  } catch (err) {
    const reason = err instanceof DerivePanelError ? err.message : 'panel-spec-unreadable';
    return {
      spec: {
        rules: FALLBACK_RULES,
        precedence: FALLBACK_PRECEDENCE,
      },
      warning: `${reason} (using fallback)`,
    };
  }
}

export function matchPath(path: string, rules: Rule[]): string[] {
  let best: { rule: Rule; score: number; index: number } | null = null;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    for (const pattern of rule.patterns) {
      if (pattern.regex.test(path)) {
        const score = specificity(pattern.raw);
        if (!best || score > best.score || (score === best.score && i > best.index)) {
          best = { rule, score, index: i };
        }
      }
    }
  }
  return best ? best.rule.evaluators : [];
}

export function derivePanel(files: string[], spec: Spec): string[] {
  const set = new Set<string>([BASELINE]);
  for (const file of files) {
    const matched = matchPath(file, spec.rules);
    for (const e of matched) set.add(e);
  }
  const ordered: string[] = [];
  for (const name of spec.precedence) {
    if (set.has(name)) ordered.push(name);
  }
  const stragglers = [...set].filter((n) => !spec.precedence.includes(n)).sort();
  ordered.push(...stragglers);
  return ordered;
}

export function derivePanelVerb(
  rest: string[],
  ctx: GuildCliContext,
): DispatchResult {
  let files: string[] = [];
  const filesArg = rest.find((a) => a.startsWith('--files='));
  if (filesArg) {
    const value = filesArg.slice('--files='.length);
    files = value
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } else if ((ctx.stdin ?? '').length > 0) {
    files = (ctx.stdin ?? '')
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  // Empty input is fine — emit baseline.
  const { spec, warning } = loadSpec(ctx.cwd);
  const panel = derivePanel(files, spec);
  const result: DispatchResult = {
    stdout: panel.join(','),
    exitCode: 0,
  };
  if (warning !== null) {
    result.stderr = `derive-panel-error: ${warning}`;
  }
  return result;
}
