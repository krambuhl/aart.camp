'use client';

import type { P5Color } from '@/types/p5';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange } from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Robot Thought 2 — Chorus',
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
        // reset
        p.clear(...bgColor);

        const t = p.frameCount / 24;
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

          // musical chords in space: layered partials
          const fundamental = ns(x * 0.35 + t * 1.2);
          const third = ns(y * 0.27 + t * 0.8 + 2.094);
          const fifth = ns((x + y) * 0.18 + t * 1.6 + 4.188);
          const harmony = (fundamental * 0.5 + third * 0.3 + fifth * 0.2);

          // walked cells sing a little louder
          const walkedBias = cellData.walked ? 0.12 : -0.04;
          const mix = Math.max(0, Math.min(1, harmony + walkedBias));

          let c = lerpPalette(p, palette, mix);
          // gentle contrast bump for walked/unwalked
          const accent = p.color(cellData.walked ? '#ffffff' : '#000000');
          c = p.lerpColor(c, accent, 0.04);
          p.fill(c);

          p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
        }
      }}
    />
  </Area>
  );
}
