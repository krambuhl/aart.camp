'use client';

import { GridSketch } from '@/components/app/GridSketch';
import { Area } from '@/components/shared/Area';
import { rainbow } from '@/data/colorMaps';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Grid D',
  date: '2022-10-03T00:00:00',
};

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
    <GridSketch
      bg={[0 / 255, 0 / 255, 0 / 255, 255]}
      canvasSize={512}
      sides={29}
      padding={32}
      fill={(pos, frame) => {
        const time = frame / 250;

        const x = pos.x + time;
        const y = pos.y;

        const colorIndex = x ^ (y - x * time);

        return rainbow[Math.floor(Math.abs(colorIndex) % rainbow.length)];
      }}
    />
  </Area>
  );
}
