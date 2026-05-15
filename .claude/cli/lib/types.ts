// Loom project-substrate types.
// Authored against the design contract in projects/LOOM-CONVENTIONS.md.
// Erasable TypeScript only — no enums, no namespaces, no parameter
// properties, no const enums (substrate convention: scripts run via
// `node` directly, relying on Node 24+ type-stripping).

// ---------- Common ----------

export type SchemaVersion = 1;

// ---------- Manifest ----------

export type ManifestStatus = 'active' | 'archived';

export type PhaseStatus =
  | 'not-started'
  | 'in-progress'
  | 'blocked'
  | 'completed';

export type PhasePRState = 'open' | 'merged' | 'closed';

export type PhasePR = {
  number: number;
  url: string;
  state: PhasePRState;
};

export type ManifestPhase = {
  number: number;
  name: string;
  status: PhaseStatus;
  branch?: string;
  latest_checkin?: string;
  blocked_reason?: string;
  pr?: PhasePR;
};

export type Manifest = {
  schema_version: SchemaVersion;
  title: string;
  slug: string;
  started: string;
  status: ManifestStatus;
  current_branch: string | null;
  latest_checkin: string | null;
  strategy: string;
  phases: ManifestPhase[];
};

// ---------- Events ----------

type EventBase<TName extends string, TDetail> = {
  at: string;
  event: TName;
  detail: TDetail;
};

export type ProjectInitializedEvent = EventBase<
  'project-initialized',
  Record<string, never>
>;

export type PhaseStartedEvent = EventBase<
  'phase-started',
  { phase: number; name: string }
>;

export type PhaseCompletedEvent = EventBase<
  'phase-completed',
  { phase: number }
>;

export type PhaseBlockedEvent = EventBase<
  'phase-blocked',
  { phase: number; reason: string }
>;

export type PhaseUnblockedEvent = EventBase<
  'phase-unblocked',
  { phase: number }
>;

export type CheckinCreatedEvent = EventBase<
  'checkin-created',
  { number: string; branch: string }
>;

export type PrOpenedEvent = EventBase<
  'pr-opened',
  { pr: number; url: string }
>;

export type PrUpdatedEvent = EventBase<'pr-updated', { pr: number }>;

export type PrMergedEvent = EventBase<'pr-merged', { pr: number }>;

export type SessionSavedEvent = EventBase<
  'session-saved',
  { filename: string }
>;

export type RetroWrittenEvent = EventBase<
  'retro-written',
  { type: 'session' | 'project'; phase?: number; tier?: number }
>;

export type ArchivedEvent = EventBase<'archived', { destination: string }>;

export type NoteEvent = EventBase<'note', { text: string }>;

export type Event =
  | ProjectInitializedEvent
  | PhaseStartedEvent
  | PhaseCompletedEvent
  | PhaseBlockedEvent
  | PhaseUnblockedEvent
  | CheckinCreatedEvent
  | PrOpenedEvent
  | PrUpdatedEvent
  | PrMergedEvent
  | SessionSavedEvent
  | RetroWrittenEvent
  | ArchivedEvent
  | NoteEvent;

export type EventName = Event['event'];

// ---------- Config ----------

export type Config = {
  schema_version: SchemaVersion;
  base_branch: string;
  reviewers: string[];
  labels: string[];
  verification: string[];
  worker_bindings: Record<string, string>;
};

// ---------- Checkin ----------

export type CheckinVerdictResult = 'approved' | 'flagged';

export type CheckinContract = {
  goal: string;
  acceptance_criteria: string[];
  rules_applied: string[];
  disqualifiers: string[];
  inputs: string[];
};

export type CheckinExecution = {
  actions: string[];
  files_touched: string[];
  corrections: string[];
};

export type CheckinVerdict = {
  result: CheckinVerdictResult;
  reasons: string[];
};

export type CheckinPhaseRef = {
  number: number;
  name: string;
};

export type Checkin = {
  schema_version: SchemaVersion;
  number: string;
  created: string;
  phase: CheckinPhaseRef;
  branch: string;
  unit: string;
  contract: CheckinContract;
  execution: CheckinExecution;
  scope: string[];
  changes_since_previous: string;
  verdict: CheckinVerdict;
  notes_for_pr: string[];
};

// ---------- Session ----------

export type Session = {
  schema_version: SchemaVersion;
  date: string;
  letter: string;
  phases_touched: number[];
  checkins_written: string[];
  pr_activity: string[];
  what_happened: string[];
  open_threads: string[];
  notes: string[];
};

// ---------- Retro ----------

export type RetroFindingCategory =
  | 'kept-well'
  | 'improvement'
  | 'process-change'
  | 'follow-up';

export type RetroFinding = {
  category: RetroFindingCategory;
  description: string;
  evidence?: string;
};

export type SessionRetro = {
  schema_version: SchemaVersion;
  type: 'session';
  created: string;
  phase: number;
  tier: number;
  findings: RetroFinding[];
};

export type ProjectRetro = {
  schema_version: SchemaVersion;
  type: 'project';
  created: string;
  findings: RetroFinding[];
};

export type Retro = SessionRetro | ProjectRetro;

export type RetroType = Retro['type'];
