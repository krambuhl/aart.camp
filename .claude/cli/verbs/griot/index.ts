// griot verb registry — flat verb namespace.
// Each verb is a standalone operation on the learnings substrate
// (rollup, session-notes, judge panels). Modeled on bin/draft's
// flat-verb shape.

import { captureVerb } from './capture.ts';
import { mediatePanelVerb } from './mediate-panel.ts';
import { operatorChecksVerb } from './operator-checks.ts';
import { useVerb } from './use.ts';

export type GriotCliContext = {
  // The repo cwd where `learnings/` and other griot-relevant
  // directories are resolved. Defaults to process.cwd() in the
  // CLI entry; tests inject a tmpdir.
  cwd: string;
  // Stdin contents, read once at dispatcher entry when the process
  // is not running in a TTY. Verbs that consume stdin (mediate-panel,
  // operator-checks) read it via this field; verbs that don't
  // consume stdin (use) ignore it. Defaults to empty string.
  stdin?: string;
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
  capture: captureVerb,
  'operator-checks': operatorChecksVerb,
  'mediate-panel': mediatePanelVerb,
};
