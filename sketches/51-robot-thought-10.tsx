'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BloodOrange, BlueVelvet, Lavender, Malachite, Orangina, SkyBlue, YellowCab } from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Robot Thought 10 — Cardinal Weave',
  date: '2025-09-02T00:00:00',
};

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const ratio = 1 / 1; // square
const canvasSizeX = 1280;
const canvasSizeY = 1280 * ratio;

const padding = 40;
const gutter = -0.5;

const stepsX = 61;
const stepsY = 61;
const sizeX = (canvasSizeX - padding * 2) / stepsX;
const sizeY = (canvasSizeY - padding * 2) / stepsY;

const grid = createRandomWalkerGrid({
  gridSize: [stepsX, stepsY],
  initialCell: [0, 0],
});

function lerpPalette(p: any, palette: string[], t: number) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  const scaled = clamped * (palette.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const frac = scaled - i0;
  const c0 = p.color(palette[i0]);
  const c1 = p.color(palette[i1]);
  return p.lerpColor(c0, c1, frac);
}

export default function Output() {
  return (
    <Area width={tokens.size.x640}>
      <Sketch
        aspectRatio={1}
        setup={(p) => {
          p.createCanvas(canvasSizeX, canvasSizeY);
          p.noStroke();
          p.colorMode(p.HSL, 360, 100, 100, 1);
        }}
        draw={(p) => {
          p.clear(...bgColor);
          const time = p.frameCount / 24;
          const palette = [BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange];
          const cx = stepsX / 2;
          const cy = stepsY / 2;

          for (const cellData of grid) {
            const {
              cell: [fx, fy],
            } = cellData;
            const x = fx - cx;
            const y = fy - cy;
            const posX = fx * sizeX;
            const posY = fy * sizeY;

            const theta = Math.atan2(y, x);

            // weave: two diagonal bands crossing, animated
            const diagA = 0.5 + 0.5 * Math.sin((x + y) * 0.4 + time * 1.6);
            const diagB = 0.5 + 0.5 * Math.cos((x - y) * 0.4 - time * 1.3);
            const weave = 0.55 * diagA + 0.45 * diagB;

            // cardinal emphasis (4-fold) to echo Thought 4
            const cardinal = (0.5 + 0.5 * Math.cos(2 * theta - time * 0.4)) ** 1.8;

            // grid cadence for structure + light noise for texture
            const cadence = ((fx % 4) + (fy % 4)) / 8;
            const field = p.noise(fx * 0.05 + time * 0.26, fy * 0.05 - time * 0.22) * 0.06;

            const base = 0.5 * weave + 0.3 * cardinal + 0.2 * cadence;
            const walkedBias = cellData.walked ? 0.08 : -0.02;
            const t = Math.max(0, Math.min(1, base + field + walkedBias));

            const c = lerpPalette(p, palette, t);
            p.fill(c);

            p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
          }
        }}
      />
    </Area>
  );
}
