import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { Config } from './types';

const DEFAULT_PATH = path.resolve(process.cwd(), 'learnings/config.yaml');

export function loadConfig(configPath: string = DEFAULT_PATH): Config {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.load(raw) as Config;

  // Inject sane defaults for any optional keys the user may not have set.
  parsed.test_subject ??= {
    model: 'claude-opus-4-7',
    max_tokens: 3000,
  };

  if (!Array.isArray(parsed.judges) || parsed.judges.length !== 7) {
    throw new Error(`config.yaml: judges must be an array of exactly 7 entries (got ${parsed.judges?.length ?? 0})`);
  }

  if (parsed.consensus.round_1_blind !== 7) {
    console.warn(`config.yaml: round_1_blind is ${parsed.consensus.round_1_blind}, design specifies 7/7. Proceeding anyway.`);
  }

  return parsed;
}

export function repoRoot(): string {
  // Scripts are run from the repo root via `npm run`, so cwd is enough.
  // If that ever stops holding, switch to walking up looking for package.json.
  return process.cwd();
}

export function resolvePath(relative: string): string {
  return path.resolve(repoRoot(), relative);
}
