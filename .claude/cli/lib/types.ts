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
