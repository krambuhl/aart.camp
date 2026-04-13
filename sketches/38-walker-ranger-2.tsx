'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
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
  Gray00,
  Gray01,
  Gray02,
  Gray03,
  Gray04,
  Gray05,
  Gray06,
  Gray07,
  Gray08,
  Gray09,
  Gray10,
  Gray11,
  Gray12,
  Gray13,
  Gray14,
  Gray15,
} from 'data/paint';
import { tokens } from 'tokens';

import { walkGrid } from 'lib/cell-walker';

export const meta = {
  title: 'Walker Ranger 2',
  date: '2024-12-12T02:00:00',
};

const bw = [Black, White];
const rainbow = [
  Gray15,
  Gray13,
  Gray11,
  Gray09,
  Gray07,
  Gray05,
  Gray03,
  Gray01,
  Gray00,
  Gray02,
  Gray04,
  Gray06,
  Gray08,
  Gray10,
  Gray12,
  Gray14,
  Lavender,
  Orangina,
  Viola,
  SkyBlue,
  LawnGreen,
  Malachite,
  YellowCab,
  BloodOrange,
];

type BlackWhiteColor = (typeof bw)[number];
type RainbowColor = (typeof rainbow)[number];

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const ratio = 1 / 1;
const canvasSizeX = 1280;
const canvasSizeY = 1280 * ratio;

const padding = 40;
const gutter = -0.5;

const stepsX = 4 * 30 + 1;
const stepsY = 4 * 30 + 1;
const sizeX = (canvasSizeX - padding * 2) / stepsX;
const sizeY = (canvasSizeY - padding * 2) / stepsY;

const spiralGrid = walkGrid({
  gridSize: [stepsX, stepsY],
  initialCell: [0, 0],
  initialDirection: 'right',
});

export default function Output() {
  return (
    <Area width={tokens.size.x640}>
    <Sketch
      aspectRatio={4 / 5}
      setup={(p) => {
        p.createCanvas(canvasSizeX, canvasSizeY);
        p.colorMode(p.HSL);
      }}
      draw={(p, store) => {
        // reset
        p.clear(...bgColor);
        p.noStroke();
        p.colorMode(p.RGB, 1);

        const start = p.frameCount / 1000 + 0.001;

        for (const cellData of spiralGrid) {
          const {
            walked,
            cell: [fx, fy],
          } = cellData;

          // const x = fx - stepsX / 2 + Math.sin(start * fx * fy * 0.01);
          // const y = fy + stepsY / 2 + Math.cos(start * fx * fy * 0.01);
          const posX = fx * sizeX;
          const posY = fy * sizeY;

          // fill the unwalked cells with b/w checkerboard
          const progress = cellData.index / cellData.totalCellCount;
          const intensity = progress * Math.PI * 2;

          const x = fx - stepsX / 2;
          const y = fy - stepsY / 2;

          const cx = Math.log(Math.abs(stepsX * x));
          const cy = Math.log(Math.abs(stepsY * y));

          p.fill([
            Math.sin(intensity * start * cx * cy * 1.01),
            Math.sin(intensity * start * cx * cy * 1.02),
            Math.sin(intensity * start * cx * cy * 1.03),
          ]);

          p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
        }
      }}
    />
  </Area>
  );
}
