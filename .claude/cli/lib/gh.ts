import { execFileSync } from 'node:child_process';

// Thin wrapper around `gh` CLI. Tests inject a stub via CliContext.ghRunner;
// production uses execFileSync. Errors propagate as thrown Errors with the
// underlying gh stderr in `.message`.

export type GhRunner = (args: string[]) => string;

export const defaultGhRunner: GhRunner = (args) => {
  return execFileSync('gh', args, { encoding: 'utf8' });
};
