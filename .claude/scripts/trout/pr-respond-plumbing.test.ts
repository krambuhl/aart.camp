// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), '.claude/scripts/trout/pr-respond-plumbing.ts');
const SLUG = '2026-01-01-sample';
const BRANCH = 'feat/x';

type RunResult = { stdout: string; stderr: string; status: number };

const NODE_BIN = process.execPath;

function run(args: string[], cwd: string, opts: { gh?: GhScript | null; clearPath?: boolean } = {}): RunResult {
  const env: Record<string, string> = { HOME: process.env.HOME ?? '/tmp' };
  if (opts.clearPath) {
    // Empty PATH so gh lookup fails. Node binary is invoked via absolute path.
    env.PATH = '/nonexistent';
  } else if (opts.gh !== null) {
    const binDir = join(cwd, 'bin');
    mkdirSync(binDir, { recursive: true });
    const ghPath = join(binDir, 'gh');
    writeFileSync(ghPath, opts.gh ?? defaultGh(), 'utf-8');
    chmodSync(ghPath, 0o755);
    // Prepend the stub bin to PATH so the script's `gh` lookup hits the stub first.
    env.PATH = `${binDir}:${process.env.PATH ?? '/usr/bin:/bin'}`;
  }
  try {
    const stdout = execFileSync(NODE_BIN, [SCRIPT, ...args], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env });
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

type GhScript = string;

function ghStub(responses: Record<string, string>, opts: { exitNonZero?: string; exitStderr?: string } = {}): GhScript {
  // Build a bash dispatcher that pattern-matches argv and emits canned JSON.
  // Keys are space-joined argv prefixes (e.g. "pr view 5"); values are JSON strings.
  const cases = Object.entries(responses).map(([key, value]) => {
    const escaped = value.replace(/'/g, `'\\''`);
    return `  if [ "$ARGS" = "${key}" ] || [ "${key}" = "${key}" -a "${'${ARGS#'}${key}${'}'}" != "$ARGS" ]; then printf '%s' '${escaped}'; exit 0; fi`;
  });
  // Simpler approach: exact match on a leading-prefix basis.
  const dispatchLines = Object.entries(responses).map(([key, value]) => {
    const escaped = value.replace(/'/g, `'\\''`);
    return `case "$*" in
  "${key}"*) printf '%s' '${escaped}'; exit 0;;
esac`;
  });
  const exitBlock = opts.exitNonZero
    ? `case "$*" in
  "${opts.exitNonZero}"*) printf '%s\\n' '${(opts.exitStderr ?? 'gh error').replace(/'/g, `'\\''`)}' 1>&2; exit 1;;
esac`
    : '';
  return `#!/bin/bash
${exitBlock}
${dispatchLines.join('\n')}
echo "gh-stub: no canned response for: $*" 1>&2
exit 99
`;
}

function defaultGh(): GhScript {
  return ghStub({
    'repo view --json owner,name': JSON.stringify({ owner: { login: 'krambuhl' }, name: 'aart.camp' }),
    'pr view 5 --json number,url,state,headRefName,title,statusCheckRollup': JSON.stringify({
      number: 5, url: 'https://github.com/krambuhl/aart.camp/pull/5', state: 'OPEN', headRefName: BRANCH, title: 'sample pr',
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'lint', conclusion: 'SUCCESS' },
        { __typename: 'CheckRun', name: 'test', conclusion: 'FAILURE', detailsUrl: 'https://example/test' },
      ],
    }),
    'pr view 5 --json headRefName': JSON.stringify({ headRefName: BRANCH }),
    'api repos/krambuhl/aart.camp/issues/5/comments': JSON.stringify([
      { user: { login: 'alice' }, body: 'first comment', html_url: 'https://example/c1', created_at: '2026-01-01T10:00:00Z' },
      { user: { login: 'bob' }, body: 'second comment', html_url: 'https://example/c2', created_at: '2026-01-01T11:00:00Z' },
    ]),
    'api repos/krambuhl/aart.camp/pulls/5/reviews': JSON.stringify([
      { user: { login: 'carol' }, body: 'looks good with one nit', state: 'CHANGES_REQUESTED', html_url: 'https://example/r1', submitted_at: '2026-01-01T12:00:00Z' },
    ]),
    'api repos/krambuhl/aart.camp/pulls/5/comments': JSON.stringify([
      { user: { login: 'carol' }, body: 'inline note', html_url: 'https://example/rc1', created_at: '2026-01-01T12:05:00Z', path: 'src/x.ts', line: 42 },
    ]),
  });
}

function makeFixture(opts: { existingCheckins?: string[] } = {}): { root: string; projectPath: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'pr-respond-test-'));
  const projectPath = join(root, 'projects', SLUG);
  const branchDir = join(projectPath, 'checkins', BRANCH);
  mkdirSync(branchDir, { recursive: true });
  mkdirSync(join(root, 'projects', 'archive'), { recursive: true });
  for (const name of opts.existingCheckins ?? []) {
    writeFileSync(join(branchDir, name), '# stub\n');
  }
  return {
    root,
    projectPath,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('fetch happy path: items in documented order, next_response_number = 02 with 01.md present', () => {
  const fx = makeFixture({ existingCheckins: ['01.md'] });
  try {
    const result = run(['fetch', SLUG, '5'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.equal(out.pr.number, 5);
    assert.equal(out.pr.branch, BRANCH);
    assert.equal(out.next_response_number, '02');
    assert.equal(out.response_path, `projects/${SLUG}/checkins/${BRANCH}/response-02.md`);
    const kinds = out.items.map((i: { kind: string }) => i.kind);
    // Documented order: issue-comments → reviews → review-comments → ci-failures
    assert.deepEqual(kinds, ['issue-comment', 'issue-comment', 'review', 'review-comment', 'ci-failure']);
    // Issue comments chronological
    assert.equal(out.items[0].source, 'alice');
    assert.equal(out.items[1].source, 'bob');
    // CI failure: only the FAILURE check, not SUCCESS
    assert.equal(out.items[4].location, 'test');
  } finally {
    fx.cleanup();
  }
});

test('fetch empty PR: items: []', () => {
  const fx = makeFixture();
  try {
    const gh = ghStub({
      'repo view --json owner,name': JSON.stringify({ owner: { login: 'krambuhl' }, name: 'aart.camp' }),
      'pr view 7 --json number,url,state,headRefName,title,statusCheckRollup': JSON.stringify({
        number: 7, url: 'https://example/7', state: 'OPEN', headRefName: BRANCH, title: 'empty', statusCheckRollup: [],
      }),
      'api repos/krambuhl/aart.camp/issues/7/comments': '[]',
      'api repos/krambuhl/aart.camp/pulls/7/reviews': '[]',
      'api repos/krambuhl/aart.camp/pulls/7/comments': '[]',
    });
    const result = run(['fetch', SLUG, '7'], fx.root, { gh });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.deepEqual(out.items, []);
    assert.equal(out.next_response_number, '01');
  } finally {
    fx.cleanup();
  }
});

test('fetch error: PR branch has no checkin directory in project (cross-project guard)', () => {
  const fx = makeFixture();
  try {
    const gh = ghStub({
      'repo view --json owner,name': JSON.stringify({ owner: { login: 'krambuhl' }, name: 'aart.camp' }),
      'pr view 9 --json number,url,state,headRefName,title,statusCheckRollup': JSON.stringify({
        number: 9, url: 'https://example/9', state: 'OPEN', headRefName: 'other-project/branch', title: 'cross', statusCheckRollup: [],
      }),
    });
    const result = run(['fetch', SLUG, '9'], fx.root, { gh });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no checkins\/other-project\/branch\/ directory found in project/);
  } finally {
    fx.cleanup();
  }
});

test('fetch error: PR not found in repo (gh exits non-zero)', () => {
  const fx = makeFixture();
  try {
    const gh = ghStub({
      'repo view --json owner,name': JSON.stringify({ owner: { login: 'krambuhl' }, name: 'aart.camp' }),
    }, { exitNonZero: 'pr view 99', exitStderr: 'GraphQL error: Could not resolve to a PullRequest' });
    const result = run(['fetch', SLUG, '99'], fx.root, { gh });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pr-respond-plumbing-error: fetching pr 99:/);
    assert.match(result.stderr, /Could not resolve to a PullRequest/);
  } finally {
    fx.cleanup();
  }
});

test('fetch: next_response_number = 01 when no prior checkins on branch', () => {
  const fx = makeFixture();
  try {
    const result = run(['fetch', SLUG, '5'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).next_response_number, '01');
  } finally {
    fx.cleanup();
  }
});

test('fetch: next_response_number = max(NN.md, response-NN.md) + 1', () => {
  const fx = makeFixture({ existingCheckins: ['01.md', '02.md', 'response-03.md', '05.md'] });
  try {
    const result = run(['fetch', SLUG, '5'], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(JSON.parse(result.stdout).next_response_number, '06');
  } finally {
    fx.cleanup();
  }
});

test('write-plan happy path: writes response-NN.md with content-file content', () => {
  const fx = makeFixture({ existingCheckins: ['01.md'] });
  try {
    const contentFile = join(fx.root, 'plan-draft.md');
    writeFileSync(contentFile, '# PR #5 response plan\n\n## Items\n\n### Item 1\n');
    const result = run(['write-plan', SLUG, '5', `--content-file=${contentFile}`], fx.root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /^response-plan-written: projects\/2026-01-01-sample\/checkins\/feat\/x\/response-02\.md\n$/);
    const written = readFileSync(join(fx.projectPath, 'checkins', BRANCH, 'response-02.md'), 'utf-8');
    assert.equal(written, '# PR #5 response plan\n\n## Items\n\n### Item 1\n');
  } finally {
    fx.cleanup();
  }
});

test('write-plan error: missing --content-file', () => {
  const fx = makeFixture();
  try {
    const result = run(['write-plan', SLUG, '5'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--content-file is required/);
  } finally {
    fx.cleanup();
  }
});

test('write-plan error: --content-file points to non-existent path', () => {
  const fx = makeFixture();
  try {
    const result = run(['write-plan', SLUG, '5', '--content-file=/tmp/does-not-exist-pr-respond.md'], fx.root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /content file not found/);
  } finally {
    fx.cleanup();
  }
});

test('write-plan writes response-NN.md (not NN.md): the response-plan filename pattern is distinct', () => {
  const fx = makeFixture({ existingCheckins: ['01.md'] });
  try {
    const contentFile = join(fx.root, 'plan-draft.md');
    writeFileSync(contentFile, '# plan\n');
    run(['write-plan', SLUG, '5', `--content-file=${contentFile}`], fx.root);
    // response-02.md should exist; 02.md should NOT exist
    assert.ok(existsSync(join(fx.projectPath, 'checkins', BRANCH, 'response-02.md')));
    assert.ok(!existsSync(join(fx.projectPath, 'checkins', BRANCH, '02.md')));
  } finally {
    fx.cleanup();
  }
});

test('error: gh not on PATH', () => {
  const fx = makeFixture();
  try {
    const result = run(['fetch', SLUG, '5'], fx.root, { clearPath: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /gh CLI not found/);
  } finally {
    fx.cleanup();
  }
});

test('ci-failure filtering: SUCCESS and NEUTRAL conclusions are excluded', () => {
  const fx = makeFixture();
  try {
    const gh = ghStub({
      'repo view --json owner,name': JSON.stringify({ owner: { login: 'krambuhl' }, name: 'aart.camp' }),
      'pr view 5 --json number,url,state,headRefName,title,statusCheckRollup': JSON.stringify({
        number: 5, url: 'https://example/5', state: 'OPEN', headRefName: BRANCH, title: 't',
        statusCheckRollup: [
          { name: 'a-passing', conclusion: 'SUCCESS' },
          { name: 'b-failing', conclusion: 'FAILURE' },
          { name: 'c-neutral', conclusion: 'NEUTRAL' },
          { name: 'd-cancelled', conclusion: 'CANCELLED' },
          { name: 'e-timed-out', conclusion: 'TIMED_OUT' },
        ],
      }),
      'api repos/krambuhl/aart.camp/issues/5/comments': '[]',
      'api repos/krambuhl/aart.camp/pulls/5/reviews': '[]',
      'api repos/krambuhl/aart.camp/pulls/5/comments': '[]',
    });
    const result = run(['fetch', SLUG, '5'], fx.root, { gh });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const items = JSON.parse(result.stdout).items as Array<{ kind: string; location: string }>;
    const failures = items.filter((i) => i.kind === 'ci-failure').map((i) => i.location);
    // alphabetical order, only failure-class conclusions
    assert.deepEqual(failures, ['b-failing', 'd-cancelled', 'e-timed-out']);
  } finally {
    fx.cleanup();
  }
});
