'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { BlueVelvet, DeepSea, Fjord, YellowCab } from '@/data/paint';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Haneda Night — Neon Descent',
  date: '2026-04-30T00:00:00',
};

// Landing approach into Tokyo, after dark. The city laid out below as
// noise-driven density, scattered with the flicker of neon signs and
// the steady pulse of a runway streak.

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
          const loopFrames = 240;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          const cityPalette = ['#040612', BlueVelvet, DeepSea, Fjord];
          const neonPalette = [Magenta, SoftPink, Cyan, YellowCab];

          // runway streak position (horizontal band, slightly off-center)
          const runwayY = Math.floor(steps * 0.62);
          const runwayPulse = 0.5 + 0.5 * Math.cos(time * 2);

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              // gentle perlin "city density" + slow drift
              const nx = fx * 0.07 + Math.cos(time) * 0.3;
              const ny = fy * 0.07 + Math.sin(time) * 0.3;
              const density = p.noise(nx, ny);

              // base city color — darkest where density is low, deeper blues otherwise
              let c = lerpPalette(p, cityPalette, density);

              // glow pockets: where density > threshold, splash neon
              if (density > 0.58) {
                const phase = (fx * 0.21 + fy * 0.13 + time * 0.5) % 1;
                const neon = lerpPalette(p, neonPalette, phase);
                const mix = Math.min(1, (density - 0.58) * 3);
                c = p.lerpColor(c, neon, mix * 0.85);
              }

              // sparkle: a few cells flick on/off per frame
              const sparkle = hash2(fx + Math.floor(time * 4), fy);
              if (sparkle > 0.985) {
                c = p.color('#FFFFFF');
              }

              // runway streak: bright cells along a horizontal line, pulsing
              if (fy === runwayY && fx > steps * 0.18 && fx < steps * 0.82) {
                const along = (fx - steps * 0.18) / (steps * 0.64);
                const taper = Math.sin(along * Math.PI);
                c = p.lerpColor(c, p.color(YellowCab), Math.min(1, taper * (0.4 + runwayPulse * 0.6)));
              }

              p.fill(c);
              p.rect(fx * cell + padding, fy * cell + padding, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
