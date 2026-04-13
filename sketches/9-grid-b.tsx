'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { rainbow } from '@/data/colorMaps';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 512;

// const sides = 41 * 1
// const padding = 32
// const offset = 0

const sides = 29;
const padding = 32;
const offset = 2;

const gutter = -0.5;
const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Grid B',
  date: '2022-10-02T00:00:01',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p, store) => {
          p.createCanvas(canvasSize, canvasSize, p.WEBGL);
          p.colorMode(p.HSL);

          store.frames = Array(sides ** 2)
            .fill(null)
            .map((_, i) => ({
              x: i % sides,
              y: Math.floor(i / sides),
            }));
        }}
        draw={(p, store) => {
          // reset
          p.clear(...baseBg);
          p.noStroke();

          const start = p.frameCount;
          const length = store.frames.length;

          for (let i = 0; i < length; i++) {
            const pos = store.frames[i];
            const time = start / 2000;

            const x = pos.x / (pos.y + 1) + time * pos.x;
            const y = pos.y / (pos.x + 1) + time * pos.y;

            const color = (x + offset) * (y + offset);

            p.fill(p.color(rainbow[Math.floor(color % rainbow.length)]));
            p.rect((pos.x - sides / 2) * size, (pos.y - sides / 2) * size, size - gutter, size - gutter);
          }
        }}
      />
    </Area>
  );
}
