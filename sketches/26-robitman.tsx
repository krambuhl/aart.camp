'use client';

import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const black: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const _white: P5Color = [255 / 255, 255 / 255, 255 / 255, 255];
const canvasSize = 512;

const sides = 64;
const bandSize = 4;
const padding = 16;
const gutter = -0.5;
const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Robitman',
  date: '2023-03-30T10:00:00',
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

interface BandTranslateProps extends Cords {
  size: number;
}
type BandTranslate = (props: BandTranslateProps) => [number, number];

const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as Vector[];

const bandTranslates = [
  ({ x, y, size }) => [x - size, y + 1],
  ({ x, y, size }) => [x - 1, y - size],
  ({ x, y, size }) => [x + size, y - 1],
  ({ x, y, size }) => [x + 1, y + size],
] as BandTranslate[];

const rotationTranslates = [({ x, y }) => [x, y + 1], ({ x, y }) => [x - 1, y], ({ x, y }) => [x, y - 1], ({ x, y }) => [x + 1, y]] as BandTranslate[];

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

  function getBandTranslates(i: number) {
    return bandTranslates[i % bandTranslates.length];
  }

  function getRotationTranslates(i: number) {
    return rotationTranslates[i % rotationTranslates.length];
  }

  let currentCell = popCell({ x: 0, y: 0 });
  let currentDirIndex = 0;
  let currentBandCount = 0;
  let currentSize = 1;

  if (currentCell) {
    walkedCells.push(currentCell);
  }

  while (unwalkedCells.length > 0) {
    let nextCell;

    while (nextCell === undefined) {
      if (currentCell) {
        const { x, y } = currentCell;
        const [dx, dy] = getDirection(currentDirIndex);
        const [nx, ny] = [x + dx, y + dy];
        const nextIndex = getCellIndex({ x: nx, y: ny });

        if (nextIndex >= 0) {
          currentSize += 1;
          nextCell = unwalkedCells[nextIndex];
          nextCell.meta = { direction: [dx, dy] };
        } else {
          if (currentBandCount >= bandSize - 1) {
            const [rx, ry] = getRotationTranslates(currentDirIndex)({
              x,
              y,
              size: currentSize,
            });
            const bandNextIndex = getCellIndex({ x: rx, y: ry });

            currentDirIndex += 1;
            currentBandCount = 0;

            if (bandNextIndex >= 0) {
              nextCell = unwalkedCells[bandNextIndex];
              nextCell.meta = { direction: [dx, dy], rotation: [rx, ry] };
            }
            // return walkedCells
          } else {
            const [bx, by] = getBandTranslates(currentDirIndex)({
              x,
              y,
              size: currentSize - 1,
            });

            const bandNextIndex = getCellIndex({ x: bx, y: by });
            currentBandCount += 1;

            if (bandNextIndex >= 0) {
              nextCell = unwalkedCells[bandNextIndex];
              nextCell.meta = { direction: [dx, dy] };
            } else {
              nextCell = unwalkedCells[0];
              nextCell.meta = { direction: [dx, dy], translate: [bx, by] };
              if (!nextCell) {
                return walkedCells;
              }
            }
          }

          currentSize = 1;
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

          const start = p.frameCount + 5000;
          const length = store.frames.length;

          for (let i = 0; i < length; i++) {
            const frame = store.frames[i];
            const time = start * 0.1;

            const x = frame.x * size;
            const y = frame.y * size;
            const dir = frame.meta.direction;

            const [_dx, _dy] = dir ?? [1, 1];

            const _x1 = x + 1;
            const _y1 = y + 1;

            const _colorIndex0 = ((i + time * 1) % length) / length;
            const colorIndex1 = ((i * p.norm(Math.sin(time * 0.01), -1, 1) * time * 0.1) % length) / length;
            const colorIndex2 = ((i * p.norm(Math.cos(time * 0.005), -1, 1) * time * 0.15) % length) / length;

            p.colorMode(p.RGB, 1);
            p.fill(colorIndex1, colorIndex2, 1);
            p.rect(x + padding, y + padding, size - gutter, size - gutter);
          }
        }}
      />
    </Area>
  );
}
