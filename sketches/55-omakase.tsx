'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Omakase',
  date: '2026-04-30T00:00:00',
};

// Sushi platter as a Voronoi-ish cluster of color regions. Sixteen
// seeds drift slowly on a 4×4 grid; each seed cycles through the
// palette with a phase offset, so the whole plate morphs without ever
// repeating the same arrangement quickly. The plate itself responds
// to the wall-clock time of day — bright rice at noon, dark teak at
// midnight, with golden warmth around dawn and dusk.

const canvasSize = 1280;
const padding = 40;
const gutter = -0.5;
const steps = 61;
const cell = (canvasSize - padding * 2) / steps;

// Even palette of fresh tones — dropped nori and soy from earlier so
// regions sit at similar luminance.
const Salmon = '#F58A6F';
const Tuna = '#B22A2A';
const Hamachi = '#F2D4A0';
const Tamago = '#F5C242';
const Ikura = '#FF7A3D';
const Wasabi = '#90B14C';
const palette = [Salmon, Tuna, Hamachi, Tamago, Ikura, Wasabi];

// Sixteen seeds on an even 4×4 grid, all with identical drift amplitude
// and phase-staggered timing. Even spatial scale + even color rotation.
const seedCount = 16;
const driftAmp = 0.14;
const seeds = Array.from({ length: seedCount }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    ax: (col + 0.5) / 4,
    ay: (row + 0.5) / 4,
    phase: (i / seedCount) * Math.PI * 2,
  };
});

function lerpPalette(p: any, pal: string[], t: number) {
  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * pal.length;
  const i0 = Math.floor(scaled) % pal.length;
  const i1 = (i0 + 1) % pal.length;
  const frac = scaled - Math.floor(scaled);
  return p.lerpColor(p.color(pal[i0]), p.color(pal[i1]), frac);
}

// Wall-clock time of day mapped to 0 (midnight) → 1 (noon), sinusoidal.
function timeOfDayBrightness() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return 0.5 + 0.5 * Math.cos((h / 24 - 0.5) * Math.PI * 2);
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
          // Long loop — 30 seconds at 60fps. Plate keeps changing for
          // a long time before any pattern repeats.
          const loopFrames = 1800;
          const u = (p.frameCount % loopFrames) / loopFrames;
          const time = u * Math.PI * 2;

          // Time of day controls the plate and the overall light.
          const tod = timeOfDayBrightness();
          const dayPlate = p.color('#FAF5EB'); // bright rice
          const nightPlate = p.color('#15110D'); // dark teak
          const plate = p.lerpColor(nightPlate, dayPlate, tod);
          p.background(plate);

          // Each seed: drift on a lissajous (integer time multipliers so
          // the loop is seamless), color phase rotates over the loop.
          const placed = seeds.map((s, i) => ({
            x: s.ax + driftAmp * Math.cos(time + s.phase),
            y: s.ay + driftAmp * Math.sin(time * 2 + s.phase * 1.3),
            colorT: u + i / seedCount,
          }));

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              const nx = (fx + 0.5) / steps;
              const ny = (fy + 0.5) / steps;

              // nearest seed (Voronoi)
              let best = 0;
              let bestDist = Infinity;
              for (let i = 0; i < placed.length; i++) {
                const dx = placed[i].x - nx;
                const dy = placed[i].y - ny;
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                  bestDist = d;
                  best = i;
                }
              }

              // morphing color: lerp through palette by seed's phase
              let c = lerpPalette(p, palette, placed[best].colorT);

              // time-of-day tint: at night, blend toward plate
              const dimmed = p.lerpColor(plate, c, 0.35 + tod * 0.6);
              c = dimmed;

              // thin plate seam at region boundaries
              let secondDist = Infinity;
              for (let i = 0; i < placed.length; i++) {
                if (i === best) continue;
                const dx = placed[i].x - nx;
                const dy = placed[i].y - ny;
                const d = dx * dx + dy * dy;
                if (d < secondDist) secondDist = d;
              }
              const edge = Math.sqrt(secondDist) - Math.sqrt(bestDist);
              const seamMix = edge < 0.012 ? 0.45 : 1;
              const blended = p.lerpColor(plate, c, seamMix);

              p.fill(blended);
              p.rect(fx * cell + padding, fy * cell + padding, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
