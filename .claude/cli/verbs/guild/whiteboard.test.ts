// Tests for whiteboard verb (sibling per .claude/scripts conventions).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectNextRound, formatRoundBlock, parseState, whiteboardVerb } from './whiteboard.ts';
import type { GuildCliContext } from './index.ts';

function run(args: string[], cwd: string, stdin?: string) {
  const ctx: GuildCliContext = { cwd, stdin: stdin ?? '' };
  return whiteboardVerb(args, ctx);
}

describe('parseState (unit)', () => {
  it('returns no rounds for an empty string', () => {
    expect(parseState('')).toEqual({ rounds: [] });
  });

  it('returns no rounds for a header-only file', () => {
    expect(parseState('# Whiteboard: foo\n')).toEqual({ rounds: [] });
  });

  it('parses a single round with two sections', () => {
    const md = [
      '# Whiteboard: foo',
      '',
      '## Round 1',
      '',
      '### From whiteboard-react-architect',
      '',
      'React take.',
      '',
      '### From whiteboard-design-systems',
      '',
      'DS take.',
      '',
    ].join('\n');
    expect(parseState(md)).toEqual({
      rounds: [
        {
          number: 1,
          sections: [
            { engineer: 'whiteboard-react-architect', section: 'React take.' },
            { engineer: 'whiteboard-design-systems', section: 'DS take.' },
          ],
        },
      ],
    });
  });

  it('parses multi-round content preserving order', () => {
    const md = [
      '# Whiteboard: foo',
      '',
      '## Round 1',
      '',
      '### From whiteboard-a',
      '',
      'Round 1 a.',
      '',
      '## Round 2',
      '',
      '### From whiteboard-a',
      '',
      'Round 2 a.',
      '',
      '### From whiteboard-b',
      '',
      'Round 2 b.',
      '',
    ].join('\n');
    const state = parseState(md);
    expect(state.rounds.map((r) => r.number)).toEqual([1, 2]);
    expect(state.rounds[1].sections.map((s) => s.engineer)).toEqual([
      'whiteboard-a',
      'whiteboard-b',
    ]);
    expect(state.rounds[1].sections[1].section).toBe('Round 2 b.');
  });
});

describe('detectNextRound (unit)', () => {
  it('returns 1 for an empty file', () => {
    expect(detectNextRound('')).toBe(1);
  });

  it('returns 1 for a header-only file', () => {
    expect(detectNextRound('# Whiteboard: foo\n')).toBe(1);
  });

  it('returns 2 after one round', () => {
    const md = '# Whiteboard: foo\n\n## Round 1\n\n### From eng-a\n\nbody\n';
    expect(detectNextRound(md)).toBe(2);
  });

  it('handles non-sequential round numbers (max + 1)', () => {
    const md = '## Round 1\n\n### From a\n\nx\n\n## Round 3\n\n### From a\n\ny\n';
    expect(detectNextRound(md)).toBe(4);
  });
});

describe('formatRoundBlock (unit)', () => {
  it('renders a round with attributed sections', () => {
    const block = formatRoundBlock(2, [
      { engineer: 'whiteboard-a', section: 'a body' },
      { engineer: 'whiteboard-b', section: 'b body' },
    ]);
    expect(block).toContain('## Round 2');
    expect(block).toContain('### From whiteboard-a');
    expect(block).toContain('a body');
    expect(block).toContain('### From whiteboard-b');
    expect(block).toContain('b body');
  });
});

describe('verb: init', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    path = join(dir, 'wb.md');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('creates a new file with the topical header', () => {
    const result = run(['init', path, '--topic=Design Card adaptation'], dir);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(path, 'utf-8')).toBe('# Whiteboard: Design Card adaptation\n');
  });

  it('is idempotent (re-run does not duplicate header)', () => {
    run(['init', path, '--topic=topic one'], dir);
    const before = readFileSync(path, 'utf-8');
    const result = run(['init', path, '--topic=topic two'], dir);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(path, 'utf-8')).toBe(before);
  });

  it('creates parent directories as needed', () => {
    const nested = join(dir, 'sub/nested/wb.md');
    const result = run(['init', nested, '--topic=t'], dir);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(nested, 'utf-8')).toContain('# Whiteboard: t');
  });

  it('errors when --topic is omitted', () => {
    const result = run(['init', path], dir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('guild-whiteboard-error:');
  });
});

describe('verb: detect-round', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    path = join(dir, 'wb.md');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns 1 for a non-existent file', () => {
    const result = run(['detect-round', path], dir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('1');
  });

  it('returns 2 after one round is appended', () => {
    run(['init', path, '--topic=t'], dir);
    run(['append', path], dir, JSON.stringify([{ engineer: 'a', section: 'x' }]));
    const result = run(['detect-round', path], dir);
    expect(result.stdout).toBe('2');
  });
});

describe('verb: append', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    path = join(dir, 'wb.md');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes a Round 1 block with attributed sections', () => {
    run(['init', path, '--topic=t'], dir);
    const input = JSON.stringify([
      { engineer: 'whiteboard-a', section: 'a body' },
      { engineer: 'whiteboard-b', section: 'b body' },
    ]);
    const result = run(['append', path], dir, input);
    expect(result.exitCode).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('## Round 1');
    expect(content).toContain('### From whiteboard-a');
    expect(content).toContain('a body');
    expect(content).toContain('### From whiteboard-b');
    expect(content).toContain('b body');
  });

  it('increments rounds across multiple invocations', () => {
    run(['init', path, '--topic=t'], dir);
    run(['append', path], dir, JSON.stringify([{ engineer: 'a', section: 'r1' }]));
    run(['append', path], dir, JSON.stringify([{ engineer: 'a', section: 'r2' }]));
    const content = readFileSync(path, 'utf-8');
    expect(content).toMatch(/## Round 1/);
    expect(content).toMatch(/## Round 2/);
    const parsed = parseState(content);
    expect(parsed.rounds.map((r) => r.number)).toEqual([1, 2]);
    expect(parsed.rounds[1].sections[0].section).toBe('r2');
  });

  it('returns the locked Result JSON on stdout', () => {
    run(['init', path, '--topic=t'], dir);
    const result = run(
      ['append', path],
      dir,
      JSON.stringify([{ engineer: 'whiteboard-a', section: 'body' }]),
    );
    const parsed = JSON.parse(result.stdout as string);
    expect(parsed).toMatchObject({
      whiteboard_path: path,
      round: 1,
      sections: [{ engineer: 'whiteboard-a', section: 'body' }],
      contradictions: [],
    });
  });

  it('initializes a file when called without prior init', () => {
    const result = run(
      ['append', path],
      dir,
      JSON.stringify([{ engineer: 'a', section: 'x' }]),
    );
    expect(result.exitCode).toBe(0);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('# Whiteboard');
    expect(content).toContain('## Round 1');
  });

  it('errors on empty stdin', () => {
    const result = run(['append', path], dir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('guild-whiteboard-error:');
    expect(result.stderr).toContain('empty input');
  });

  it('errors on unparseable JSON stdin', () => {
    const result = run(['append', path], dir, '{ not json');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('guild-whiteboard-error:');
    expect(result.stderr).toContain('JSON parse error');
  });

  it('errors on missing engineer field', () => {
    const result = run(
      ['append', path],
      dir,
      JSON.stringify([{ section: 'oops' }]),
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('engineer');
  });
});

describe('verb: read-state', () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    path = join(dir, 'wb.md');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns empty rounds for a non-existent file', () => {
    const result = run(['read-state', path], dir);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout as string)).toEqual({ rounds: [] });
  });

  it('returns parsed multi-round state', () => {
    run(['init', path, '--topic=t'], dir);
    run(['append', path], dir, JSON.stringify([{ engineer: 'a', section: 'r1-a' }]));
    run(
      ['append', path],
      dir,
      JSON.stringify([
        { engineer: 'a', section: 'r2-a' },
        { engineer: 'b', section: 'r2-b' },
      ]),
    );
    const result = run(['read-state', path], dir);
    const parsed = JSON.parse(result.stdout as string);
    expect(parsed.rounds).toHaveLength(2);
    expect(parsed.rounds[0]).toMatchObject({
      number: 1,
      sections: [{ engineer: 'a', section: 'r1-a' }],
    });
    expect(parsed.rounds[1].sections.map((s: { engineer: string }) => s.engineer)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('verb: error paths', () => {
  it('errors on unknown verb', () => {
    const dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    try {
      const result = run(['frobnicate', join(dir, 'x')], dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('guild-whiteboard-error: unknown verb');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('errors when path argument is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    try {
      const result = run(['detect-round'], dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('guild-whiteboard-error:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('errors when subverb is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'whiteboard-verb-test-'));
    try {
      const result = run([], dir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('guild-whiteboard-error:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
