---
name: griot-report
description: >-
  Generate a one-pager report on trend, cost, and judge calibration from the
  instrumentation files. Use ONLY when explicitly invoked via
  /griot-report. Read-only — does not modify any state.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash(npm run learnings:report), Read
---

# Learnings Report

Produce a one-pager from:
- `learnings/bench-history.jsonl`
- `learnings/citations.json`
- `learnings/sessions.jsonl`
- `learnings/operator-log.jsonl`
- `learnings/judge-calibration.json`

## Procedure

1. Run:
   ```bash
   npm run learnings:report
   ```
2. Show the output to the user verbatim. It's already formatted markdown.
3. If any section says "no data yet," tell the user which hook / skill
   they need to enable to populate it (Stop hook for citations and
   sessions; `/griot-compact` for bench-history, operator-log, and
   calibration).
4. If the script errors (non-zero exit, malformed JSONL), surface the
   error and stop. Do not attempt to reconstruct the report from raw
   files — the script is the source of truth for the report format.

## What the report covers

Metrics in order of importance (per the design):

1. `corrections_per_session` trend — top-line. Did Claude need correcting less?
2. `DID_NOT_REPRODUCE` rate — kill-switch. Flags if >30%.
3. `rollup_pass_rate` trend — are learnings self-consistent?
4. `cost_per_promoted_learning` — is the tooling amortising?
5. Top-5 most-cited learnings.
6. Operator intervention frequency.
7. Session latency delta (with vs without rollup).
8. Per-judge calibration table.

The always-included caveat is printed at the top: fewer corrections could
mean users gave up, not that Claude improved.

## Do not

- Do not modify any data files. This skill is read-only.
- Do not draw conclusions about rollout readiness — show the numbers,
  let the user decide.
