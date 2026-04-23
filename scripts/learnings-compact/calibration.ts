import fs from 'node:fs';
import { resolvePath } from './config';
import { writeTextAtomic } from './io';
import type { Config, PanelResult } from './types';

interface JudgeCalibration {
  runs: number;
  round_1_agreements: number;
  final_agreements: number;
  contested_runs: number;
  contested_agreements: number;
  errors: number;
}

type CalibrationFile = Record<string, JudgeCalibration>;

function emptyStats(): JudgeCalibration {
  return {
    runs: 0,
    round_1_agreements: 0,
    final_agreements: 0,
    contested_runs: 0,
    contested_agreements: 0,
    errors: 0,
  };
}

export function updateCalibration(config: Config, results: PanelResult[]): CalibrationFile {
  const p = resolvePath(config.paths.judge_calibration);
  const data: CalibrationFile = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};

  for (const result of results) {
    if (result.final_verdict === 'NO_CONSENSUS') continue;
    const round1 = result.rounds[0];
    const last = result.rounds[result.rounds.length - 1];

    for (const judge of config.judges) {
      if (!data[judge.id]) data[judge.id] = emptyStats();
      const s = data[judge.id];
      const r1 = round1.verdicts.find((v) => v.judge_id === judge.id);
      const rf = last.verdicts.find((v) => v.judge_id === judge.id);
      if (!r1 || !rf) continue;

      if (r1.errored) s.errors++;
      else {
        s.runs++;
        if (r1.verdict === result.final_verdict) s.round_1_agreements++;
        if (!rf.errored && rf.verdict === result.final_verdict) s.final_agreements++;
        if (result.contested) {
          s.contested_runs++;
          if (!rf.errored && rf.verdict === result.final_verdict) {
            s.contested_agreements++;
          }
        }
      }
    }
  }

  writeTextAtomic(p, JSON.stringify(data, null, 2));
  return data;
}
