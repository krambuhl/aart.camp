// /learnings-report — reads the instrumentation files and prints a one-pager
// summarising trend, cost, and judge calibration.
//
// Inputs:
//   learnings/bench-history.jsonl
//   learnings/citations.json
//   learnings/sessions.jsonl
//   learnings/operator-log.jsonl
//   learnings/judge-calibration.json
//
// Output: a single markdown document to stdout. The /learnings-report skill
// captures this and shows it to the user.

import fs from 'node:fs';
import { loadConfig, resolvePath } from './learnings-compact/config';

interface BenchLine {
  date: string;
  rollup_size: number;
  passing: number;
  failing: number;
  new_regressions: number;
  non_reproducible: number;
  contested: number;
  verdict_counts: Record<string, number>;
  tokens: {
    total: number;
    by_role: Record<string, unknown>;
    by_judge: Record<string, unknown>;
  };
}

interface SessionLine {
  id: string;
  timestamp?: string;
  duration_ms: number;
  corrections: number;
  used_learnings: string[];
  citations: number;
  tokens_added_by_rollup: number;
}

function readJsonl<T>(p: string): T[] {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function readJsonOrEmpty<T extends object>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n: number, d = 2): string {
  return n.toFixed(d);
}

function trend(recent: number[], older: number[]): string {
  if (recent.length === 0 || older.length === 0) return 'n/a';
  const r = mean(recent);
  const o = mean(older);
  if (o === 0) return r === 0 ? 'flat' : `↑ ${round(r)}`;
  const delta = ((r - o) / o) * 100;
  if (Math.abs(delta) < 5) return `flat (${round(delta, 1)}%)`;
  return delta < 0 ? `↓ ${round(Math.abs(delta), 1)}%` : `↑ ${round(delta, 1)}%`;
}

function split<T>(arr: T[], recentN: number): { recent: T[]; older: T[] } {
  if (arr.length <= recentN) return { recent: arr, older: [] };
  return {
    recent: arr.slice(-recentN),
    older: arr.slice(0, -recentN),
  };
}

function main(): void {
  const config = loadConfig();
  const bench = readJsonl<BenchLine>(resolvePath(config.paths.bench_history));
  const sessions = readJsonl<SessionLine>(resolvePath(config.paths.sessions));
  const citations = readJsonOrEmpty<Record<string, { count: number; last_used: string }>>(resolvePath(config.paths.citations), {});
  const opLog = readJsonl<{ violation_type: string; step_taken: string }>(resolvePath(config.paths.operator_log));
  const calibration = readJsonOrEmpty<
    Record<
      string,
      {
        runs: number;
        round_1_agreements: number;
        final_agreements: number;
        contested_runs: number;
        contested_agreements: number;
        errors: number;
      }
    >
  >(resolvePath(config.paths.judge_calibration), {});

  const lines: string[] = [];
  lines.push(`# Learnings report — ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(
    '_Caveat always included: fewer corrections per session could mean users gave up, not that Claude improved. Triangulate with external signals (PR review comments, CI failure rate) before claiming success._',
  );
  lines.push('');

  // ── 1. corrections_per_session trend ───────────────────────────────────
  lines.push('## 1. Corrections per session (top-line)');
  lines.push('');
  if (sessions.length === 0) {
    lines.push('No sessions logged yet. Opt in to the Stop hook — see `learnings/README.md`.');
  } else {
    const { recent, older } = split(sessions, 20);
    const recentMean = mean(recent.map((s) => s.corrections));
    const olderMean = mean(older.map((s) => s.corrections));
    lines.push(`- Sessions logged: **${sessions.length}**`);
    lines.push(`- Last 20 sessions: **${round(recentMean)}** corrections/session`);
    lines.push(`- Prior sessions: ${round(olderMean)} corrections/session`);
    lines.push(
      `- Trend: **${trend(
        recent.map((s) => s.corrections),
        older.map((s) => s.corrections),
      )}**`,
    );
  }
  lines.push('');

  // ── 2. DID_NOT_REPRODUCE rate (kill switch) ────────────────────────────
  lines.push('## 2. DID_NOT_REPRODUCE rate (kill switch — alert if >30%)');
  lines.push('');
  if (bench.length === 0) {
    lines.push('No compaction runs yet.');
  } else {
    const totalNotes = bench.reduce(
      (a, b) =>
        a +
        (b.verdict_counts.IMPROVED ?? 0) +
        (b.verdict_counts.UNCHANGED ?? 0) +
        (b.verdict_counts.REGRESSED ?? 0) +
        (b.verdict_counts.DID_NOT_REPRODUCE ?? 0),
      0,
    );
    const totalDnr = bench.reduce((a, b) => a + b.non_reproducible, 0);
    const rate = totalNotes > 0 ? (totalDnr / totalNotes) * 100 : 0;
    const flag = rate > 30 ? ' 🚨 ABOVE THRESHOLD' : '';
    lines.push(`- Cumulative DNR rate: **${round(rate, 1)}%**${flag}`);
    lines.push(`- DNR count: ${totalDnr} / ${totalNotes} notes`);
    if (rate > 30) {
      lines.push("- **Kill-switch condition.** The benchmark can't validate itself — prompt distillation is likely failing to reproduce the failures.");
    }
  }
  lines.push('');

  // ── 3. rollup_pass_rate trend ──────────────────────────────────────────
  lines.push('## 3. Rollup pass rate (are learnings self-consistent?)');
  lines.push('');
  if (bench.length === 0) {
    lines.push('No compaction runs yet.');
  } else {
    const last = bench[bench.length - 1];
    const rate = last.rollup_size > 0 ? (last.passing / (last.passing + last.failing)) * 100 : 0;
    lines.push(`- Latest: **${last.passing}/${last.passing + last.failing}** passing (${round(rate, 1)}%)`);
    const passRates = bench.map((b) => (b.passing + b.failing > 0 ? (b.passing / (b.passing + b.failing)) * 100 : 100));
    const { recent, older } = split(passRates, 5);
    lines.push(`- Trend (last 5 runs vs earlier): **${trend(recent, older)}**`);
  }
  lines.push('');

  // ── 4. cost_per_promoted_learning ──────────────────────────────────────
  lines.push('## 4. Cost per promoted learning (is the tooling amortising?)');
  lines.push('');
  if (bench.length === 0) {
    lines.push('No compaction runs yet.');
  } else {
    const totalTokens = bench.reduce((a, b) => a + (b.tokens?.total ?? 0), 0);
    const totalPromoted = bench.reduce((a, b) => a + (b.verdict_counts.IMPROVED ?? 0), 0);
    const perLearning = totalPromoted > 0 ? totalTokens / totalPromoted : 0;
    lines.push(`- Total tokens across all compactions: **${totalTokens.toLocaleString()}**`);
    lines.push(`- Total learnings promoted: **${totalPromoted}**`);
    lines.push(`- Cost per promoted learning: **${perLearning > 0 ? `${Math.round(perLearning).toLocaleString()} tokens` : 'n/a'}**`);
  }
  lines.push('');

  // ── 5. top 5 most-cited ────────────────────────────────────────────────
  lines.push('## 5. Top 5 most-cited learnings');
  lines.push('');
  const ranked = Object.entries(citations)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);
  if (ranked.length === 0) {
    lines.push('No citations yet. Enable the Stop hook to track them.');
  } else {
    for (const [id, meta] of ranked) {
      lines.push(`- **${id}** — ${meta.count} uses (last: ${meta.last_used})`);
    }
  }
  lines.push('');

  // ── 6. operator intervention frequency ─────────────────────────────────
  lines.push('## 6. Operator intervention frequency');
  lines.push('');
  if (opLog.length === 0) {
    lines.push('No interventions logged.');
  } else {
    const byType: Record<string, number> = {};
    for (const op of opLog) byType[op.violation_type] = (byType[op.violation_type] ?? 0) + 1;
    lines.push(`- Total interventions: **${opLog.length}**`);
    for (const [type, n] of Object.entries(byType).sort(([, a], [, b]) => b - a)) {
      lines.push(`  - ${type}: ${n}`);
    }
  }
  lines.push('');

  // ── 7. session latency delta ───────────────────────────────────────────
  lines.push('## 7. Session latency delta (with vs without rollup)');
  lines.push('');
  if (sessions.length === 0) {
    lines.push('No session data yet.');
  } else {
    const withRollup = sessions.filter((s) => s.used_learnings && s.used_learnings.length > 0);
    const without = sessions.filter((s) => !s.used_learnings || s.used_learnings.length === 0);
    const withMean = mean(withRollup.map((s) => s.duration_ms));
    const withoutMean = mean(without.map((s) => s.duration_ms));
    lines.push(`- With rollup cited: ${withRollup.length} sessions, mean duration ${round(withMean / 1000)}s`);
    lines.push(`- Without rollup cited: ${without.length} sessions, mean duration ${round(withoutMean / 1000)}s`);
    const delta = withMean - withoutMean;
    lines.push(`- Delta: ${delta >= 0 ? '+' : ''}${round(delta / 1000)}s per session`);
    lines.push(`- Caveat: duration_ms only populated if the Stop hook event includes it — may be 0 for most rows until that ships.`);
  }
  lines.push('');

  // ── 8. judge calibration ───────────────────────────────────────────────
  lines.push('## 8. Judge calibration');
  lines.push('');
  const judgeIds = Object.keys(calibration).sort();
  if (judgeIds.length === 0) {
    lines.push('No panel runs yet.');
  } else {
    lines.push('| Judge | Runs | Round-1 agree | Final agree | Contested agree | Errors |');
    lines.push('|---|---|---|---|---|---|');
    for (const id of judgeIds) {
      const s = calibration[id];
      const r1 = s.runs > 0 ? `${round((s.round_1_agreements / s.runs) * 100, 1)}%` : 'n/a';
      const rf = s.runs > 0 ? `${round((s.final_agreements / s.runs) * 100, 1)}%` : 'n/a';
      const rc = s.contested_runs > 0 ? `${round((s.contested_agreements / s.contested_runs) * 100, 1)}%` : 'n/a';
      lines.push(`| ${id} | ${s.runs} | ${r1} | ${rf} | ${rc} | ${s.errors} |`);
    }
    lines.push('');
    lines.push('Round-1 = blind vote matched final verdict (independent reliability).');
    lines.push('Final = post-debate vote matched final verdict.');
    lines.push('Outliers with very low round-1 but high final agreement = ' + 'follows the panel rather than evaluating; consider rotating.');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('Generated by `/learnings-report`. All figures are local-only until the corpus is un-gitignored in Phase 3.');

  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
