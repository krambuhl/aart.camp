'use client';

import type { P5Color } from '@/types/p5';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const size = 512;

export const meta = {
  title: 'Splitting Stars',
  date: '2022-05-14T00:00:00',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
          <Sketch
            setup={(p, store) => {
              p.createCanvas(size, size, p.WEBGL);
              p.colorMode(p.HSL);

              store.history = Array(960 * 2)
                .fill(null)
                .map((_, i) => i);
            }}
            draw={(p, store) => {
              // reset
              p.clear(...baseBg);
              p.noStroke();

              const start = p.frameCount / 500;
              const length = store.history.length;

              const sin1 = p.norm(Math.sin(start / 100), -1, 1);
              // const sin2 = p.norm(Math.sin(start / 10), -1, 1)
              // const sin3 = p.norm(Math.sin(start / 1), -1, 1)
              // const sin4 = p.norm(Math.sin(start * 10), -1, 1)
              // const cos1 = p.norm(Math.cos(start / 100), -1, 1)
              // const cos2 = p.norm(Math.cos(start / 10), -1, 1)
              const cos3 = p.norm(Math.cos(start / 1), -1, 1);
              const cos4 = p.norm(Math.cos(start * 10), -1, 1);

              for (let i = 0; i < length; i++) {
                const pos = i / length;

                const spin1 = Math.sin((pos - 0.5) * (180 / Math.PI));
                const spin2 = Math.sin((pos - 0.5) * (120 / Math.PI));

                const input = ((start - i) / Math.PI) * p.lerp(1, 4, sin1) + 0;

                const x =
                  Math.sin(input) * (size / p.lerp(3.5, 4, 1 - cos4)) +
                  // (size / p.lerp(6, size / 4, sin4 * 0.1)) * spin2 +
                  // (size / p.lerp(8, size, sin3 * 0.1)) * spin2 +
                  (size / 16) * spin2 +
                  spin1 * (size / 64) +
                  // (sin1 - 0.5) * (size / 8) * p.norm(spin2, -1, 1) +
                  0;
                const y =
                  Math.cos(input) * (size / p.lerp(3.5, 4, 1 - cos4)) +
                  (size / p.lerp(6, size / 8, cos3 * 0.1)) * spin2 * spin1 +
                  spin2 * (size / 32) +
                  // (cos1 - 0.5) * (size / 8) * p.norm(spin2, -1, 1) +
                  0;

                p.fill(p.color(p.lerp(90, 300, Math.sin(pos * Math.PI * 32)), 90, 60));
                p.circle(x, y, p.lerp(4, 8, p.norm(Math.cos(pos * Math.PI * 2), -1, 1)));
              }
            }}
          />
        </Area>
  );
}
