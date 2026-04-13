import { Sketch } from '@/components/app/Sketch';
import type { GridSketchProps } from './types';

export function GridSketch({ bg, canvasSize, sides, padding, fill }: GridSketchProps) {
  const size = (canvasSize - padding * 2) / sides;

  return (
    <Sketch
      setup={(p, store) => {
        p.createCanvas(canvasSize, canvasSize, p.WEBGL);
        p.colorMode(p.HSL);
        p.clear(...bg);

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
        p.clear(...bg);
        p.noStroke();

        const length = store.get('cellCount');

        for (let i = 0; i < length; i++) {
          const pos = store.get('cells')[i];
          const color = fill(pos, p.frameCount);

          p.fill(p.color(color));
          p.rect((pos.x - sides / 2) * size, (pos.y - sides / 2) * size, size, size);
        }
      }}
    />
  );
}
