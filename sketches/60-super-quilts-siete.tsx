'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { createSpiralGrid, type SpiralCell } from '@/lib/spiral-grid';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// Super Quilts Siete — Tres rate trick on a 90s seamless loop.
// Per-cell rate r = 1 + i + x·2 (integer), so cells deep in the
// spiral cycle thousands of times per loop while inner cells cycle
// only a handful — same rate spread that makes Tres feel alive. The
// (r·u + phase) % 1 sawtooth loops perfectly because at u = 1 every
// cell's argument shifts by an integer, returning to its start phase.

export const meta = {
  title: 'Drift',
  date: '2026-05-01T00:00:00',
};

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 1280;
const sides = 120;
const bandSize = 20;
const padding = 40;
const gutter = -0.5;
const cellPx = (canvasSize - padding * 2) / sides;

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        aspectRatio={1}
        setup={(p, store) => {
          p.createCanvas(canvasSize, canvasSize);
          p.colorMode(p.HSL);
          p.noStroke();
          store.frames = createSpiralGrid({ sidesX: sides, sidesY: sides, bandSize });
        }}
        draw={(p, store) => {
          p.clear(...bgColor);

          // 90 second seamless loop at 60fps.
          const loopFrames = 5400;
          const u = (p.frameCount % loopFrames) / loopFrames;

          p.colorMode(p.RGB, 1);
          const length = store.frames.length;
          for (let i = 0; i < length; i++) {
            const frame: SpiralCell = store.frames[i];

            // Per-cell integer rate (cycles per 90s loop). Doubling
            // the x/y weight strengthens orthogonal directionality.
            const r0 = 1 + i + frame.x * 2;
            const r1 = 1 + i + frame.y * 2;
            // Per-cell phase so the canvas isn't all the same colour
            // at u = 0. Primes 997 / 1009 avoid alignment with band
            // size so the initial pattern reads as varied.
            const phase0 = ((i + frame.x * 7) % 997) / 997;
            const phase1 = ((i + frame.y * 11) % 1009) / 1009;
            const colorIndex0 = (r0 * u + phase0) % 1;
            const colorIndex1 = (r1 * u + phase1) % 1;

            p.fill(1, colorIndex0, colorIndex1);
            p.rect(frame.x * cellPx + padding, frame.y * cellPx + padding, cellPx - gutter, cellPx - gutter);
          }
        }}
      />
    </Area>
  );
}
