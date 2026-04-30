'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { Brick, RoyalRed, YellowCab } from '@/data/paint';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Engimono — Good Luck',
  date: '2026-04-30T00:00:00',
};

// Engimono are good-luck charms. A mandala of crimson and gold —
// concentric petal rings turning past each other. For the birthday,
// for the trip, for what comes next.

const bgColor: P5Color = [122 / 255, 26 / 255, 30 / 255, 255]; // crimson ground
const canvasSize = 1280;
const padding = 40;
const gutter = -0.5;
const steps = 61;
const cell = (canvasSize - padding * 2) / steps;

const Ivory = '#FBEFD9';
const DeepCrimson = '#5A0F18';

function lerpPalette(p: any, palette: string[], t: number) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  const scaled = clamped * (palette.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const frac = scaled - i0;
  return p.lerpColor(p.color(palette[i0]), p.color(palette[i1]), frac);
}

export default function Output() {
  return (
    <Area width={tokens.size.x640}>
      <Sketch
        aspectRatio={1}
        setup={(p) => {
          p.createCanvas(canvasSize, canvasSize);
          p.noStroke();
        }}
        draw={(p) => {
          p.clear(...bgColor);
          const loopFrames = 300;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          const palette = [DeepCrimson, RoyalRed, Brick, YellowCab, Ivory];
          const cx = steps / 2;
          const cy = steps / 2;
          const maxDist = Math.hypot(cx, cy);

          // 6 concentric rings; alternate rings spin opposite directions.
          // The whole mandala also breathes radially.
          const rings = 6;
          const breath = 0.5 + 0.5 * Math.cos(time);
          const ringShift = 0.06 * Math.sin(time * 2); // ring boundaries pulse

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              const x = fx - cx + 0.5;
              const y = fy - cy + 0.5;
              const r = Math.hypot(x, y);
              const rn = Math.min(0.999, r / maxDist);
              const theta = Math.atan2(y, x);

              // shifting radius — bands drift in/out
              const rShifted = Math.min(0.999, Math.max(0, rn + ringShift));
              const ringIdx = Math.floor(rShifted * rings);
              const ringPhase = rShifted * rings - ringIdx; // 0..1 within ring
              const dir = ringIdx % 2 === 0 ? 1 : -1;
              const petals = 6 + ringIdx * 2;

              // petal pattern with strong rotation
              const petal = (Math.cos(petals * theta + dir * time * 3 + ringIdx * 0.7) + 1) * 0.5;

              // ring band, modulated by breath so the mandala swells
              const band = Math.sin(ringPhase * Math.PI) ** (1 + 0.5 * (1 - breath));

              // gold ribbons every other ring carry stronger ivory/gold
              const isGold = ringIdx % 2 === 1;
              const intensity = petal * band;
              const tBase = isGold
                ? 0.55 + intensity * 0.45 // pushes toward gold/ivory
                : intensity * 0.55; // stays in crimson territory

              // shimmer: a slow global hue wash riding over the mandala
              const shimmer = 0.08 * Math.sin(time + theta * 2 + rn * 4);

              p.fill(lerpPalette(p, palette, Math.max(0, Math.min(1, tBase + shimmer))));
              p.rect(fx * cell + padding, fy * cell + padding, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
