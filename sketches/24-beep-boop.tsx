'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const black: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const _white: P5Color = [255 / 255, 255 / 255, 255 / 255, 255];
const canvasSize = 512;

const sides = 108;
const padding = 16;
const gutter = -0.5;
const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Beep Boop',
  date: '2023-03-28T10:00:00',
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
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as Vector[];

function spiralGrid(cells: Cell[]) {
  const unwalkedCells = [...cells] as Cell[];
  const walkedCells = [] as Cell[];

  function getCellIndex({ x, y }: Cords) {
    return unwalkedCells.findIndex((cell: Cell) => cell.x === x && cell.y === y);
  }

  function popCell({ x, y }: Cords) {
    const index = getCellIndex({ x, y });

    if (index >= 0) {
      const [pop] = unwalkedCells.splice(index, 1);

      return pop;
    }
  }

  function getDirection(i: number) {
    return directions[i % directions.length];
  }

  let currentCell = popCell({ x: 0, y: 0 });
  let currentDirIndex = 0;

  if (currentCell) {
    walkedCells.push(currentCell);
  }

  while (unwalkedCells.length > 0) {
    let nextCell;

    while (nextCell === undefined) {
      if (currentCell) {
        const { x, y } = currentCell;
        const [nx, ny] = getDirection(currentDirIndex);
        const nextIndex = getCellIndex({ x: x + nx, y: y + ny });

        if (nextIndex >= 0) {
          nextCell = unwalkedCells[nextIndex];
        } else {
          currentDirIndex += 1;
        }
      }
    }

    currentCell = nextCell;
    const poppedCell = popCell(nextCell);
    if (poppedCell) {
      walkedCells.push(poppedCell);
    }
  }

  return walkedCells;
}

export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p, store) => {
          p.createCanvas(canvasSize, canvasSize);
          p.colorMode(p.HSL);

          const grid = Array(sides ** 2)
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

          const start = p.frameCount + 0;
          const length = store.frames.length;

          for (let i = 0; i < length; i++) {
            const frame = store.frames[i];
            const time = start * 32;

            const x = frame.x * size;
            const y = frame.y * size;

            const colorIndex1 = ((i + time * 12 * ((i / length) * Math.sin(x / size))) % length) / length;
            const colorIndex2 = ((i + time * 11 * ((i / length) * Math.cos(y / size))) % length) / length;

            p.colorMode(p.RGB, 1);
            p.fill(colorIndex1, colorIndex2, 1);
            p.rect(x + padding, y + padding, size - gutter, size - gutter);
          }
        }}
      />
    </Area>
  );
}
