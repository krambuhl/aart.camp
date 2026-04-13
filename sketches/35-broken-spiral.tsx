'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
import { paint, rainbow } from 'data/colorMaps';
import { tokens } from 'tokens';

const rainbow2 = [
  paint.Lavender,
  paint.Orangina,
  paint.Viola,
  paint.SkyBlue,
  paint.LawnGreen,
  paint.Malachite,
  paint.YellowCab,
  paint.BloodOrange,
];

type Cell = [number, number];
type Translation = (config: Config) => Cell;

interface Config {
  cell: Cell;
  firstCell: Cell;
  currentTurnCount: number;
  currentDirection: number;
  currentArmLength: number;
  currentSnakeLength: number;
  stepsX: number;
  stepsY: number;
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
const canvasSizeY = 960 * (4 / 4);

const padding = 40;
const gutter = -0.5;

const stepsX = 4 * 6;
const stepsY = 4 * 6;
const sizeX = (canvasSizeX - padding * 2) / stepsX;
const sizeY = (canvasSizeY - padding * 2) / stepsY;

const size = 0;
const initialConfig: Config = {
  cell: [size, size],
  firstCell: [size, size],
  currentArmLength: 0,
  currentSnakeLength: 0,
  currentDirection: 0,
  currentTurnCount: 0,
  stepsX,
  stepsY,
  stepSize: 1,
  detectorSize: 0,
  maxTurnCount: 0,
  isFirstPass: true,
  bandCount: 0,
  bandGap: 0,
  bandSize: 4,
};

export const meta = {
  title: 'Broken Spiral',
  date: '2023-04-22T12:00:00',
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

const restarts = [
  ({ firstCell: [x, y], bandCount }) => [x, y + bandCount + 2],
  ({ firstCell: [x, y], bandCount }) => [x, y + bandCount + 1],
] as Translation[];

const getCell = (translationList: Translation[], config: Config) => {
  const { currentDirection } = config;

  return translationList[currentDirection % translationList.length](config);
};

const isInteriorCell = ({ cell: [x, y], stepsX, stepsY }: Config) => x >= 0 && x < stepsX && y >= 0 && y < stepsY;

const getCellIndex = (cells: Cell[], [x, y]: Cell) => cells.findIndex(([cx, cy]) => cx === x && cy === y);

function spiralGrid(cells: Cell[]) {
  const unwalkedCells = [...cells] as Cell[];
  const walkedCells = [] as Cell[];
  const walkedConfigs = [] as Config[];
  const instructions = [] as Instruction[];

  const restart = (config: Config) => () => {
    const nextCell = getCell(restarts, config);

    if (nextCell) {
      instructions.push(
        pop({
          ...config,
          cell: nextCell,
          detectorSize: 1,
          currentDirection: 0,
          currentTurnCount: 0,
          currentSnakeLength: 0,
          currentArmLength: 0,
          isFirstPass: false,
          bandCount: config.bandCount + 1,
        })
      );
    }
  };

  const pop = (config: Config) => () => {
    const { cell, bandCount, bandSize, bandGap, currentArmLength, currentSnakeLength } = config;

    const index = getCellIndex(unwalkedCells, cell);

    if (bandSize - bandCount <= bandGap) {
      return;
    }

    if (index >= 0) {
      const poppedCell = unwalkedCells.splice(index, 1)[0];
      walkedCells.push(poppedCell);
      walkedConfigs.push(config);

      instructions.push(
        detect({
          ...config,
          currentSnakeLength: currentSnakeLength + 1,
          currentArmLength: currentArmLength + 1,
        })
      );
    }
  };

  const detect = (config: Config) => () => {
    const { isFirstPass, currentTurnCount, maxTurnCount, bandCount, currentArmLength, detectorSize, bandSize } = config;

    let computedDetectorSize = detectorSize + bandSize;
    if (isFirstPass && currentTurnCount < 3) {
      computedDetectorSize = detectorSize + 1;
    } else if (!isFirstPass && currentTurnCount >= maxTurnCount) {
      computedDetectorSize = detectorSize + bandSize - bandCount + 3;
    } else if (!isFirstPass) {
      computedDetectorSize = 1;
    }

    const [nx, ny] = getCell(walks, config);
    const [dx, dy] = getCell(detectors, {
      ...config,
      detectorSize: computedDetectorSize,
    });

    const hasNextCell = getCellIndex(unwalkedCells, [nx, ny]) >= 0;
    const hasDetectorCell = getCellIndex(walkedCells, [dx, dy]) >= 0;
    const isDetectorInsideGrid = isInteriorCell({
      ...config,
      cell: [dx, dy],
    });

    if (hasNextCell && !hasDetectorCell && isDetectorInsideGrid) {
      instructions.push(
        pop({
          ...config,
          cell: [nx, ny],
        })
      );
    } else if (isFirstPass && currentArmLength < computedDetectorSize) {
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
          currentArmLength: 0,
          currentDirection: currentDirection + 1,
          currentTurnCount: currentTurnCount + 1,
          cell: [rx, ry],
          maxTurnCount: isFirstPass ? maxTurnCount + 1 : maxTurnCount,
        })
      );
    } else {
      // instructions.push(
      //   restart({ ...config, cell: unwalkedCells[0] })
      // )
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

  return [walkedCells, unwalkedCells, walkedConfigs];
}

export default function Output() {
  return (
    <Area width={tokens.size.x640}>
    <Sketch
      aspectRatio={4 / 5}
      setup={(p, store) => {
        p.createCanvas(canvasSizeX, canvasSizeY);
        p.colorMode(p.HSL);

        const grid = Array(stepsX * stepsY)
          .fill(null)
          .map((_, i) => [i % stepsX, Math.floor(i / stepsX)]) as Cell[];

        const [spiral, checkers, walkedConfigs] = spiralGrid(grid);
        store.frames = spiral;
        store.frameConfigs = walkedConfigs;
        store.checkers = checkers;
      }}
      draw={(p, store) => {
        // reset
        p.clear(...bgColor);
        p.noStroke();

        // const offset = 1.61803398875
        const offset = 5.384;

        const start = p.frameCount + 10000;
        const frameLength = store.frameConfigs.length;
        const time = start * -0.0002;
        // const time = 1112 //31113

        for (let i = 0; i < frameLength; i++) {
          const {
            cell: [fx, fy],
            bandCount,
            bandSize,
            currentSnakeLength,
            currentTurnCount,
          } = store.frameConfigs[i];

          const x = fx * sizeX + 1;
          const y = fy * sizeY + 1;

          // const colorIndex0 = (((i + (bandCount * 10)) + (x * 0.05) + (y * 5)) * time)

          const res =
            ((time +
              time * ((bandSize + 1) * 8 + (currentTurnCount + x / time) * 2) +
              (currentTurnCount + 1) * 0.1 * (time * 0.29) +
              // x * (currentTurnCount + 1) +
              // y * currentTurnCount +
              time * 0.1 * currentSnakeLength +
              // ((bandSize - bandCount) * ((currentTurnCount + 1) * (time * 0.1))) +
              0) *
              offset) %
            rainbow.length;

          const color = rainbow2[Math.floor(Math.abs(res) % rainbow.length)];

          p.colorMode(p.RGB, 1);
          p.fill(color);
          p.rect(x + padding, y + padding, sizeX - gutter, sizeY - gutter);
        }

        const checkersLength = store.checkers.length;
        for (let i = 0; i < checkersLength; i++) {
          const [fx, fy] = store.checkers[i];

          const x = fx * sizeX;
          const y = fy * sizeY;

          p.colorMode(p.RGB, 1);
          p.fill((fy % 2 ? fx % 2 : (fx + 1) % 2) ? 'white' : 'black');
          p.rect(x + padding, y + padding, sizeX - gutter, sizeY - gutter);
        }
      }}
    />
  </Area>
  );
}
