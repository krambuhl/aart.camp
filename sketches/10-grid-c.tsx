'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { rainbow } from '@/data/colorMaps';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 512;

const sides = 29;
const padding = 32;
const offset = 2;

const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Grid C',
  date: '2022-10-02T00:00:02',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p, store) => {
          p.createCanvas(canvasSize, canvasSize, p.WEBGL);
          p.colorMode(p.HSL);

          const cells = Array(sides ** 2)
            .fill(null)
            .map((_, i) => ({
              x: i % sides,
              y: Math.floor(i / sides),
            }));

          store.set('cells', cells);
          store.set('cellCount', cells.length);
        }}
        draw={(p, store) => {
          // reset
          p.clear(...baseBg);
          p.noStroke();

          const start = p.frameCount;
          const length = store.get('cellCount');

          for (let i = 0; i < length; i++) {
            const pos = store.get('cells')[i];
            const time = start / 20000;

            const x = pos.x / time;
            const y = pos.y / (pos.x + 1);

            const color = (x + offset) * (y + offset);

            p.fill(p.color(rainbow[Math.floor(color % rainbow.length)]));
            p.rect((pos.x - sides / 2) * size, (pos.y - sides / 2) * size, size, size);
          }
        }}
      />
    </Area>
  );
}
