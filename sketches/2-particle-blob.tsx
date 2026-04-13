'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
import { tokens } from 'tokens';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const size = 512;

export const meta = {
  title: 'Particle Blob',
  date: '2022-04-05',
};

export default function ALittleSomething() {
  return (
    <Area width={tokens.size.x768}>
    <Sketch
      setup={(p, store) => {
        p.createCanvas(size, size, p.WEBGL);
        p.colorMode(p.HSL);

        store.history = Array(377 * 2)
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
          const pos = i / length;
          const offset = store.history[i];
          const input = (start - offset) / 60;

          p.fill(
            p.lerpColor(
              p.lerpColor(p.color(0, 100, 60), p.color(80, 100, 60), Math.sin(input / 2)),
              p.lerpColor(p.color(200, 100, 60), p.color(270, 100, 60), Math.cos(input / 2)),
              (Math.tan(pos * (Math.PI * 2)) + 1) / 2
            )
          );
          p.circle(
            Math.sin(input) * (size / 6) +
              Math.cos(offset) *
                (size /
                  p.lerp(
                    6,
                    p.lerp(5, 12, Math.cos(pos)),
                    (Math.cos((offset * i) / 40) * Math.tan((i * offset) / 60)) /
                      p.lerp(2, 4, Math.sin(input / 30))
                  )),
            Math.cos(input) * (size / 6) +
              Math.sin(offset) *
                (size /
                  p.lerp(
                    6,
                    p.lerp(5, 14, Math.sin(pos)),
                    (Math.sin((offset * i) / 40) * Math.tan((i * offset) / 60)) /
                      p.lerp(2, 4, Math.sin(input / 30))
                  )) +
              pos * 36,
            p.lerp(8, 12, Math.sin(i * pos) * Math.cos(i))
          );
        }
      }}
    />
  </Area>
  );
}
