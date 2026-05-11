'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { createSpiralGrid, type SpiralCell } from '@/lib/spiral-grid';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// Super Quilts Cuatro — radial bloom over spiral bands. Spiral index
// is the primary colour driver (so quilting bands stay visible);
// radial distance and angle modulate on top to add concentric rings
// and rotational sectors.

export const meta = {
  title: 'Radial Bloom',
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

          // 30-second seamless loop; integer time multipliers below.
          const loopFrames = 1800;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          const cx = (sides - 1) / 2;
          const cy = (sides - 1) / 2;
          const maxR = Math.hypot(cx, cy);

          p.colorMode(p.RGB, 1);
          const length = store.frames.length;
          for (let i = 0; i < length; i++) {
            const frame: SpiralCell = store.frames[i];
            const dx = frame.x - cx;
            const dy = frame.y - cy;
            const r = Math.hypot(dx, dy) / maxR; // 0..1
            const theta = Math.atan2(dy, dx); // -π..π

            // R-channel: spiral-index wave (creates band stripes) +
            // radial pulse breathing through it
            const colorIndex0 = (Math.cos(i * 0.04 + r * Math.PI * 4 + time * 4) + 1) * 0.5;
            // B-channel: spiral-index wave + angular sweep
            const colorIndex1 = (Math.sin(i * 0.06 + theta * 6 + time * 2) + 1) * 0.5;

            p.fill(1, colorIndex0, colorIndex1);
            p.rect(frame.x * cellPx + padding, frame.y * cellPx + padding, cellPx - gutter, cellPx - gutter);
          }
        }}
      />
    </Area>
  );
}
