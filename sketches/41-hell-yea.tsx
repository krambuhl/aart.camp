'use client';

import type { P5Color } from '@/types/p5';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import {
  Black,
  White,
  Viola,
  Lavender,
  Orangina,
  SkyBlue,
  LawnGreen,
  Malachite,
  YellowCab,
  BloodOrange,
} from '@/data/paint';
import { createRandomWalkerGrid } from '@/lib/random-walker';
import { tokens } from '@/tokens';

export const meta = {
  title: 'Hell Yea',
  date: '2025-07-09T01:00:00',
};

const bw = [Black, White];
const rainbow = [Lavender, Orangina, Viola, SkyBlue, LawnGreen, Malachite, YellowCab, BloodOrange];

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const ratio = 1 / 1;
const canvasSizeX = 1280;
const canvasSizeY = 1280 * ratio;

const padding = 40;
const gutter = -0.5;

const stepsX = 61;
const stepsY = 61;
const sizeX = (canvasSizeX - padding * 2) / stepsX;
const sizeY = (canvasSizeY - padding * 2) / stepsY;

const spiralGrid = createRandomWalkerGrid({
  gridSize: [stepsX, stepsY],
  initialCell: [0, 0],
});

export default function Output() {
  return (
    <Area width={tokens.size.x640}>
    <Sketch
      aspectRatio={4 / 5}
      setup={(p) => {
        p.createCanvas(canvasSizeX, canvasSizeY);
        p.noStroke();
      }}
      draw={(p, store) => {
        // reset
        p.clear(...bgColor);

        const start = p.frameCount / 500 + 0.05;

        for (const cellData of spiralGrid) {
          const {
            cell: [fx, fy],
          } = cellData;

          const x = fx - stepsX / 2;
          const y = fy + stepsY / 2;
          const posX = fx * sizeX;
          const posY = fy * sizeY;

          const timeSin = p.norm(Math.sin(start * x * 0.51), -1, 1);
          const timeCos = p.norm(Math.cos(start * y * 0.83), -1, 1);

          if (cellData.walked) {
            const value = timeSin * timeCos;
            const color = rainbow[Math.floor(value * rainbow.length)];

            p.fill(color);
          } else {
            const res = cellData.index / cellData.totalCellCount;
            p.colorMode(p.HSL);
            p.fill([0, 0, res * 100]);
          }

          p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
        }
      }}
    />
  </Area>
  );
}
