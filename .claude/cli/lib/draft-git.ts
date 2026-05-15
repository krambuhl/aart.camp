import { spawnSync } from 'node:child_process';
import { LoomError } from './errors.ts';

// Thin abstraction over the small set of `git` operations draft needs:
// asking whether a file is committed (collision check for `plan`),
// and the add-and-commit pair (commit phase of `plan` and `revise`).
//
// Tests inject a stub `GitRunner` via `DraftCliContext.gitRunner`;
// production code uses `defaultGitRunner` which shells out to `git`.
export type GitRunner = {
  // Returns true when `filePath` is tracked in HEAD (i.e. committed
  // at least once on the current branch). Untracked files return
  // false. Used by `plan` to decide whether to refuse overwrite vs
  // allow recovery-from-failed-commit.
  isCommitted(repoRoot: string, filePath: string): boolean;

  // Stages the named paths and commits with the given message.
  // Throws `LoomError('git-commit-failed', ...)` on non-zero exit
  // from either step. Run from `repoRoot` so relative paths in
  // `paths` resolve correctly.
  addAndCommit(repoRoot: string, paths: string[], message: string): void;
};

export const defaultGitRunner: GitRunner = {
  isCommitted(repoRoot: string, filePath: string): boolean {
    const result = spawnSync(
      'git',
      ['ls-files', '--error-unmatch', filePath],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    return result.status === 0;
  },

  addAndCommit(repoRoot: string, paths: string[], message: string): void {
    const addResult = spawnSync('git', ['add', ...paths], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (addResult.status !== 0) {
      throw new LoomError(
        'git-commit-failed',
        `git add failed: ${addResult.stderr ?? '(no stderr)'}`,
      );
    }
    const commitResult = spawnSync('git', ['commit', '-m', message], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (commitResult.status !== 0) {
      throw new LoomError(
        'git-commit-failed',
        `git commit failed: ${commitResult.stderr ?? '(no stderr)'}`,
      );
    }
  },
};
