When a rebase brings in tooling that overlaps with what the current PR is
standing up — competing test runners, competing linters, competing build
pipelines — the right resolution is consolidation, not coexistence. Two
overlapping tools is permanent maintenance burden (two configs to drift,
two CI invocations, two assertion styles for contributors to learn);
one tool with a focused filter script (e.g., `test:agentic` to run just the
substrate slice under vitest) is the cleaner abstraction. Default to
porting the smaller surface onto the tool the PR already adopts, especially
when the port is mechanical (a few-line edit at most).

This is still infra work and stays in scope for an "infra not coverage" PR
— one harness instead of two is an infrastructure simplification, not
coverage expansion. The instinct to defer consolidation as a separate
follow-up PR ("preserve scope by not touching the conflicting code") leaves
the project worse off than the rebase found it. Surface the scope expansion
clearly to the user (write a `correction:` line in the checkin Notes per
substrate convention), confirm the resolution, then do the consolidation
in the same PR.
