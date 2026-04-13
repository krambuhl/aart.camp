'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const size = 512;

export const meta = {
  title: 'Back to the Third Dimension',
  date: '2022-10-05T00:00:00',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p, store) => {
          p.createCanvas(size, size, p.WEBGL);
          p.colorMode(p.HSL);

          store.history = Array(1280 * 4)
            .fill(null)
            .map((_, i) => i);
        }}
        draw={(p, store) => {
          // reset
          p.clear(...baseBg);
          p.noStroke();

          const start = p.frameCount;
          const length = store.history.length;

          for (let i = 0; i < length; i++) {
            const offset = store.history[i];
            const time = start / 1000;
            const input = (start - offset) / p.lerp(30, 45, p.norm(Math.sin(time), -1, 1));

            const x = Math.sin(input / 20) * (Math.cos(time * 40) * (size / 9)) + Math.sin(i) * (size / 4);
            const y = Math.cos(input / 20) * (Math.sin(time * 40) * (size / 9)) + Math.cos(i) * (size / 4);

            p.fill(p.color(p.lerp(90, 300, (i % length) / length), 90, 60));
            p.circle(x, y, p.lerp(4, 0, (i % length) / length));
          }
        }}
      />
    </Area>
  );
}
