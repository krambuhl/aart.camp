'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BloodOrange, Brick, RoyalRed, White } from '@/data/paint';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'JAL Crane',
  date: '2026-04-30T00:00:00',
};

// JAL's tsuru: red on cream, a single icon turning slowly.
// 8-feather radial fan, breathing in and out at the boarding gate.

const bgColor: P5Color = [255 / 255, 246 / 255, 224 / 255, 255]; // cream
const canvasSize = 1280;
const padding = 40;
const gutter = -0.5;
const steps = 61;
const cell = (canvasSize - padding * 2) / steps;

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
          // 30-second loop at 60fps — every time multiplier below is an
          // integer so the loop is perfectly seamless.
          const loopFrames = 1800;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          const palette = ['#FFF6E0', White, '#F2C8B7', BloodOrange, Brick, RoyalRed];
          const cx = steps / 2;
          const cy = steps / 2;
          const maxDist = Math.hypot(cx, cy);

          // Breathing scale: blooms outward then pulls back to a tighter core.
          // 3 breaths per loop = ~10s per breath.
          const breath = 0.5 + 0.5 * Math.cos(time * 3);
          const reach = 0.85 + 0.55 * breath; // 0.85..1.4

          // hue drift: warm pink → red → maroon over the cycle
          const hueShift = Math.sin(time);

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              const x = fx - cx + 0.5;
              const y = fy - cy + 0.5;
              const r = Math.hypot(x, y);
              const rn = Math.min(1, r / maxDist);
              const theta = Math.atan2(y, x);

              // 8 feathers, integer rotation rate (16 petal-shifts per loop)
              const fan = (Math.cos(8 * theta + time * 16) + 1) * 0.5;

              // radial mask: dense at center, fades to cream at edge; reach breathes
              const mask = Math.max(0, 1 - rn / reach) ** 1.4;

              // wing fold: thin "spine" line, also breathes
              const spine = Math.exp(-Math.abs(x) * (0.5 + 0.3 * (1 - breath))) * (1 - rn);

              const base = fan * mask * 0.9 + spine * 0.4;
              const intensity = Math.max(0, Math.min(1, base + hueShift * 0.08 * mask));

              p.fill(lerpPalette(p, palette, intensity));
              p.rect(fx * cell + padding, fy * cell + padding, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
