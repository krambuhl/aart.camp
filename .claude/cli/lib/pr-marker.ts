// PR marker parsing + marker-state computation for the loom-pr workflow.
//
// Marker format embedded in PR bodies:
//   <!-- loom-pr-checkins: NN[,NN,...] -->
//
// The `loom-pr-checkins` prefix was originally chosen to coexist with
// trout's `<!-- project-pr-checkins: -->` marker without collision.
// Trout retired in trout-sunset Phase 3, but the loom marker keeps its
// prefix — it's stable and embedded in every merged PR body.

export type MarkerState = 'fresh' | 'stale' | 'drift' | 'new';

const MARKER_RE = /<!--\s*loom-pr-checkins:\s*([0-9,\s]+)\s*-->/;

export function parseCheckinMarker(body: string): number[] | null {
  const match = MARKER_RE.exec(body);
  if (match === null) return null;
  const numbers = (match[1] as string)
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return numbers.sort((a, b) => a - b);
}

function setEquals(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function isSubset(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function computeMarkerState(
  disk: number[],
  marker: number[] | null,
): MarkerState {
  // No PR yet: only `new` if there's something on disk to be authored from.
  if (marker === null) return 'new';
  const diskSet = new Set(disk);
  const markerSet = new Set(marker);
  if (setEquals(diskSet, markerSet)) return 'fresh';
  if (isSubset(markerSet, diskSet)) return 'stale';
  // marker has something disk doesn't, or sets diverge bidirectionally
  return 'drift';
}
