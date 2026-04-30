'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Omakase',
  date: '2026-04-30T00:00:00',
};

// Sushi platter as a Voronoi-ish cluster of color regions. Each "piece"
// is a drifting seed in cell-space; cells take the color of their
// nearest seed. Slow drift = chef rearranging in front of you.

const bgColor: P5Color = [250 / 255, 245 / 255, 235 / 255, 255]; // rice/plate
const canvasSize = 1280;
const padding = 40;
const gutter = -0.5;
const steps = 61;
const cell = (canvasSize - padding * 2) / steps;

// sushi palette
const Salmon = '#F58A6F';
const Tuna = '#B22A2A';
const Hamachi = '#F2D4A0';
const Tamago = '#F5C242';
const Ikura = '#FF7A3D';
const Wasabi = '#90B14C';
const Nori = '#1F3327';
const Soy = '#3E2412';
const Rice = '#FAF5EB';

const palette = [Salmon, Tuna, Hamachi, Tamago, Ikura, Wasabi, Nori, Soy, Rice];

// Sixteen drifting seeds in normalized cell-space — packed plate.
const seeds = [
  { ax: 0.14, ay: 0.18, dx: 0.05, dy: 0.06, color: 0 }, // salmon
  { ax: 0.36, ay: 0.12, dx: 0.06, dy: 0.05, color: 1 }, // tuna
  { ax: 0.62, ay: 0.18, dx: 0.05, dy: 0.07, color: 2 }, // hamachi
  { ax: 0.86, ay: 0.22, dx: 0.06, dy: 0.05, color: 3 }, // tamago
  { ax: 0.18, ay: 0.4, dx: 0.07, dy: 0.05, color: 4 }, // ikura
  { ax: 0.42, ay: 0.42, dx: 0.05, dy: 0.07, color: 5 }, // wasabi
  { ax: 0.66, ay: 0.4, dx: 0.06, dy: 0.06, color: 6 }, // nori
  { ax: 0.88, ay: 0.46, dx: 0.05, dy: 0.06, color: 0 }, // salmon
  { ax: 0.16, ay: 0.66, dx: 0.06, dy: 0.05, color: 7 }, // soy
  { ax: 0.4, ay: 0.7, dx: 0.05, dy: 0.06, color: 1 }, // tuna
  { ax: 0.62, ay: 0.66, dx: 0.07, dy: 0.06, color: 3 }, // tamago
  { ax: 0.84, ay: 0.7, dx: 0.05, dy: 0.07, color: 5 }, // wasabi
  { ax: 0.24, ay: 0.88, dx: 0.06, dy: 0.05, color: 2 }, // hamachi
  { ax: 0.5, ay: 0.9, dx: 0.07, dy: 0.05, color: 6 }, // nori
  { ax: 0.76, ay: 0.88, dx: 0.05, dy: 0.06, color: 4 }, // ikura
  { ax: 0.5, ay: 0.5, dx: 0.08, dy: 0.07, color: 1 }, // tuna (center)
];

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

          // animate seed positions in a closed loop (lissajous)
          const placed = seeds.map((s, i) => ({
            x: s.ax + s.dx * Math.cos(time + i * 0.7),
            y: s.ay + s.dy * Math.sin(time * 1.1 + i * 0.5),
            color: s.color,
          }));

          for (let fy = 0; fy < steps; fy++) {
            for (let fx = 0; fx < steps; fx++) {
              const nx = (fx + 0.5) / steps;
              const ny = (fy + 0.5) / steps;

              // find nearest seed
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

              // crisp regions, subtle edge softening at boundary
              const c = p.color(palette[placed[best].color]);

              // rice background pokes through near edges between regions
              // (find second-nearest, blend if very close to first)
              let secondDist = Infinity;
              for (let i = 0; i < placed.length; i++) {
                if (i === best) continue;
                const dx = placed[i].x - nx;
                const dy = placed[i].y - ny;
                const d = dx * dx + dy * dy;
                if (d < secondDist) secondDist = d;
              }
              const edge = Math.sqrt(secondDist) - Math.sqrt(bestDist);
              const seam = edge < 0.012 ? 0.5 : 1; // thin rice seam
              const blended = p.lerpColor(p.color(Rice), c, seam);

              p.fill(blended);
              p.rect(fx * cell + padding, fy * cell + padding, cell - gutter, cell - gutter);
            }
          }
        }}
      />
    </Area>
  );
}
