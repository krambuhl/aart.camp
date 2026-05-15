#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Checkin = {
  unit: string;
  contract: string;
  execution: string;
  notesForPR: string;
  changesSincePrev: string;
  evaluatorVerdict: string;
  fullContent: string;
};

const SESSION_NOTES_ROOT = resolve(process.cwd(), 'learnings/session-notes');

const ARG_HINT = [
  '  capture.ts --from-checkin=<path> [--slug=<slug>] [--correction-text=<text>]',
  '  capture.ts --evaluator-finding=<classification> --evaluator-name=<name> --code=<code> --evidence=<text>',
  '             [--slug=<slug>] [--file-line=<path:line>] [--frequency-count=<N>]',
  '             classifications: recurring | generator-antipattern | catalog-gap | evaluator-conflict | sanctioned-exception',
  '             (recurring requires --frequency-count; catalog-gap | evaluator-conflict | sanctioned-exception are not-yet-supported)',
].join('\n');

const VALID_CLASSIFICATIONS = ['recurring', 'generator-antipattern', 'catalog-gap', 'evaluator-conflict', 'sanctioned-exception'] as const;
type Classification = (typeof VALID_CLASSIFICATIONS)[number];
const IMPLEMENTED_CLASSIFICATIONS: ReadonlySet<Classification> = new Set(['recurring', 'generator-antipattern']);
const NOT_YET_SUPPORTED: ReadonlySet<Classification> = new Set(['catalog-gap', 'evaluator-conflict', 'sanctioned-exception']);

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function selectCorrection(corrections: string[], requestedText: string | undefined): string {
  if (requestedText === undefined) {
    if (corrections.length === 1) return corrections[0];
    const preview = corrections.map((c) => c.slice(0, 60)).map((p) => `"${p}${p.length === 60 ? '…' : ''}"`).join(', ');
    throw new CaptureError(`ambiguous: checkin has ${corrections.length} correction lines; pass --correction-text=<one of: ${preview}>`);
  }
  const requested = normalizeWhitespace(requestedText);
  const match = corrections.find((c) => normalizeWhitespace(c) === requested);
  if (match !== undefined) return match;
  const available = corrections.map((c) => c.slice(0, 30)).map((p) => `"${p}${p.length === 30 ? '…' : ''}"`).join(', ');
  throw new CaptureError(`correction text not found in checkin; available: ${available}`);
}

class CaptureError extends Error {}

function fail(reason: string): never {
  process.stderr.write(`capture-error: ${reason}\n`);
  process.exit(1);
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
  const headerRe = typeof header === 'string'
    ? new RegExp(`^## ${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')
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
        current += ' ' + line.trim();
      }
    }
  }
  if (current !== null) corrections.push(current.trim());
  return corrections;
}

function buildPromptMd(unit: string, contract: string): string {
  const goalMatch = contract.match(/\*\*Goal\*\*:?\s*([\s\S]+?)(?=\n\s*\*\*[A-Za-z]|\n##|$)/);
  const goal = goalMatch?.[1].trim() ?? '';
  const acMatch = contract.match(/\*\*Acceptance criteria\*\*:?\s*([\s\S]+?)(?=\n\s*\*\*[A-Za-z]|\n##|$)/);
  const ac = acMatch?.[1].trim() ?? '';
  const sections = [`# Triggering prompt (distilled)`, ``, `## Unit`, ``, unit || '_(no unit recorded)_'];
  if (goal) sections.push(``, `## Goal`, ``, goal);
  if (ac) sections.push(``, `## Acceptance criteria`, ``, ac);
  return sections.join('\n') + '\n';
}

function buildWrongMd(execution: string, changesSincePrev: string, evaluatorVerdict: string): string {
  if (execution) return `# What Claude produced\n\n${execution}\n`;
  if (changesSincePrev || evaluatorVerdict) {
    const parts = [`# What Claude produced`, ``, `_Execution section was empty; reconstructed from Changes / Verdict._`];
    if (changesSincePrev) parts.push(``, `## Changes since previous checkin`, ``, changesSincePrev);
    if (evaluatorVerdict) parts.push(``, `## Evaluator verdict`, ``, evaluatorVerdict);
    return parts.join('\n') + '\n';
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

type EvaluatorFindingArgs = {
  classification: Classification;
  evaluatorName: string;
  code: string;
  evidence: string;
  fileLine: string | undefined;
  frequencyCount: number | undefined;
};

function buildEvaluatorFindingLearningMd(args: EvaluatorFindingArgs): string {
  const frontmatter: string[] = [
    '---',
    `classification: ${args.classification}`,
    `evaluator: ${args.evaluatorName}`,
    `code: ${args.code}`,
  ];
  if (args.frequencyCount !== undefined) {
    frontmatter.push(`frequency-count: ${args.frequencyCount}`);
  }
  if (args.fileLine !== undefined) {
    frontmatter.push(`file-line: ${args.fileLine}`);
  }
  frontmatter.push('---', '');

  const heading = args.classification === 'recurring' ? '# Learning draft' : '# Learning draft';
  const bodyKind = args.classification === 'recurring'
    ? `**Recurring evaluator finding** — \`${args.evaluatorName}\` flagged \`${args.code}\``
      + (args.frequencyCount !== undefined ? ` on ${args.frequencyCount} occurrences` : '')
      + `.\n\nEvidence: ${args.evidence}`
      + (args.fileLine !== undefined ? `\n\nSource: \`${args.fileLine}\`` : '')
      + `\n\nThis pattern recurs in this project; future work in the same domain should avoid it.`
    : `**Generator antipattern** — output flagged by \`${args.evaluatorName}\` as \`${args.code}\`.\n\nEvidence: ${args.evidence}`
      + (args.fileLine !== undefined ? `\n\nSource: \`${args.fileLine}\`` : '')
      + `\n\nThis is a recurring shape in generator output for this project; future generator invocations in this domain should avoid it.`;

  const provenance = `\n\n_Draft auto-generated from an evaluator finding via \`capture.ts --evaluator-finding=${args.classification}\`. The compaction pipeline (\`/griot-compact\`) will route classification-aware promotion._`;

  return [frontmatter.join('\n'), heading, '', bodyKind, provenance].join('\n') + '\n';
}

function buildEvaluatorFindingPromptMd(args: EvaluatorFindingArgs): string {
  return [
    `# Triggering finding`,
    ``,
    `## Source`,
    ``,
    `Evaluator: \`${args.evaluatorName}\``,
    `Code: \`${args.code}\``,
    `Classification: \`${args.classification}\``,
    args.frequencyCount !== undefined ? `Frequency count at capture: ${args.frequencyCount}` : '',
    args.fileLine !== undefined ? `File:line: \`${args.fileLine}\`` : '',
    ``,
    `## Evidence`,
    ``,
    args.evidence,
  ].filter((line) => line !== '').join('\n') + '\n';
}

function buildEvaluatorFindingWrongMd(args: EvaluatorFindingArgs): string {
  // No "wrong Claude output" exists for an evaluator-finding capture —
  // the finding IS the input, not a Claude response. Document the carve-out
  // so /griot-compact's judges see why this file is a stub.
  return [
    `# Flagged output`,
    ``,
    `_This session-note was captured from a \`${args.classification}\` evaluator finding via_`,
    `_\`capture.ts --evaluator-finding=...\`. There is no "wrong Claude output" to point at —_`,
    `_the evaluator's flag itself is the captured signal._`,
    ``,
    `Evaluator: \`${args.evaluatorName}\``,
    `Code: \`${args.code}\``,
    `Evidence: ${args.evidence}`,
  ].join('\n') + '\n';
}

function buildEvaluatorFindingCorrectionMd(args: EvaluatorFindingArgs): string {
  return `correction: avoid \`${args.code}\` (flagged by \`${args.evaluatorName}\`): ${args.evidence}\n`;
}

function buildEvaluatorFindingTranscriptMd(args: EvaluatorFindingArgs): string {
  return JSON.stringify(
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
  ) + '\n';
}

function captureFromEvaluatorFinding(values: Record<string, string | undefined>): void {
  const classificationRaw = values['evaluator-finding'];
  if (!classificationRaw) fail('--evaluator-finding=<classification> is required');
  if (!VALID_CLASSIFICATIONS.includes(classificationRaw as Classification)) {
    process.stderr.write(`capture-error: unknown classification '${classificationRaw}'; valid: ${VALID_CLASSIFICATIONS.join(', ')}\n`);
    process.exit(1);
  }
  const classification = classificationRaw as Classification;

  if (NOT_YET_SUPPORTED.has(classification)) {
    process.stderr.write(`capture-error: not-yet-supported: ${classification}\n`);
    process.exit(1);
  }
  if (!IMPLEMENTED_CLASSIFICATIONS.has(classification)) {
    // Defensive — should be unreachable given the partition above.
    fail(`classification not implemented: ${classification}`);
  }

  const evaluatorName = values['evaluator-name'];
  const code = values.code;
  const evidence = values.evidence;
  if (!evaluatorName) fail('--evaluator-name=<name> is required with --evaluator-finding');
  if (code === undefined) fail('--code=<code> is required with --evaluator-finding');
  if (evidence === undefined) fail('--evidence=<text> is required with --evaluator-finding');

  const fileLine = values['file-line'];
  const frequencyCountRaw = values['frequency-count'];
  let frequencyCount: number | undefined;
  if (frequencyCountRaw !== undefined) {
    const n = Number.parseInt(frequencyCountRaw, 10);
    if (!Number.isFinite(n) || n < 1) fail('--frequency-count must be a positive integer');
    frequencyCount = n;
  }
  if (classification === 'recurring' && frequencyCount === undefined) {
    fail('--frequency-count=<N> is required when --evaluator-finding=recurring');
  }

  const explicitSlug = values.slug;
  const slug = explicitSlug ?? kebabize(`${classification}-${evaluatorName}-${code}`);
  if (!slug) fail('could not derive slug; pass --slug explicitly');

  const ts = timestamp();
  const folderName = `${ts}-${slug}`;
  const folderPath = join(SESSION_NOTES_ROOT, folderName);
  if (existsSync(folderPath)) {
    fail(`folder already exists: ${folderPath}`);
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
  writeFileSync(join(folderPath, 'prompt.md'), buildEvaluatorFindingPromptMd(args));
  writeFileSync(join(folderPath, 'wrong.md'), buildEvaluatorFindingWrongMd(args));
  writeFileSync(join(folderPath, 'correction.md'), buildEvaluatorFindingCorrectionMd(args));
  writeFileSync(join(folderPath, 'full_transcript.md'), buildEvaluatorFindingTranscriptMd(args));
  writeFileSync(join(folderPath, 'learning.md'), buildEvaluatorFindingLearningMd(args));

  process.stdout.write(`captured: learnings/session-notes/${folderName}/ from --evaluator-finding=${classification}\n`);
}

function main(): void {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        'from-checkin': { type: 'string' },
        'slug': { type: 'string' },
        'correction-text': { type: 'string' },
        'evaluator-finding': { type: 'string' },
        'evaluator-name': { type: 'string' },
        'code': { type: 'string' },
        'evidence': { type: 'string' },
        'file-line': { type: 'string' },
        'frequency-count': { type: 'string' },
      },
      allowPositionals: false,
      args: process.argv.slice(2),
    });
  } catch (err) {
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const { values } = parsed;

  // Mode dispatch: --evaluator-finding routes to the new flow.
  const hasFinding = values['evaluator-finding'] !== undefined;
  const hasCheckin = values['from-checkin'] !== undefined;
  if (hasFinding && hasCheckin) {
    fail('--evaluator-finding and --from-checkin are mutually exclusive');
  }
  if (hasFinding) {
    captureFromEvaluatorFinding(values as Record<string, string | undefined>);
    return;
  }

  const checkinPath = values['from-checkin'] as string | undefined;
  if (!checkinPath) {
    process.stderr.write(`capture-error: --from-checkin=<path> is required\nusage:\n${ARG_HINT}\n`);
    process.exit(1);
  }

  const resolvedCheckin = resolve(checkinPath);
  if (!existsSync(resolvedCheckin)) fail(`checkin not found: ${checkinPath}`);

  const content = readFileSync(resolvedCheckin, 'utf-8');
  const checkin = parseCheckin(content);
  const corrections = extractCorrections(checkin.notesForPR);
  if (corrections.length === 0) {
    fail(`no correction: lines found in ${checkinPath}`);
  }

  const requestedText = values['correction-text'] as string | undefined;
  let correction: string;
  try {
    correction = selectCorrection(corrections, requestedText);
  } catch (err) {
    if (err instanceof CaptureError) fail(err.message);
    throw err;
  }

  const explicitSlug = values.slug as string | undefined;
  const slug = explicitSlug ?? kebabize(checkin.unit);
  if (!slug) fail('could not derive slug from checkin Unit; pass --slug explicitly');

  const ts = timestamp();
  const folderName = `${ts}-${slug}`;
  const folderPath = join(SESSION_NOTES_ROOT, folderName);
  if (existsSync(folderPath)) {
    fail(`folder already exists: ${folderPath}`);
  }

  mkdirSync(folderPath, { recursive: true });
  writeFileSync(join(folderPath, 'prompt.md'), buildPromptMd(checkin.unit, checkin.contract));
  writeFileSync(join(folderPath, 'wrong.md'), buildWrongMd(checkin.execution, checkin.changesSincePrev, checkin.evaluatorVerdict));
  writeFileSync(join(folderPath, 'correction.md'), buildCorrectionMd(correction));
  writeFileSync(join(folderPath, 'full_transcript.md'), checkin.fullContent);
  writeFileSync(join(folderPath, 'learning.md'), buildLearningMd(correction, checkinPath));

  process.stdout.write(`captured: learnings/session-notes/${folderName}/ from ${checkinPath}\n`);
}

main();
