'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
import { rainbow } from 'data/colorMaps';
import { tokens } from 'tokens';

const black: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const white: P5Color = [255 / 255, 255 / 255, 255 / 255, 255];
const canvasSize = 512;

const sides = 22 + 8;
const padding = 16;
const gutter = -0.5;
const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Spiral Checkers',
  date: '2023-03-20T00:00:00',
};

interface Cords {
  x: number;
  y: number;
}

interface Cell extends Cords {
  meta?: object;
}

type Direction = 0 | 1 | -1;
type Vector = [Direction, Direction];

const directions = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as Vector[];

function spiralGrid(cells: Cell[]) {
  const unwalkedCells = [...cells] as Cell[];
  const walkedCells = [] as Cell[];

  function getCellIndex({ x, y }: Cords) {
    return unwalkedCells.findIndex((cell: Cell) => cell.x === x && cell.y === y);
  }

  function getCell({ x, y }: Cords) {
    const index = getCellIndex({ x, y });
    if (index >= 0) {
      return unwalkedCells[index];
    }
  }

  function popCell({ x, y }: Cords) {
    const index = getCellIndex({ x, y });

    if (index >= 0) {
      const pop = unwalkedCells.splice(index, 1);

      return pop[0];
    }
  }

  function getDirection(i: number) {
    return directions[i % directions.length];
  }

  function walkSpiral({ x, y }: Cords, dir: number) {
    const [dx, dy] = getDirection(dir);
    const cell = popCell({ x, y });

    if (cell) {
      cell.meta = { draw: true };
      walkedCells.push(cell);

      const next = {
        x: x + dx,
        y: y + dy,
      };

      walkSpiral(next, dir);
    } else {
      const [ndx, ndy] = getDirection(dir + 1);
      const next = {
        x: x - dx + ndx,
        y: y - dy + ndy,
      };

      if (getCell(next) && dir < 60) {
        walkSpiral(next, dir + 1);
      }
    }
  }

  walkSpiral({ x: 0, y: 0 }, 0);

  return walkedCells;
}

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
    <Sketch
      setup={(p, store) => {
        p.createCanvas(canvasSize, canvasSize);
        p.colorMode(p.HSL);

        const grid = Array(Math.pow(sides, 2))
          .fill(null)
          .map((_, i) => ({
            x: i % sides,
            y: Math.floor(i / sides),
            meta: {},
          }));

        store.frames = spiralGrid(grid);
      }}
      draw={(p, store) => {
        // reset
        p.clear(...black);
        p.noStroke();

        const start = p.frameCount + 1200;
        const length = store.frames.length;

        for (let i = 0; i < length; i++) {
          const frame = store.frames[i];
          const time = start * 0.3;

          const x = frame.x * size;
          const y = frame.y * size;

          const colorIndex1 = ((i * time + y * (time * 0.2)) / length) % 3.6;
          const colorIndex2 = ((i * time + x * (time * 0.4)) / length) % 3.6;

          p.colorMode(p.RGB, 1);
          p.fill(colorIndex1 / 4, colorIndex2 / 4, 1);
          p.rect(x + padding, y + padding, size - gutter, size - gutter);
        }
      }}
    />
  </Area>
  );
}
