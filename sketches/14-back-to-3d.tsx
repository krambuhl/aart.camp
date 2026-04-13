'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

// import { rainbow } from '@/data/colorMaps'

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const size = 512;

export const meta = {
  title: 'Back to 3d',
  date: '2022-10-06T00:00:00',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p, store) => {
          p.createCanvas(size, size, p.WEBGL);
          p.colorMode(p.HSL);

          store.history = Array(1280 * 8)
            .fill(null)
            .map((_, i) => i);
        }}
        draw={(p, store) => {
          // reset
          p.clear(...baseBg);
          p.noStroke();

          const start = -p.frameCount + 40000;
          const length = store.history.length;

          for (let i = 0; i < length; i++) {
            const pos = i / length;
            const time = start / 400;

            const x = Math.sin(time * pos * 8) * (size / (pos * p.lerp(0, 4, p.norm(Math.sin(pos), -1, 1)))) + Math.sin(time * pos) * 4;
            const y = Math.cos(time * pos * 8) * (size / (pos * p.lerp(0, 8, p.norm(Math.cos(pos), -1, 1)))) + Math.cos(time * pos) * time;

            p.fill(p.color(p.lerp(0, 340, pos), 90, 60));
            p.circle(x, y, p.lerp(-8, 8, pos));
          }
        }}
      />
    </Area>
  );
}
