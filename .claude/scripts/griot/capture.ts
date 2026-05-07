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

const ARG_HINT = '--from-checkin=<path> [--slug=<slug>] [--correction-index=<n>]';

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

function main(): void {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        'from-checkin': { type: 'string' },
        'slug': { type: 'string' },
        'correction-index': { type: 'string' },
      },
      allowPositionals: false,
      args: process.argv.slice(2),
    });
  } catch (err) {
    fail(`argument parse failure: ${(err as Error).message}`);
  }
  const { values } = parsed;

  const checkinPath = values['from-checkin'] as string | undefined;
  if (!checkinPath) {
    process.stderr.write(`capture-error: --from-checkin=<path> is required\nusage: ${ARG_HINT}\n`);
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

  const indexRaw = values['correction-index'] as string | undefined;
  const correctionIndex = indexRaw === undefined ? 0 : Number(indexRaw);
  if (!Number.isInteger(correctionIndex) || correctionIndex < 0 || correctionIndex >= corrections.length) {
    fail(`--correction-index out of range; checkin has ${corrections.length} correction(s) (valid: 0-${corrections.length - 1})`);
  }
  const correction = corrections[correctionIndex];

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
