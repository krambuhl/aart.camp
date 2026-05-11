'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { createSpiralGrid, type SpiralCell } from '@/lib/spiral-grid';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// Super Quilts Nueve — diagonal currents on a 90s seamless loop. R
// rate uses (i + x + y), B uses (i + x + (sides - y)). The two
// channels' rate gradients cross on diagonal axes instead of
// horizontal/vertical. Per-cell phase ensures u = 0 isn't a uniform
// colour wash.

export const meta = {
  title: 'Tide',
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

            // R rate increases on the (x + y) NE diagonal; B rate
            // increases on the (x + (sides - y)) SE diagonal. The two
            // rate fields cross on diagonal axes.
            const r0 = 1 + i + frame.x + frame.y;
            const r1 = 1 + i + frame.x + (sides - frame.y);
            const phase0 = ((i + frame.x * 7 + frame.y * 3) % 1019) / 1019;
            const phase1 = ((i + frame.x * 5 + frame.y * 11) % 983) / 983;
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
