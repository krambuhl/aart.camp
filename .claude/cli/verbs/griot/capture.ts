import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { DispatchResult, GriotCliContext } from './index.ts';

type Checkin = {
  unit: string;
  contract: string;
  execution: string;
  notesForPR: string;
  changesSincePrev: string;
  evaluatorVerdict: string;
  fullContent: string;
};

const ARG_HINT = [
  '  capture --from-checkin=<path> [--slug=<slug>] [--correction-text=<text>]',
  '  capture --evaluator-finding=<classification> --evaluator-name=<name> --code=<code> --evidence=<text>',
  '          [--slug=<slug>] [--file-line=<path:line>] [--frequency-count=<N>]',
  '          classifications: recurring | generator-antipattern | catalog-gap | evaluator-conflict | sanctioned-exception',
  '          (recurring requires --frequency-count; catalog-gap | evaluator-conflict | sanctioned-exception are not-yet-supported)',
].join('\n');

const VALID_CLASSIFICATIONS = [
  'recurring',
  'generator-antipattern',
  'catalog-gap',
  'evaluator-conflict',
  'sanctioned-exception',
] as const;
type Classification = (typeof VALID_CLASSIFICATIONS)[number];
const IMPLEMENTED_CLASSIFICATIONS: ReadonlySet<Classification> = new Set([
  'recurring',
  'generator-antipattern',
]);
const NOT_YET_SUPPORTED: ReadonlySet<Classification> = new Set([
  'catalog-gap',
  'evaluator-conflict',
  'sanctioned-exception',
]);

class CaptureError extends Error {}

function fail(reason: string): DispatchResult {
  return {
    stderr: `capture-error: ${reason}`,
    exitCode: 1,
  };
}

function failWithHint(reason: string): DispatchResult {
  return {
    stderr: `capture-error: ${reason}\nusage:\n${ARG_HINT}`,
    exitCode: 1,
  };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function selectCorrection(
  corrections: string[],
  requestedText: string | undefined,
): string {
  if (requestedText === undefined) {
    if (corrections.length === 1) return corrections[0];
    const preview = corrections
      .map((c) => c.slice(0, 60))
      .map((p) => `"${p}${p.length === 60 ? '…' : ''}"`)
      .join(', ');
    throw new CaptureError(
      `ambiguous: checkin has ${corrections.length} correction lines; pass --correction-text=<one of: ${preview}>`,
    );
  }
  const requested = normalizeWhitespace(requestedText);
  const match = corrections.find((c) => normalizeWhitespace(c) === requested);
  if (match !== undefined) return match;
  const available = corrections
    .map((c) => c.slice(0, 30))
    .map((p) => `"${p}${p.length === 30 ? '…' : ''}"`)
    .join(', ');
  throw new CaptureError(
    `correction text not found in checkin; available: ${available}`,
  );
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
}

function kebabize(s: string, maxTokens = 5): string {
  const tokens = s
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((t) => t.length > 0);
  return tokens.slice(0, maxTokens).join('-');
}

function extractSection(content: string, header: string | RegExp): string {
  const headerStr = typeof header === 'string' ? header : header.source;
  const headerRe =
    typeof header === 'string'
      ? new RegExp(
          `^## ${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
          'm',
        )
      : new RegExp(`^## ${headerStr}\\s*$`, 'm');
  const match = content.match(headerRe);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextSection = rest.search(/^## /m);
  const body = nextSection === -1 ? rest : rest.slice(0, nextSection);
  return body.trim();
}

function parseCheckin(content: string): Checkin {
  const unit = (content.match(/^\*\*Unit\*\*: (.+)$/m)?.[1] ?? '').trim();
  return {
    unit,
    contract: extractSection(content, 'Contract'),
    execution: extractSection(content, 'Execution'),
    notesForPR: extractSection(content, /Notes for (?:the )?PR/),
    changesSincePrev: extractSection(content, 'Changes since previous checkin'),
    evaluatorVerdict: extractSection(content, 'Evaluator verdict'),
    fullContent: content,
  };
}

function extractCorrections(notesForPR: string): string[] {
  const lines = notesForPR.split('\n');
  const corrections: string[] = [];
  let current: string | null = null;
  for (const line of lines) {
    const start = line.match(/^[-*]?\s*correction:\s*(.+)$/);
    if (start) {
      if (current !== null) corrections.push(current.trim());
      current = start[1];
      continue;
    }
    if (current !== null) {
      if (line.match(/^[-*]\s+/) || line.trim() === '') {
        corrections.push(current.trim());
        current = null;
      } else {
        current += ` ${line.trim()}`;
      }
    }
  }
  if (current !== null) corrections.push(current.trim());
  return corrections;
}

function buildPromptMd(unit: string, contract: string): string {
  const goalMatch = contract.match(
    /\*\*Goal\*\*:?\s*([\s\S]+?)(?=\n\s*\*\*[A-Za-z]|\n##|$)/,
  );
  const goal = goalMatch?.[1].trim() ?? '';
  const acMatch = contract.match(
    /\*\*Acceptance criteria\*\*:?\s*([\s\S]+?)(?=\n\s*\*\*[A-Za-z]|\n##|$)/,
  );
  const ac = acMatch?.[1].trim() ?? '';
  const sections = [
    `# Triggering prompt (distilled)`,
    ``,
    `## Unit`,
    ``,
    unit || '_(no unit recorded)_',
  ];
  if (goal) sections.push(``, `## Goal`, ``, goal);
  if (ac) sections.push(``, `## Acceptance criteria`, ``, ac);
  return `${sections.join('\n')}\n`;
}

function buildWrongMd(
  execution: string,
  changesSincePrev: string,
  evaluatorVerdict: string,
): string {
  if (execution) return `# What Claude produced\n\n${execution}\n`;
  if (changesSincePrev || evaluatorVerdict) {
    const parts = [
      `# What Claude produced`,
      ``,
      `_Execution section was empty; reconstructed from Changes / Verdict._`,
    ];
    if (changesSincePrev)
      parts.push(``, `## Changes since previous checkin`, ``, changesSincePrev);
    if (evaluatorVerdict)
      parts.push(``, `## Evaluator verdict`, ``, evaluatorVerdict);
    return `${parts.join('\n')}\n`;
  }
  return `# What Claude produced\n\n_No execution content recorded in checkin._\n`;
}

function buildCorrectionMd(correction: string): string {
  return `correction: ${correction}\n`;
}

function buildLearningMd(correction: string, checkinPath: string): string {
  return `# Learning draft

${correction}

_Draft auto-generated from \`${checkinPath}\` § Notes for the PR. The compaction pipeline (\`/griot-compact\`) will refine this draft if the judges don't accept it as-is._
`;
}

type StateJson = {
  classification: Classification | 'unclassified';
  evaluator: string | null;
  code: string | null;
  'frequency-count': number | null;
  'file-line': string | null;
  status: 'captured' | 'archived' | 'escalated';
  promoted_as: string | null;
};

function buildStateJsonForCheckin(): string {
  const state: StateJson = {
    classification: 'unclassified',
    evaluator: null,
    code: null,
    'frequency-count': null,
    'file-line': null,
    status: 'captured',
    promoted_as: null,
  };
  return `${JSON.stringify(state, null, 2)}\n`;
}

function buildStateJsonForEvaluatorFinding(args: EvaluatorFindingArgs): string {
  const state: StateJson = {
    classification: args.classification,
    evaluator: args.evaluatorName,
    code: args.code,
    'frequency-count': args.frequencyCount ?? null,
    'file-line': args.fileLine ?? null,
    status: 'captured',
    promoted_as: null,
  };
  return `${JSON.stringify(state, null, 2)}\n`;
}

type EvaluatorFindingArgs = {
  classification: Classification;
  evaluatorName: string;
  code: string;
  evidence: string;
  fileLine: string | undefined;
  frequencyCount: number | undefined;
};

function buildEvaluatorFindingLearningMd(args: EvaluatorFindingArgs): string {
  const heading = '# Learning draft';
  const bodyKind =
    args.classification === 'recurring'
      ? `**Recurring evaluator finding** — \`${args.evaluatorName}\` flagged \`${args.code}\`${
          args.frequencyCount !== undefined
            ? ` on ${args.frequencyCount} occurrences`
            : ''
        }.\n\nEvidence: ${args.evidence}${
          args.fileLine !== undefined ? `\n\nSource: \`${args.fileLine}\`` : ''
        }\n\nThis pattern recurs in this project; future work in the same domain should avoid it.`
      : `**Generator antipattern** — output flagged by \`${args.evaluatorName}\` as \`${args.code}\`.\n\nEvidence: ${args.evidence}${
          args.fileLine !== undefined ? `\n\nSource: \`${args.fileLine}\`` : ''
        }\n\nThis is a recurring shape in generator output for this project; future generator invocations in this domain should avoid it.`;

  const provenance = `\n\n_Draft auto-generated from an evaluator finding via \`capture --evaluator-finding=${args.classification}\`. Routing metadata lives in \`state.json\`; the compaction pipeline (\`/griot-compact\`) reads it to route classification-aware promotion._`;

  return `${[heading, '', bodyKind, provenance].join('\n')}\n`;
}

function buildEvaluatorFindingPromptMd(args: EvaluatorFindingArgs): string {
  return `${[
    `# Triggering finding`,
    ``,
    `## Source`,
    ``,
    `Evaluator: \`${args.evaluatorName}\``,
    `Code: \`${args.code}\``,
    `Classification: \`${args.classification}\``,
    args.frequencyCount !== undefined
      ? `Frequency count at capture: ${args.frequencyCount}`
      : '',
    args.fileLine !== undefined ? `File:line: \`${args.fileLine}\`` : '',
    ``,
    `## Evidence`,
    ``,
    args.evidence,
  ]
    .filter((line) => line !== '')
    .join('\n')}\n`;
}

function buildEvaluatorFindingWrongMd(args: EvaluatorFindingArgs): string {
  // No "wrong Claude output" exists for an evaluator-finding capture —
  // the finding IS the input, not a Claude response.
  return `${[
    `# Flagged output`,
    ``,
    `_This session-note was captured from a \`${args.classification}\` evaluator finding via_`,
    `_\`capture --evaluator-finding=...\`. There is no "wrong Claude output" to point at —_`,
    `_the evaluator's flag itself is the captured signal._`,
    ``,
    `Evaluator: \`${args.evaluatorName}\``,
    `Code: \`${args.code}\``,
    `Evidence: ${args.evidence}`,
  ].join('\n')}\n`;
}

function buildEvaluatorFindingCorrectionMd(args: EvaluatorFindingArgs): string {
  return `correction: avoid \`${args.code}\` (flagged by \`${args.evaluatorName}\`): ${args.evidence}\n`;
}

function buildEvaluatorFindingTranscriptMd(args: EvaluatorFindingArgs): string {
  return `${JSON.stringify(
    {
      kind: 'evaluator-finding',
      classification: args.classification,
      evaluator: args.evaluatorName,
      code: args.code,
      evidence: args.evidence,
      fileLine: args.fileLine ?? null,
      frequencyCount: args.frequencyCount ?? null,
    },
    null,
    2,
  )}\n`;
}

function captureFromEvaluatorFinding(
  values: Record<string, string | undefined>,
  sessionNotesRoot: string,
): DispatchResult {
  const classificationRaw = values['evaluator-finding'];
  if (!classificationRaw) return fail('--evaluator-finding=<classification> is required');
  if (!(VALID_CLASSIFICATIONS as readonly string[]).includes(classificationRaw)) {
    return fail(
      `unknown classification '${classificationRaw}'; valid: ${VALID_CLASSIFICATIONS.join(', ')}`,
    );
  }
  const classification = classificationRaw as Classification;

  if (NOT_YET_SUPPORTED.has(classification)) {
    return fail(`not-yet-supported: ${classification}`);
  }
  if (!IMPLEMENTED_CLASSIFICATIONS.has(classification)) {
    return fail(`classification not implemented: ${classification}`);
  }

  const evaluatorName = values['evaluator-name'];
  const code = values.code;
  const evidence = values.evidence;
  if (!evaluatorName)
    return fail('--evaluator-name=<name> is required with --evaluator-finding');
  if (code === undefined)
    return fail('--code=<code> is required with --evaluator-finding');
  if (evidence === undefined)
    return fail('--evidence=<text> is required with --evaluator-finding');

  const fileLine = values['file-line'];
  const frequencyCountRaw = values['frequency-count'];
  let frequencyCount: number | undefined;
  if (frequencyCountRaw !== undefined) {
    const n = Number.parseInt(frequencyCountRaw, 10);
    if (!Number.isFinite(n) || n < 1)
      return fail('--frequency-count must be a positive integer');
    frequencyCount = n;
  }
  if (classification === 'recurring' && frequencyCount === undefined) {
    return fail(
      '--frequency-count=<N> is required when --evaluator-finding=recurring',
    );
  }

  const explicitSlug = values.slug;
  const slug =
    explicitSlug ?? kebabize(`${classification}-${evaluatorName}-${code}`);
  if (!slug) return fail('could not derive slug; pass --slug explicitly');

  const ts = timestamp();
  const folderName = `${ts}-${slug}`;
  const folderPath = join(sessionNotesRoot, folderName);
  if (existsSync(folderPath)) {
    return fail(`folder already exists: ${folderPath}`);
  }

  const args: EvaluatorFindingArgs = {
    classification,
    evaluatorName,
    code,
    evidence,
    fileLine,
    frequencyCount,
  };

  mkdirSync(folderPath, { recursive: true });
  writeFileSync(join(folderPath, 'state.json'), buildStateJsonForEvaluatorFinding(args));
  writeFileSync(join(folderPath, 'prompt.md'), buildEvaluatorFindingPromptMd(args));
  writeFileSync(join(folderPath, 'wrong.md'), buildEvaluatorFindingWrongMd(args));
  writeFileSync(
    join(folderPath, 'correction.md'),
    buildEvaluatorFindingCorrectionMd(args),
  );
  writeFileSync(
    join(folderPath, 'full_transcript.md'),
    buildEvaluatorFindingTranscriptMd(args),
  );
  writeFileSync(join(folderPath, 'learning.md'), buildEvaluatorFindingLearningMd(args));

  return {
    stdout: `captured: learnings/session-notes/${folderName}/ from --evaluator-finding=${classification}`,
    exitCode: 0,
  };
}

export function captureVerb(rest: string[], ctx: GriotCliContext): DispatchResult {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        'from-checkin': { type: 'string' },
        slug: { type: 'string' },
        'correction-text': { type: 'string' },
        'evaluator-finding': { type: 'string' },
        'evaluator-name': { type: 'string' },
        code: { type: 'string' },
        evidence: { type: 'string' },
        'file-line': { type: 'string' },
        'frequency-count': { type: 'string' },
      },
      allowPositionals: false,
      args: rest,
    });
  } catch (err) {
    return fail(`argument parse failure: ${(err as Error).message}`);
  }
  const { values } = parsed;
  const sessionNotesRoot = resolve(ctx.cwd, 'learnings/session-notes');

  const hasFinding = values['evaluator-finding'] !== undefined;
  const hasCheckin = values['from-checkin'] !== undefined;
  if (hasFinding && hasCheckin) {
    return fail('--evaluator-finding and --from-checkin are mutually exclusive');
  }
  if (hasFinding) {
    return captureFromEvaluatorFinding(
      values as Record<string, string | undefined>,
      sessionNotesRoot,
    );
  }

  const checkinPath = values['from-checkin'] as string | undefined;
  if (!checkinPath) {
    return failWithHint('--from-checkin=<path> is required');
  }

  const resolvedCheckin = resolve(ctx.cwd, checkinPath);
  if (!existsSync(resolvedCheckin)) return fail(`checkin not found: ${checkinPath}`);

  const content = readFileSync(resolvedCheckin, 'utf-8');
  const checkin = parseCheckin(content);
  const corrections = extractCorrections(checkin.notesForPR);
  if (corrections.length === 0) {
    return fail(`no correction: lines found in ${checkinPath}`);
  }

  const requestedText = values['correction-text'] as string | undefined;
  let correction: string;
  try {
    correction = selectCorrection(corrections, requestedText);
  } catch (err) {
    if (err instanceof CaptureError) return fail(err.message);
    throw err;
  }

  const explicitSlug = values.slug as string | undefined;
  const slug = explicitSlug ?? kebabize(checkin.unit);
  if (!slug)
    return fail('could not derive slug from checkin Unit; pass --slug explicitly');

  const ts = timestamp();
  const folderName = `${ts}-${slug}`;
  const folderPath = join(sessionNotesRoot, folderName);
  if (existsSync(folderPath)) {
    return fail(`folder already exists: ${folderPath}`);
  }

  mkdirSync(folderPath, { recursive: true });
  writeFileSync(join(folderPath, 'state.json'), buildStateJsonForCheckin());
  writeFileSync(
    join(folderPath, 'prompt.md'),
    buildPromptMd(checkin.unit, checkin.contract),
  );
  writeFileSync(
    join(folderPath, 'wrong.md'),
    buildWrongMd(checkin.execution, checkin.changesSincePrev, checkin.evaluatorVerdict),
  );
  writeFileSync(join(folderPath, 'correction.md'), buildCorrectionMd(correction));
  writeFileSync(join(folderPath, 'full_transcript.md'), checkin.fullContent);
  writeFileSync(
    join(folderPath, 'learning.md'),
    buildLearningMd(correction, checkinPath),
  );

  return {
    stdout: `captured: learnings/session-notes/${folderName}/ from ${checkinPath}`,
    exitCode: 0,
  };
}
