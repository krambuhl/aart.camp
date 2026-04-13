'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import {
  Black,
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
  White,
} from '@/data/paint';
import { walkGrid } from '@/lib/cell-walker';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

export const meta = {
  title: 'Reignite',
  date: '2024-11-22T01:00:00',
};

const bw = [Black, White];
const rainbow = [
  Gray15,
  Gray13,
  Gray13,
  Gray11,
  Gray11,
  Gray09,
  Gray09,
  Gray07,
  Gray07,
  Gray05,
  Gray05,
  Gray03,
  Gray03,
  Gray01,
  Gray01,
  Gray00,
  Gray02,
  Gray02,
  Gray04,
  Gray04,
  Gray06,
  Gray06,
  Gray08,
  Gray08,
  Gray10,
  Gray10,
  Gray12,
  Gray12,
  Gray14,
  // Lavender,
  // Orangina,
  // Viola,
  // SkyBlue,
  // LawnGreen,
  // Malachite,
  // YellowCab,
  // BloodOrange,
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
        draw={(p, _store) => {
          // reset
          p.clear(...bgColor);
          p.noStroke();
          p.colorMode(p.RGB, 1);

          const start = p.frameCount + 1000;
          const startSin = Math.sin(start / 79);
          const startCos = Math.cos(start / 191);
          const time = startSin * startCos * 0.00005 + start / 10000000;

          for (const cellData of spiralGrid) {
            const {
              walked,
              cell: [fx, fy],
            } = cellData;
            const x = (fx + 0) * sizeX + 1;
            const y = (fy + 0) * sizeY + 1;

            const xo = x - stepsX / 2;
            const yo = y - stepsY / 2;

            // biome-ignore lint/correctness/noConstantCondition: sketch toggle
            if (true) {
              const res = Math.tan(time * yo + 10) * Math.tan(time * xo + 8) * rainbow.length * 8;
              const color = rainbow[Math.floor(Math.abs(res) % rainbow.length)];
              p.fill(color);
            } else {
              // fill the unwalked cells with b/w checkerboard
              p.fill((fy % 2 ? fx % 2 : (fx + 1) % 2) ? Black : White);
            }

            p.rect(x + padding, y + padding, sizeX - gutter, sizeY - gutter);
          }
        }}
      />
    </Area>
  );
}
