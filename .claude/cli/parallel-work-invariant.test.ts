import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Parallel-work invariant registry.
 *
 * Every mutating verb in the four CLI families belongs to exactly one
 * category. See `projects/CONVENTIONS.md` § Parallel-work invariant.
 *
 * Adding a new mutating verb requires:
 *   1. A row in this registry with the chosen category.
 *   2. For category 3 (single-writer-serialized), the `exception`
 *      field must name one of the declared exceptions in
 *      CONVENTIONS.md's `### Declared exceptions` section.
 *
 * The tripwire tests in this file assert the registry is internally
 * consistent and aligned with CONVENTIONS.md.
 */

type Category =
  | 'append-only'
  | 'partitioned'
  | 'single-writer-serialized';

type Exception = 'PLAN.md' | 'manifest.json' | 'whiteboard';

interface VerbEntry {
  verb: string;
  family: 'loom' | 'draft' | 'griot' | 'guild';
  category: Category;
  target: string;
  exception?: Exception;
}

const REGISTRY: readonly VerbEntry[] = [
  // Category 1 — append-only
  {
    verb: 'guild findings append',
    family: 'guild',
    category: 'append-only',
    target: 'projects/<slug>/.guild-findings.jsonl',
  },
  {
    verb: 'loom event append (internal lib)',
    family: 'loom',
    category: 'append-only',
    target: 'projects/<slug>/events.jsonl',
  },
  {
    verb: 'griot operator-checks log-intervention',
    family: 'griot',
    category: 'append-only',
    target: '<operator-log-path>',
  },

  // Category 2 — partitioned
  {
    verb: 'loom checkin write',
    family: 'loom',
    category: 'partitioned',
    target: 'projects/<slug>/checkins/{branch}/{NN}.json',
  },
  {
    verb: 'loom session write',
    family: 'loom',
    category: 'partitioned',
    target: 'projects/<slug>/sessions/{date}-{letter}.json',
  },
  {
    verb: 'loom retro write',
    family: 'loom',
    category: 'partitioned',
    target: 'projects/<slug>/retros/{kind}.json',
  },
  {
    verb: 'loom pr respond',
    family: 'loom',
    category: 'partitioned',
    target: 'projects/<slug>/checkins/{branch}/responses/{id}.md',
  },
  {
    verb: 'griot capture',
    family: 'griot',
    category: 'partitioned',
    target: 'learnings/session-notes/{folder}/',
  },

  // Category 3 — single-writer-serialized (must declare exception)
  {
    verb: 'draft revise',
    family: 'draft',
    category: 'single-writer-serialized',
    target: 'projects/<slug>/PLAN.md',
    exception: 'PLAN.md',
  },
  {
    verb: 'loom phase update',
    family: 'loom',
    category: 'single-writer-serialized',
    target: 'projects/<slug>/manifest.json',
    exception: 'manifest.json',
  },
  {
    verb: 'loom project scaffold (writes manifest)',
    family: 'loom',
    category: 'single-writer-serialized',
    target: 'projects/<slug>/manifest.json',
    exception: 'manifest.json',
  },
  {
    verb: 'guild whiteboard init',
    family: 'guild',
    category: 'single-writer-serialized',
    target: 'projects/<slug>/whiteboards/{name}.md',
    exception: 'whiteboard',
  },
  {
    verb: 'guild whiteboard append',
    family: 'guild',
    category: 'single-writer-serialized',
    target: 'projects/<slug>/whiteboards/{name}.md',
    exception: 'whiteboard',
  },
];

const VALID_CATEGORIES: ReadonlySet<Category> = new Set([
  'append-only',
  'partitioned',
  'single-writer-serialized',
]);

const DECLARED_EXCEPTIONS: ReadonlySet<Exception> = new Set([
  'PLAN.md',
  'manifest.json',
  'whiteboard',
]);

describe('parallel-work invariant: registry well-formedness', () => {
  test('every entry has a valid category', () => {
    for (const entry of REGISTRY) {
      expect(
        VALID_CATEGORIES.has(entry.category),
        `${entry.verb}: category '${entry.category}' is not one of ${[...VALID_CATEGORIES].join(', ')}`,
      ).toBe(true);
    }
  });

  test('every category-3 verb declares a known exception', () => {
    for (const entry of REGISTRY) {
      if (entry.category !== 'single-writer-serialized') continue;
      expect(
        entry.exception,
        `${entry.verb}: category-3 verbs must name an exception (one of: ${[...DECLARED_EXCEPTIONS].join(', ')})`,
      ).toBeDefined();
      expect(
        DECLARED_EXCEPTIONS.has(entry.exception as Exception),
        `${entry.verb}: exception '${entry.exception}' is not in the declared set`,
      ).toBe(true);
    }
  });

  test('non-category-3 verbs do not declare an exception', () => {
    for (const entry of REGISTRY) {
      if (entry.category === 'single-writer-serialized') continue;
      expect(
        entry.exception,
        `${entry.verb}: only category-3 verbs may have an exception; this is category '${entry.category}'`,
      ).toBeUndefined();
    }
  });

  test('every category-2 target includes a partition variable', () => {
    for (const entry of REGISTRY) {
      if (entry.category !== 'partitioned') continue;
      expect(
        /\{[^}]+\}/.test(entry.target),
        `${entry.verb}: partitioned-category target '${entry.target}' must include at least one partition variable in {braces}`,
      ).toBe(true);
    }
  });
});

describe('parallel-work invariant: alignment with CONVENTIONS.md', () => {
  const conventionsPath = join(
    process.cwd(),
    'projects',
    'CONVENTIONS.md',
  );
  const conventionsBody = readFileSync(conventionsPath, 'utf-8');

  test('CONVENTIONS.md exists and contains the three category names', () => {
    for (const category of VALID_CATEGORIES) {
      expect(
        conventionsBody.includes(category),
        `CONVENTIONS.md should mention category '${category}'`,
      ).toBe(true);
    }
  });

  test('CONVENTIONS.md declared-exceptions section names every exception the registry uses', () => {
    const usedExceptions = new Set<Exception>();
    for (const entry of REGISTRY) {
      if (entry.exception) usedExceptions.add(entry.exception);
    }
    for (const exception of usedExceptions) {
      // The doc uses the exception label inside backticks or as a
      // bullet; presence anywhere in the body is sufficient for this
      // tripwire.
      expect(
        conventionsBody.includes(exception),
        `CONVENTIONS.md must name the declared exception '${exception}' (the registry uses it but the doc does not mention it)`,
      ).toBe(true);
    }
  });

  test('CONVENTIONS.md has a "Declared exceptions" section header', () => {
    expect(
      /^###\s+Declared exceptions\b/m.test(conventionsBody),
      'CONVENTIONS.md must have a "### Declared exceptions" subsection under the parallel-work invariant',
    ).toBe(true);
  });
});
