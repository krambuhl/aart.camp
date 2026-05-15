import { test, expect } from 'vitest';
import { parseCheckinMarker, computeMarkerState } from './pr-marker.ts';

test('parseCheckinMarker returns null when no marker is present', () => {
  expect(parseCheckinMarker('## Summary\nNo marker here.')).toBeNull();
});

test('parseCheckinMarker extracts a single-checkin marker', () => {
  const body = '<!-- loom-pr-checkins: 01 -->\n\n## Body';
  expect(parseCheckinMarker(body)).toEqual([1]);
});

test('parseCheckinMarker extracts a multi-checkin marker', () => {
  const body = '<!-- loom-pr-checkins: 01,02,03 -->\n\n## Body';
  expect(parseCheckinMarker(body)).toEqual([1, 2, 3]);
});

test('parseCheckinMarker tolerates whitespace inside the marker', () => {
  const body = '<!-- loom-pr-checkins: 01, 02 , 03 -->';
  expect(parseCheckinMarker(body)).toEqual([1, 2, 3]);
});

test('parseCheckinMarker returns sorted numbers regardless of order', () => {
  const body = '<!-- loom-pr-checkins: 03,01,02 -->';
  expect(parseCheckinMarker(body)).toEqual([1, 2, 3]);
});

test('computeMarkerState: no PR (marker null, disk non-empty) → new', () => {
  expect(computeMarkerState([1, 2, 3], null)).toBe('new');
});

test('computeMarkerState: marker equals disk → fresh', () => {
  expect(computeMarkerState([1, 2, 3], [1, 2, 3])).toBe('fresh');
});

test('computeMarkerState: marker is unordered but equals disk → fresh', () => {
  expect(computeMarkerState([1, 2, 3], [3, 1, 2])).toBe('fresh');
});

test('computeMarkerState: marker is a proper subset of disk → stale', () => {
  expect(computeMarkerState([1, 2, 3], [1, 2])).toBe('stale');
});

test('computeMarkerState: empty marker, disk non-empty → stale', () => {
  expect(computeMarkerState([1, 2], [])).toBe('stale');
});

test('computeMarkerState: marker is a proper superset of disk → drift', () => {
  expect(computeMarkerState([1, 2], [1, 2, 3])).toBe('drift');
});

test('computeMarkerState: sets diverge in both directions → drift', () => {
  expect(computeMarkerState([1, 2, 4], [1, 2, 3])).toBe('drift');
});
