'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { createSpiralGrid, type SpiralCell } from '@/lib/spiral-grid';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// Super Quilts Cinco — spiral-phase wave with per-cell drift. Spiral
// position drives the wave (band order legible); each cell's grid
// position adds a phase offset so motion isn't synced across the
// canvas — different regions roll through colours at apparent
// different rates.

export const meta = {
  title: 'Spiral Wave',
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

          const loopFrames = 1800;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          p.colorMode(p.RGB, 1);
          const length = store.frames.length;
          for (let i = 0; i < length; i++) {
            const frame: SpiralCell = store.frames[i];
            const phase = i / length; // 0..1 along the spiral walk

            // Two waves: spiral phase drives the band stripe, grid
            // position breaks lockstep so cells animate at apparent
            // varying rates across the canvas.
            const colorIndex0 = (Math.cos(phase * Math.PI * 16 + frame.x * 0.08 + time * 6) + 1) * 0.5;
            const colorIndex1 = (Math.sin(phase * Math.PI * 8 + frame.y * 0.08 + time * 4) + 1) * 0.5;

            p.fill(1, colorIndex0, colorIndex1);
            p.rect(frame.x * cellPx + padding, frame.y * cellPx + padding, cellPx - gutter, cellPx - gutter);
          }
        }}
      />
    </Area>
  );
}
