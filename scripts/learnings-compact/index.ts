// /learnings-compact main entry point.
//
// Orchestrates the full nightly pipeline:
//   1. List unprocessed session-notes
//   2. For each: rubric-author → mediator panel → (rewrite loop) → promote or escalate
//   3. Regression suite over full rollup vs all archived origin prompts
//   4. Append bench-history line
//   5. Update judge-calibration.json
//   6. Archive processed notes
//   7. Print a filled-in PR body (for /learnings-compact skill to pick up)
//
// Invoked from the repo root via `tsx`. Needs ANTHROPIC_API_KEY.

import path from 'node:path';
import { diagnoseStuckLearning, logOperator, type OperatorDiagnosis, runRewriter, runRubricAuthor, verifyRubricUnchanged } from './agents';
import { updateCalibration } from './calibration';
import { loadConfig, resolvePath } from './config';
import { appendJsonlLine, archiveSessionNote, listSessionNotes, readTextOrEmpty, writeRunTranscript } from './io';
import { runMediatedPanel } from './mediator';
import { previousPassingSet, type RegressionResult, runRegressionSuite } from './regression';
import { appendToRollup, ensureRollupExists, nextLearningId, readAllRollupEntries, titleFromLearning } from './rollup';
import type { CompactionResult, Config, JudgeVerdict, PanelResult, Role, SessionNote, TokenUsage, Verdict } from './types';
import { addUsage, emptyUsage } from './types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TokenBooks {
  total: TokenUsage;
  by_role: Record<string, TokenUsage>;
  by_judge: Record<string, TokenUsage>;
}

function makeBooks(): TokenBooks {
  return {
    total: emptyUsage(),
    by_role: {},
    by_judge: {},
  };
}

function recordTokens(books: TokenBooks, role: Role, usage: TokenUsage, judgeId?: string): void {
  books.total = addUsage(books.total, usage);
  const roleKey = role === 'judge' ? 'judge' : role;
  books.by_role[roleKey] = addUsage(books.by_role[roleKey] ?? emptyUsage(), usage);
  if (role === 'judge' && judgeId) {
    books.by_judge[judgeId] = addUsage(books.by_judge[judgeId] ?? emptyUsage(), usage);
  }
}

// Process a single session-note through rubric-author (if needed) and the
// rewrite loop. Returns the final outcome for that note.
interface NoteOutcome {
  note: SessionNote;
  outcome:
    | { kind: 'promoted'; id: string; attempts: number }
    | { kind: 'did_not_reproduce' }
    | { kind: 'escalated'; reason: string; diagnosis?: OperatorDiagnosis }
    | { kind: 'rubric_tampered' }
    | { kind: 'rubric_author_failed'; error: string };
  panels: PanelResult[];
}

async function processNote(args: { config: Config; note: SessionNote; books: TokenBooks }): Promise<NoteOutcome> {
  const { config, note, books } = args;
  const onTokens = (role: Role, usage: TokenUsage, judgeId?: string) => recordTokens(books, role, usage, judgeId);

  // Step 1: rubric. Write it if missing.
  if (!note.rubric) {
    try {
      await runRubricAuthor({ config, note, onTokens });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { note, outcome: { kind: 'rubric_author_failed', error: msg }, panels: [] };
    }
  }

  const expectedRubric = note.rubric ?? '';

  // Step 2: attempts loop.
  const panels: PanelResult[] = [];
  const attemptHistory: { learningText: string; verdicts: JudgeVerdict[] }[] = [];
  const maxAttempts = config.rewrite.max_attempts;
  let learningId: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Before any attempt past the first, verify rubric is still untampered.
    if (attempt > 1) {
      const check = verifyRubricUnchanged(note, expectedRubric);
      if (!check.ok) {
        logOperator(config, {
          timestamp: new Date().toISOString(),
          violation_type: 'rubric_tampered',
          step_taken: 'rollback_change_strategy',
          outcome: 'aborted note — rubric was modified post-write',
          tokens_used: 0,
        });
        return { note, outcome: { kind: 'rubric_tampered' }, panels };
      }
    }

    const panel = await runMediatedPanel({
      config,
      prompt: note.prompt,
      correction: note.correction,
      learning: note.learning,
      rubric: expectedRubric,
      onTokens,
    });
    panels.push(panel);

    const lastVerdicts = panel.rounds[panel.rounds.length - 1].verdicts;
    attemptHistory.push({ learningText: note.learning, verdicts: lastVerdicts });

    // Persist the panel transcript under a tentative id. Once promoted we'll
    // reuse the same directory.
    if (!learningId) learningId = nextLearningId(config);
    writeRunTranscript(config, learningId, {
      attempt,
      slug: note.slug,
      learning: note.learning,
      rubric: expectedRubric,
      panel,
    });

    switch (panel.final_verdict) {
      case 'IMPROVED': {
        appendToRollup(config, {
          id: learningId,
          title: titleFromLearning(note.learning),
          promoted: today(),
          originSlug: note.slug,
          learning: note.learning,
          rubric: expectedRubric,
        });
        return {
          note,
          outcome: { kind: 'promoted', id: learningId, attempts: attempt },
          panels,
        };
      }
      case 'DID_NOT_REPRODUCE': {
        return { note, outcome: { kind: 'did_not_reproduce' }, panels };
      }
      case 'NO_CONSENSUS': {
        // Round 3 didn't reach 5/7 and no tiebreak. Escalate immediately —
        // don't burn rewrites on a panel that couldn't agree.
        logOperator(config, {
          timestamp: new Date().toISOString(),
          violation_type: 'no_consensus',
          step_taken: 'open_human_review_pr',
          outcome: `panel failed to reach consensus at attempt ${attempt}`,
          tokens_used: panel.tokens.input + panel.tokens.output,
        });
        return {
          note,
          outcome: {
            kind: 'escalated',
            reason: 'panel never reached consensus',
          },
          panels,
        };
      }
      case 'UNCHANGED':
      case 'REGRESSED': {
        if (attempt === maxAttempts) {
          break; // exit loop, diagnose below
        }
        // Rewrite and try again.
        try {
          await runRewriter({
            config,
            note,
            lastVerdicts,
            attemptNumber: attempt + 1,
            onTokens,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logOperator(config, {
            timestamp: new Date().toISOString(),
            violation_type: 'rewriter_failed',
            step_taken: 'open_human_review_pr',
            outcome: msg,
            tokens_used: 0,
          });
          return {
            note,
            outcome: { kind: 'escalated', reason: `rewriter failed: ${msg}` },
            panels,
          };
        }
        break; // fall through to next attempt
      }
    }
  }

  // All attempts exhausted without IMPROVED or DID_NOT_REPRODUCE. Diagnose.
  const diagnosis = await diagnoseStuckLearning({
    config,
    note,
    attempts: attemptHistory,
    onTokens,
  });
  logOperator(config, {
    timestamp: new Date().toISOString(),
    violation_type: `stuck_${diagnosis.category}`,
    step_taken: 'open_human_review_pr',
    outcome: diagnosis.notes,
    tokens_used: 0,
  });
  return {
    note,
    outcome: {
      kind: 'escalated',
      reason: diagnosis.category,
      diagnosis,
    },
    panels,
  };
}

// Fill in the nightly PR body template.
function renderNightlyPR(args: {
  config: Config;
  result: CompactionResult;
  regression: RegressionResult;
  rollupSizeBefore: number;
  rollupSizeAfter: number;
}): string {
  const templatePath = path.join(resolvePath(args.config.paths.pr_templates), 'nightly.md');
  let tmpl = readTextOrEmpty(templatePath);

  const verdictTable = (Object.entries(args.result.verdict_counts) as [Verdict, number][]).map(([k, v]) => `- ${k}: ${v}`).join('\n');

  const tokensByRole = Object.entries(args.result.tokens.by_role)
    .map(([k, v]) => `\n  - ${k}: ${v.input + v.output} (${v.input} in / ${v.output} out)`)
    .join('');
  const tokensByJudge = Object.entries(args.result.tokens.by_judge)
    .map(([k, v]) => `\n  - ${k}: ${v.input + v.output}`)
    .join('');

  const totalNotes = args.result.notes_processed.length;
  const dnrRate = totalNotes > 0 ? args.result.did_not_reproduce.length / totalNotes : 0;

  const header =
    `+${args.result.promoted.length + args.result.rewritten_and_promoted.length} promoted, ` +
    `${args.regression.new_failures.length} new regressions, ` +
    `${args.regression.passing}/${args.regression.passing + args.regression.failing} rollup passing ` +
    `(${args.rollupSizeBefore} → ${args.rollupSizeAfter}). ` +
    `${args.result.tokens.total.input + args.result.tokens.total.output} tokens used.`;

  const rollupDelta = args.rollupSizeBefore === args.rollupSizeAfter ? 'unchanged' : `${args.rollupSizeBefore} → ${args.rollupSizeAfter} entries`;

  const changesSummary = [
    `- Processed **${totalNotes}** session-note(s)`,
    `- Promoted: ${[...args.result.promoted, ...args.result.rewritten_and_promoted].map((p) => p.id).join(', ') || 'none'}`,
    `- Escalated: ${args.result.escalated.length} (see human-review PR(s))`,
    `- DID_NOT_REPRODUCE: ${args.result.did_not_reproduce.length}`,
  ].join('\n');

  tmpl = tmpl
    .replaceAll('{{DATE}}', args.result.date)
    .replaceAll('{{HEADER_LINE}}', header)
    .replaceAll('{{CHANGES_SUMMARY}}', changesSummary)
    .replaceAll('{{ROLLUP_DELTA}}', rollupDelta)
    .replaceAll('{{REGRESSIONS_DELTA}}', args.regression.new_failures.length > 0 ? `+${args.regression.new_failures.length} lines` : 'no change')
    .replaceAll('{{OPERATOR_DELTA}}', args.result.operator_interventions.length > 0 ? `+${args.result.operator_interventions.length} lines` : 'no change')
    .replaceAll('{{ARCHIVED_COUNT}}', String(totalNotes))
    .replaceAll('{{VERDICT_TABLE}}', verdictTable)
    .replaceAll('{{TOTAL_TOKENS}}', String(args.result.tokens.total.input + args.result.tokens.total.output))
    .replaceAll('{{TOKENS_BY_ROLE}}', tokensByRole)
    .replaceAll('{{TOKENS_BY_JUDGE}}', tokensByJudge)
    .replaceAll('{{CACHE_READ}}', String(args.result.tokens.total.cache_read))
    .replaceAll('{{CACHE_CREATION}}', String(args.result.tokens.total.cache_creation))
    .replaceAll('{{DNR_RATE}}', `${(dnrRate * 100).toFixed(1)}%`)
    .replaceAll('{{OPERATOR_COUNT}}', String(args.result.operator_interventions.length))
    .replaceAll('{{CONTESTED_COUNT}}', String(args.result.contested_count));

  return tmpl;
}

async function main(): Promise<void> {
  const config = loadConfig();
  ensureRollupExists(config);

  const notes = listSessionNotes(config);
  const books = makeBooks();

  const result: CompactionResult = {
    date: today(),
    notes_processed: [],
    promoted: [],
    rewritten_and_promoted: [],
    escalated: [],
    did_not_reproduce: [],
    regressions: [],
    verdict_counts: {
      IMPROVED: 0,
      UNCHANGED: 0,
      REGRESSED: 0,
      DID_NOT_REPRODUCE: 0,
    },
    contested_count: 0,
    tokens: books,
    operator_interventions: [],
  };

  const rollupSizeBefore = readAllRollupEntries(config).length;
  const panelsForCalibration: PanelResult[] = [];

  console.log(`Found ${notes.length} unprocessed session-note(s).`);

  for (const note of notes) {
    console.log(`\n→ Processing ${note.slug}`);
    const outcome = await processNote({ config, note, books });
    result.notes_processed.push(note.slug);
    panelsForCalibration.push(...outcome.panels);

    for (const panel of outcome.panels) {
      const finalVerdict = panel.final_verdict;
      if (finalVerdict !== 'NO_CONSENSUS') {
        result.verdict_counts[finalVerdict]++;
      }
      if (panel.contested) result.contested_count++;
    }

    switch (outcome.outcome.kind) {
      case 'promoted': {
        const target = outcome.outcome.attempts === 1 ? result.promoted : result.rewritten_and_promoted;
        target.push({
          id: outcome.outcome.id,
          slug: note.slug,
          ...(outcome.outcome.attempts > 1 ? { attempts: outcome.outcome.attempts } : {}),
        } as { id: string; slug: string; attempts?: number });
        archiveSessionNote(config, note);
        console.log(`  ✓ promoted as ${outcome.outcome.id} (attempts: ${outcome.outcome.attempts})`);
        break;
      }
      case 'did_not_reproduce': {
        result.did_not_reproduce.push(note.slug);
        archiveSessionNote(config, note);
        console.log('  · DID_NOT_REPRODUCE — flagged, archived');
        break;
      }
      case 'escalated':
      case 'rubric_tampered':
      case 'rubric_author_failed': {
        result.escalated.push({ slug: note.slug, reason: JSON.stringify(outcome.outcome) });
        // Do NOT archive — leave the note for the human reviewer.
        console.log(`  ✗ escalated: ${outcome.outcome.kind}`);
        break;
      }
    }
  }

  // Regression suite.
  console.log('\n→ Running regression suite against full rollup');
  const prevPassing = previousPassingSet(config);
  const regression = await runRegressionSuite({
    config,
    previousPassing: prevPassing,
    onTokens: (role, usage) => recordTokens(books, role, usage),
  });

  result.regressions = regression.new_failures.map((f) => ({ id: f.id, reason: f.reasoning }));

  // Calibration.
  updateCalibration(config, panelsForCalibration);

  // Bench-history line. Include passing_ids so the next run can compute
  // new_regressions correctly.
  const rollupEntries = readAllRollupEntries(config);
  const rollupSizeAfter = rollupEntries.length;
  const _passingIds = rollupEntries
    .slice(0, regression.passing) // crude — see note below
    .map((e) => e.id);
  //
  // NOTE: runRegressionSuite does not currently return per-id pass/fail
  // beyond the new_failures set. For the passing_ids snapshot we treat
  // "everything minus the known failures" as passing, which is accurate
  // for the purpose of next-run regression detection.
  const failingIds = new Set(regression.new_failures.map((f) => f.id));
  const allPassingIds = rollupEntries.map((e) => e.id).filter((id) => !failingIds.has(id));

  const benchLine = {
    date: result.date,
    rollup_size: rollupSizeAfter,
    passing: regression.passing,
    failing: regression.failing,
    new_regressions: regression.new_failures.length,
    non_reproducible: result.did_not_reproduce.length,
    contested: result.contested_count,
    verdict_counts: result.verdict_counts,
    tokens: {
      total: books.total.input + books.total.output,
      by_role: books.by_role,
      by_judge: books.by_judge,
      cache_read: books.total.cache_read,
      cache_creation: books.total.cache_creation,
    },
    passing_ids: allPassingIds,
  };
  appendJsonlLine(resolvePath(config.paths.bench_history), benchLine);

  // PR body. Print to stdout — the /learnings-compact skill captures this
  // and uses it when opening the PR.
  const prBody = renderNightlyPR({
    config,
    result,
    regression,
    rollupSizeBefore,
    rollupSizeAfter,
  });

  console.log('\n========== PR BODY ==========\n');
  console.log(prBody);
  console.log('\n========== END PR BODY ==========\n');

  console.log(`\nSummary:`);
  console.log(`  Promoted first-try: ${result.promoted.length}`);
  console.log(`  Promoted after rewrites: ${result.rewritten_and_promoted.length}`);
  console.log(`  DID_NOT_REPRODUCE: ${result.did_not_reproduce.length}`);
  console.log(`  Escalated: ${result.escalated.length}`);
  console.log(`  Tokens total (in+out): ${books.total.input + books.total.output}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
