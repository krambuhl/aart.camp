'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
import { tokens } from 'tokens';

type Cell = [number, number];
type Translation = (config: Config) => Cell;

interface Config {
  cell: Cell;
  currentTurnCount: number;
  currentDirection: number;
  currentLength: number;
  stepSize: number;
  detectorSize: number;
  maxTurnCount: number;
  isFirstPass: boolean;
  bandCount: number;
  bandGap: number;
  bandSize: number;
}

type Instruction = () => void;

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSizeX = 960;
const canvasSizeY = 960 * (5 / 4);
const aspectRatio = canvasSizeX / canvasSizeY;

const sidesX = 4 * 24;
const sidesY = 5 * 24;

const padding = 40;
const gutter = -0.5;
const sizeX = (canvasSizeX - padding * 2) / sidesX;
const sizeY = (canvasSizeY - padding * 2) / sidesY;

const initialConfig: Config = {
  cell: [0, 0],
  currentLength: 0,
  currentDirection: 0,
  currentTurnCount: 0,
  stepSize: 1,
  detectorSize: sidesX / 6,
  maxTurnCount: 0,
  isFirstPass: true,
  bandCount: 0,
  bandGap: 0,
  bandSize: sidesX / 6,
};

export const meta = {
  title: 'State Machine Spiral',
  date: '2023-04-10T16:00:00',
};

const walks = [
  ({ cell: [x, y], stepSize }) => [x + stepSize, y],
  ({ cell: [x, y], stepSize }) => [x, y + stepSize],
  ({ cell: [x, y], stepSize }) => [x - stepSize, y],
  ({ cell: [x, y], stepSize }) => [x, y - stepSize],
] as Translation[];

const detectors = [
  ({ cell: [x, y], detectorSize }) => [x + detectorSize, y],
  ({ cell: [x, y], detectorSize }) => [x, y + detectorSize],
  ({ cell: [x, y], detectorSize }) => [x - detectorSize, y],
  ({ cell: [x, y], detectorSize }) => [x, y - detectorSize],
] as Translation[];

const rotations = [
  ({ cell: [x, y] }) => [x, y + 1],
  ({ cell: [x, y] }) => [x - 1, y],
  ({ cell: [x, y] }) => [x, y - 1],
  ({ cell: [x, y] }) => [x + 1, y],
] as Translation[];

const getCell = (translationList: Translation[], config: Config) => {
  const { currentDirection } = config;

  return translationList[currentDirection % translationList.length](config);
};

const getCellIndex = (cells: Cell[], [x, y]: Cell) => cells.findIndex(([cx, cy]) => cx === x && cy === y);

function spiralGrid(cells: Cell[]) {
  const unwalkedCells = [...cells] as Cell[];
  const walkedCells = [] as Cell[];
  const instructions = [] as Instruction[];

  const restart = (config: Config) => () => {
    const nextCell = unwalkedCells[0];

    if (nextCell) {
      instructions.push(
        pop({
          ...config,
          cell: nextCell,
          detectorSize: 1,
          currentDirection: 0,
          currentTurnCount: 0,
          isFirstPass: false,
          bandCount: config.bandCount + 1,
        })
      );
    }
  };

  const pop = (config: Config) => () => {
    const { cell, bandCount, bandSize, bandGap, currentLength } = config;

    const index = getCellIndex(unwalkedCells, cell);

    if (bandSize - bandCount <= bandGap) {
      return;
    }

    if (index >= 0) {
      const poppedCell = unwalkedCells.splice(index, 1)[0];
      walkedCells.push(poppedCell);

      instructions.push(
        detect({
          ...config,
          currentLength: currentLength + 1,
        })
      );
    }
  };

  const detect = (config: Config) => () => {
    const { isFirstPass, currentTurnCount, maxTurnCount, bandCount, currentLength, detectorSize, bandSize } = config;

    const [nx, ny] = getCell(walks, config);
    const [dx, dy] = getCell(detectors, {
      ...config,
      detectorSize: !isFirstPass && currentTurnCount < maxTurnCount ? 1 : bandSize - bandCount,
    });

    const nextIndex = getCellIndex(unwalkedCells, [nx, ny]);
    const detectorIndex = getCellIndex(walkedCells, [dx, dy]);

    if (nextIndex >= 0 && detectorIndex === -1) {
      instructions.push(
        pop({
          ...config,
          cell: [nx, ny],
        })
      );
    } else if (isFirstPass && currentLength < detectorSize) {
      instructions.push(restart(config));
    } else if (!isFirstPass && currentTurnCount >= maxTurnCount) {
      instructions.push(restart(config));
    } else {
      instructions.push(rotate(config));
    }
  };

  const rotate = (config: Config) => () => {
    const { currentDirection, currentTurnCount, isFirstPass, maxTurnCount } = config;

    const [rx, ry] = getCell(rotations, config);
    const nextIndex = getCellIndex(unwalkedCells, [rx, ry]);

    if (nextIndex >= 0) {
      instructions.push(
        pop({
          ...config,
          currentLength: 0,
          currentDirection: currentDirection + 1,
          currentTurnCount: currentTurnCount + 1,
          cell: [rx, ry],
          maxTurnCount: isFirstPass ? maxTurnCount + 1 : maxTurnCount,
        })
      );
    }
  };

  // Progrim
  instructions.push(pop(initialConfig));

  while (instructions.length > 0) {
    const instruction = instructions.pop();
    if (instruction) {
      instruction();
    }
  }

  return walkedCells;
}

export default function Output() {
  return (
    <Area width={tokens.size.x512}>
    <Sketch
      aspectRatio={9 / 16}
      setup={(p, store) => {
        p.createCanvas(canvasSizeX, canvasSizeY);
        p.colorMode(p.HSL);

        const grid = Array(sidesX * sidesY)
          .fill(null)
          .map((_, i) => [i % sidesX, Math.floor(i / sidesX)]) as Cell[];

        store.frames = spiralGrid(grid);
      }}
      draw={(p, store) => {
        // reset
        p.clear(...bgColor);
        p.noStroke();

        const start = p.frameCount + 3000;
        const length = store.frames.length;

        for (let i = 0; i < length; i++) {
          const [fx, fy] = store.frames[i];
          const time = start * 0.1;

          const x = fx * sizeX;
          const y = fy * sizeY;

          const linearColor1 = ((i * time * 0.3 + time * x * 0.01) % length) / length;
          const linearColor2 = ((i * time) % length) / length;
          const colorIndex0 = (((i * 7 + x) * time) % length) / length;
          const colorIndex1 = (((i * 8 + y) * time) % length) / length;

          p.colorMode(p.RGB, 1);
          p.fill(1, linearColor1, linearColor2);
          p.rect(x + padding, y + padding, sizeX - gutter, sizeY - gutter);
        }
      }}
    />
  </Area>
  );
}
