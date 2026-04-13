'use client';

import type { P5Color } from '@/types/p5';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange } from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Robot Thought 8 — Cardinal Drift',
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
          const { cell: [fx, fy] } = cellData;
          const x = fx - cx;
          const y = fy - cy;
          const posX = fx * sizeX;
          const posY = fy * sizeY;

          const theta = Math.atan2(y, x) + time * 0.25; // drifting cardinals
          const cardinal = Math.pow(0.5 + 0.5 * Math.cos(2 * theta), 1.6); // 4-fold symmetry

          // manhattan rings as gentle chevrons
          const md = Math.abs(x) + Math.abs(y);
          const rings = 0.5 + 0.5 * Math.cos(md * 0.4 - time * 1.2);

          const cadence = ((fx % 3) + (fy % 3)) / 6; // soft grid cadence
          const field = p.noise(fx * 0.055 + time * 0.22, fy * 0.055 - time * 0.2) * 0.08;

          const base = 0.5 * cardinal + 0.3 * rings + 0.2 * cadence;
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

