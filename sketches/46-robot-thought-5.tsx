'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BloodOrange, BlueVelvet, Lavender, Malachite, Orangina, SkyBlue, YellowCab } from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Fern Memory',
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

const ns = (x: number) => 0.5 + 0.5 * Math.sin(x);

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

            const r = Math.hypot(x, y);
            const theta = Math.atan2(y, x);

            // fern-like veins: radial stripes modulated by spiral phase
            const petalBands = 7; // vein count
            const radial = ns(r * 0.28 - time * 1.2);
            const veins = Math.abs(Math.sin(theta * petalBands + r * 0.22 - time * 0.8));
            const structure = 0.55 * radial + 0.45 * (1 - veins);

            const field = p.noise(fx * 0.07 + time * 0.25, fy * 0.07 - time * 0.2) * 0.12;
            const walkedBias = cellData.walked ? 0.12 : -0.02;
            const t = Math.max(0, Math.min(1, structure + field + walkedBias));

            let c = lerpPalette(p, palette, t);
            c = p.lerpColor(c, p.color('#001a00'), 0.03);
            p.fill(c);

            p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
          }
        }}
      />
    </Area>
  );
}
