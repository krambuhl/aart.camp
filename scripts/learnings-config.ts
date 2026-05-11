import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

interface LearningsConfig {
  paths: {
    bench_history: string;
    sessions: string;
    citations: string;
    operator_log: string;
    judge_calibration: string;
    [key: string]: string;
  };
  [key: string]: unknown;
}

const DEFAULT_PATH = path.resolve(process.cwd(), 'learnings/config.yaml');

export function loadConfig(configPath: string = DEFAULT_PATH): LearningsConfig {
  const raw = fs.readFileSync(configPath, 'utf8');
  return yaml.load(raw) as LearningsConfig;
}

export function repoRoot(): string {
  return process.cwd();
}

export function resolvePath(relative: string): string {
  return path.resolve(repoRoot(), relative);
}
