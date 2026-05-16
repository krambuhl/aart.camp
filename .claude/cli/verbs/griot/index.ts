// griot verb registry — flat verb namespace.
// Each verb is a standalone operation on the learnings substrate
// (rollup, session-notes, judge panels). Modeled on bin/draft's
// flat-verb shape.

import { useVerb } from './use.ts';

export type GriotCliContext = {
  // The repo cwd where `learnings/` and other griot-relevant
  // directories are resolved. Defaults to process.cwd() in the
  // CLI entry; tests inject a tmpdir.
  cwd: string;
};

export type DispatchResult = {
  stdout?: string;
  stderr?: string;
  exitCode: number;
};

export type GriotVerbHandler = (
  rest: string[],
  ctx: GriotCliContext,
) => DispatchResult;

export const GRIOT_VERBS: Record<string, GriotVerbHandler> = {
  use: useVerb,
};
