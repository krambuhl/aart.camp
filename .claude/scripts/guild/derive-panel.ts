#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// derive-panel — read a list of file paths and emit the comma-separated
// agent list a /guild-validate panel should spawn for them.
//
// Source of truth for both the file-type → evaluator mapping and the
// precedence ordering is `.claude/agents/PANEL-COMPOSITION.md`. The
// script parses it at runtime (per L-006: no parallel TS const, no
// drift-test). If the spec file is missing or unreadable, the
// hardcoded fallback below kicks in. The fallback is a defensive
// backup, NOT a second source of truth — when the two disagree,
// PANEL-COMPOSITION.md wins by design.
//
// Conditional predicates in the spec (e.g. a11y "when JSX renders
// visible UI", nextjs "when Next-aware") are dropped here per the D7
// contract's option (a): always-on for the listed file types, each
// evaluator's own carve-outs handle contextual suppression. Revisit
// if panel budget becomes a real constraint.

const SPEC_PATH = '.claude/agents/PANEL-COMPOSITION.md';
const BASELINE = 'evaluator-contract-fit';

type Rule = {
  patterns: { regex: RegExp; raw: string }[];
  evaluators: string[];
};

class DerivePanelError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`derive-panel-error: ${reason}\n`);
  process.exit(1);
}

function warn(reason: string): void {
  process.stderr.write(`derive-panel-error: ${reason}\n`);
}

// Convert a glob-ish pattern from the spec table into a regex that
// matches a file path. Supported syntax:
//   *       → any chars except /
//   **      → any chars including /
//   .       → literal .
//   /       → literal /
// Anything else is escaped as a literal.
//
// Anchoring: patterns containing `/` are anchored at the start of the
// path (so `.claude/agents/*.md` matches only at the repo root, not
// arbitrarily deep). Patterns without `/` are basename patterns —
// they match if the FINAL path segment matches (so `*.tsx` matches
// `Foo.tsx` AND `components/Foo.tsx`).
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

// Specificity score for a rule pattern. Higher = more specific.
// Driven by literal-character count (excluding wildcards) with slash
// count as a secondary signal. Frees the spec author from worrying
// about rule order: humans can rearrange the table for readability
// and the script always picks the most-specific match.
export function specificity(pattern: string): number {
  const literal = pattern.replace(/\*+/g, '').length;
  const slashes = (pattern.match(/\//g) ?? []).length;
  return literal * 10 + slashes;
}

// Parse the "File-type → evaluator mapping" table from
// PANEL-COMPOSITION.md. Returns rules in table order. Matching uses
// most-specific-wins (see `matchPath`), so rule order in the spec
// is purely cosmetic — humans can rearrange rows for readability
// without affecting behavior.
export function parseRules(markdown: string): Rule[] {
  const tableStart = markdown.indexOf('## File-type → evaluator mapping');
  if (tableStart < 0) {
    throw new DerivePanelError('mapping-section-missing');
  }
  // Find the table — first markdown table row after the heading.
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

    // Skip header row.
    if (patternCell.toLowerCase().startsWith('file pattern')) continue;

    // Skip the "(any file)" baseline row — contract-fit is added
    // unconditionally by the caller, not via per-file matching.
    if (patternCell.includes('(any file)')) continue;

    // Skip prose-only rows (e.g. "Files under `sketches/`" which
    // redirects to other rules; the redirect is a clarifying note
    // for human readers, not a matching rule).
    if (!patternCell.includes('`')) continue;
    if (patternCell.toLowerCase().includes('files under')) continue;
    if (patternCell.toLowerCase().includes('same mapping')) continue;

    // Extract patterns: backtick-delimited globs separated by commas.
    const patterns: { regex: RegExp; raw: string }[] = [];
    const patternMatches = patternCell.matchAll(/`([^`]+)`/g);
    for (const match of patternMatches) {
      const raw = match[1];
      // Skip prose-y inline code like `(non-JSX)` or `(non-module)`.
      if (raw.startsWith('(') && raw.endsWith(')')) continue;
      patterns.push({ regex: globToRegex(raw), raw });
    }
    if (patterns.length === 0) continue;

    // Extract evaluators: backtick-delimited names starting with
    // `evaluator-`. Strip parenthetical conditionals per option (a).
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

// Parse the precedence section into an ordered list of agent names.
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

// Hardcoded defensive fallback. PANEL-COMPOSITION.md remains the
// source of truth; this is only consulted when the spec file is
// missing or unreadable, and stays in sync via review discipline.
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
  fallbackRule(['.claude/agents/*.md', '.claude/skills/*/SKILL.md', '.claude/skills/**/*.md', 'projects/**/checkins/**/*.md'], []),
  fallbackRule(['.claude/scripts/**/*.ts'], ['evaluator-naming']),
  fallbackRule(['.claude/scripts/**/*.test.ts'], []),
];

const FALLBACK_PRECEDENCE = [
  'evaluator-contract-fit',
  'evaluator-a11y',
  'evaluator-nextjs',
  'evaluator-react-api',
  'evaluator-tokens',
  'evaluator-naming',
];

export type Spec = {
  rules: Rule[];
  precedence: string[];
};

export function loadSpec(repoRoot: string = process.cwd()): Spec {
  try {
    const path = resolve(repoRoot, SPEC_PATH);
    const markdown = readFileSync(path, 'utf8');
    return {
      rules: parseRules(markdown),
      precedence: parsePrecedence(markdown),
    };
  } catch (err) {
    const reason = err instanceof DerivePanelError ? err.message : 'panel-spec-unreadable';
    warn(`${reason} (using fallback)`);
    return {
      rules: FALLBACK_RULES,
      precedence: FALLBACK_PRECEDENCE,
    };
  }
}

// Find the most-specific rule that matches the path. Among matching
// rules, the one whose pattern has the highest specificity score
// wins. Ties are broken by later position in the rule list (which
// usually corresponds to spec table order — a deterministic
// secondary ordering, not a primary signal).
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
  // Sort by precedence; anything not listed in precedence falls to
  // the end alphabetically (deterministic ordering for forward-compat
  // when new evaluators are added before the spec's precedence list
  // is updated).
  const ordered: string[] = [];
  for (const name of spec.precedence) {
    if (set.has(name)) ordered.push(name);
  }
  const stragglers = [...set].filter((n) => !spec.precedence.includes(n)).sort();
  ordered.push(...stragglers);
  return ordered;
}

function readStdin(): Promise<string> {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let files: string[] = [];
  const filesArg = args.find((a) => a.startsWith('--files='));
  if (filesArg) {
    const value = filesArg.slice('--files='.length);
    files = value
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } else if (!process.stdin.isTTY) {
    const stdin = await readStdin();
    files = stdin
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
  // Empty input is fine — emit baseline.
  const spec = loadSpec();
  const panel = derivePanel(files, spec);
  process.stdout.write(`${panel.join(',')}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('derive-panel.ts')) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
