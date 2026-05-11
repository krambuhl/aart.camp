'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BlueVelvet, DeepSea, Fjord, YellowCab } from '@/data/paint';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Neon Descent',
  date: '2026-04-30T00:00:00',
};

// Landing approach into Tokyo, after dark — beer-drunk at 2am. The
// city below isn't laid out neatly; it warps. Coordinates pulse, the
// grid itself ripples, the runway snakes instead of running straight.

const bgColor: P5Color = [4 / 255, 6 / 255, 18 / 255, 255]; // ink-blue night
const canvasSize = 1280;
const padding = 40;
const gutter = -0.5;
const steps = 61;
const cell = (canvasSize - padding * 2) / steps;

const Magenta = '#FF2BB5';
const Cyan = '#22E3FF';
const SoftPink = '#FFA1E0';

function lerpPalette(p: any, palette: string[], t: number) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  const scaled = clamped * (palette.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const frac = scaled - i0;
  return p.lerpColor(p.color(palette[i0]), p.color(palette[i1]), frac);
}

// stable per-cell hash for sparkles
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
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
          // 30-second loop. All time multipliers are integers so the warp
          // returns to its starting frame exactly at u = 1.
          const loopFrames = 1800;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          const cityPalette = ['#040612', BlueVelvet, DeepSea, Fjord];
          const neonPalette = [Magenta, SoftPink, Cyan, YellowCab];

          // Warp amplitudes pulse fast — vision swimming in and out of focus.
          const warpAmp = 0.7 + 0.5 * Math.sin(time * 30);
          const swayAmp = 0.4 + 0.3 * Math.cos(time * 24);

          // Pixel-level jitter for the grid itself — cells visibly ripple.
          const jitterPx = cell * 0.35;

          // Snake runway: y position wobbles along fx, plus shifts over time.
          const runwayBase = Math.floor(steps * 0.62);
          const runwayPulse = 0.5 + 0.5 * Math.cos(time * 30);

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              // Domain warp — each cell samples noise at a wavily-displaced point.
              const wx = fx * 0.07 + warpAmp * Math.sin(time * 20 + fy * 0.22);
              const wy = fy * 0.07 + warpAmp * Math.cos(time * 24 + fx * 0.18);

              // Big city density + a faster flicker layer mixed in.
              const big = p.noise(wx, wy);
              const fast = p.noise(wx * 2.4 + 13, wy * 2.4 + 7 + time * 16);
              const density = big * 0.7 + fast * 0.3;

              // base city color — darkest where density is low
              let c = lerpPalette(p, cityPalette, density);

              // glow pockets bleed wider, neon hue scrolls
              if (density > 0.5) {
                const phase = (fx * 0.21 + fy * 0.13 + time * 12 + Math.sin(time * 18 + fy * 0.2) * 0.3) % 1;
                const neon = lerpPalette(p, neonPalette, (phase + 1) % 1);
                const mix = Math.min(1, (density - 0.5) * 2.5);
                c = p.lerpColor(c, neon, mix * 0.9);
              }

              // sparkle: floor(u*N) cycles cleanly 0..N-1 over the loop
              const sparkle = hash2(fx + Math.floor(u * 150), fy + Math.floor(u * 90));
              if (sparkle > 0.982) {
                const tint = sparkle > 0.992 ? p.color('#FFFFFF') : p.color(neonPalette[(fx + fy) % neonPalette.length]);
                c = tint;
              }

              // snake runway — Y bends with fx and time
              const snakeY = runwayBase + Math.round(2.6 * Math.sin(fx * 0.22 + time * 30));
              if (fy === snakeY && fx > steps * 0.16 && fx < steps * 0.84) {
                const along = (fx - steps * 0.16) / (steps * 0.68);
                const taper = Math.sin(along * Math.PI);
                c = p.lerpColor(c, p.color(YellowCab), Math.min(1, taper * (0.45 + runwayPulse * 0.55)));
              }

              // visual jitter — the grid ripples like heat / a tipsy frame.
              const jitX = jitterPx * Math.sin(time * 24 + fy * 0.32);
              const jitY = jitterPx * Math.cos(time * 20 + fx * 0.28) * (0.4 + 0.6 * swayAmp);

              p.fill(c);
              p.rect(fx * cell + padding + jitX, fy * cell + padding + jitY, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
