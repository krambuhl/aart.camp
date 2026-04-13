'use client';

import type { P5Color } from '@/types/p5';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange } from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Robot Thought 11 — Gyre',
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
        // loop-friendly time: exact seamless cycle
        const loopFrames = 720; // ~12s at 60fps
        const u = (p.frameCount % loopFrames) / loopFrames; // 0..1
        const time = u * Math.PI * 2; // 0..2π
        const palette = [BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange];
        const cx = stepsX / 2;
        const cy = stepsY / 2;
        const maxDist = Math.hypot(cx, cy);

        for (const cellData of grid) {
          const { cell: [fx, fy] } = cellData;
          const x = fx - cx;
          const y = fy - cy;
          const posX = fx * sizeX;
          const posY = fy * sizeY;

          const r = Math.hypot(x, y);
          const rn = Math.min(1, r / maxDist);
          const theta = Math.atan2(y, x);

          // unique spin: golden-angle twist + variable lobes + chirality drift (all periodic)
          const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
          const chirality = Math.sin(time * 0.6); // -1..1 over loop
          const twist = 0.8 + 0.4 * chirality; // gentle change in twist
          const swirl = theta + rn * twist + Math.sin(time) * 0.35 + rn * 0.3 * phi;
          const lobes = 6 + 2 * Math.sin(time * 0.5 + rn * 1.5); // morphing lobe count, loops cleanly
          const sectors = Math.pow(0.5 + 0.5 * Math.cos(lobes * swirl), 2.1);

          // logarithmic spiral rings for distinct motion (use phase for perfect loop)
          const rings = 0.5 + 0.5 * Math.cos(Math.log(1 + r * 0.5) * 3.2 - time * 1.0 + rn * phi);

          // gentle grid cadence and perfectly looping noise (circular path in noise space)
          const cadence = ((fx % 4) + (fy % 4)) / 8;
          const nPhaseX = Math.cos(time) * 0.8;
          const nPhaseY = Math.sin(time) * 0.8;
          const field = p.noise(fx * 0.05 + nPhaseX, fy * 0.05 + nPhaseY) * 0.04;

          const base = 0.5 * sectors + 0.35 * rings + 0.15 * cadence;
          const walkedBias = cellData.walked ? 0.06 : -0.02;
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
