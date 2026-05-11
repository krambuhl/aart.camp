'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { createSpiralGrid, SPIRAL_JUMP, type SpiralCell } from '@/lib/spiral-grid';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// Super Quilts Seis — direction stripes. Each cell carries the
// direction the spiral walker took into it (one of four). The
// direction picks a phase offset that, combined with a time wash,
// produces hard-edged colour blocks following the spiral's turns.

export const meta = {
  title: 'Direction Stripes',
  date: '2026-05-01T00:00:00',
};

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 1280;
const sides = 120;
const bandSize = 20;
const padding = 40;
const gutter = -0.5;
const cellPx = (canvasSize - padding * 2) / sides;

function dirIndex(dir: [number, number] | undefined): number {
  if (!dir) return 0;
  const [dx, dy] = dir;
  if (dx === SPIRAL_JUMP) return 0; // right
  if (dy === SPIRAL_JUMP) return 1; // down
  if (dx === -SPIRAL_JUMP) return 2; // left
  return 3; // up
}

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
            const d = dirIndex(frame.meta?.direction);
            const dirPhase = (d / 4) * Math.PI * 2;

            // Direction phase keeps the 4-zone structure; spiral index
            // and grid position add per-cell offsets so waves roll
            // through each direction stripe instead of zones changing
            // in lockstep.
            const colorIndex0 = (Math.cos(time * 4 + dirPhase + i * 0.012) + 1) * 0.5;
            const colorIndex1 = (Math.sin(time * 6 + dirPhase * 1.5 + frame.x * 0.06 + frame.y * 0.04) + 1) * 0.5;

            p.fill(1, colorIndex0, colorIndex1);
            p.rect(frame.x * cellPx + padding, frame.y * cellPx + padding, cellPx - gutter, cellPx - gutter);
          }
        }}
      />
    </Area>
  );
}
