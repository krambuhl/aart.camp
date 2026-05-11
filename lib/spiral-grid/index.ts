// Spiral-grid traversal — produces an ordered walk over a rectangular
// grid in concentric "bands" (see sketches/28-super-quilts-tres.tsx
// for the original inline implementation). Each band has `bandSize`
// cells along its leading edge before the walker rotates.
//
// Each returned cell carries metadata about the direction taken into
// it, which can be used to color cells based on walk direction.

export interface SpiralCell {
  x: number;
  y: number;
  meta: {
    direction?: [number, number];
    rotation?: [number, number];
    translate?: [number, number];
  };
}

export interface SpiralGridConfig {
  sidesX: number;
  sidesY: number;
  bandSize: number;
}

interface Cords {
  x: number;
  y: number;
}

interface BandTranslateProps extends Cords {
  size: number;
}

type Vector = [number, number];
type BandTranslate = (props: BandTranslateProps) => [number, number];

export const SPIRAL_JUMP = 2;

const directions = [
  [SPIRAL_JUMP, 0],
  [0, SPIRAL_JUMP],
  [-SPIRAL_JUMP, 0],
  [0, -SPIRAL_JUMP],
] as Vector[];

const bandTranslates = [
  ({ x, y, size }) => [x - size, y + 1],
  ({ x, y, size }) => [x - 1, y - size],
  ({ x, y, size }) => [x + size, y - 1],
  ({ x, y, size }) => [x + 1, y + size],
] as BandTranslate[];

const rotationTranslates = [({ x, y }) => [x, y + 1], ({ x, y }) => [x - 1, y], ({ x, y }) => [x, y - 1], ({ x, y }) => [x + 1, y]] as BandTranslate[];

export function createSpiralGrid({ sidesX, sidesY, bandSize }: SpiralGridConfig): SpiralCell[] {
  const cells: SpiralCell[] = Array(sidesX * sidesY)
    .fill(null)
    .map((_, i) => ({
      x: i % sidesX,
      y: Math.floor(i / sidesX),
      meta: {},
    }));

  return walk(cells, bandSize);
}

function walk(cells: SpiralCell[], bandSize: number): SpiralCell[] {
  const unwalkedCells = [...cells];
  const walkedCells: SpiralCell[] = [];

  function getCellIndex({ x, y }: Cords) {
    return unwalkedCells.findIndex((cell) => cell.x === x && cell.y === y);
  }

  function popCell({ x, y }: Cords) {
    const index = getCellIndex({ x, y });
    if (index >= 0) {
      const [pop] = unwalkedCells.splice(index, 1);
      return pop;
    }
  }

  let currentCell = popCell({ x: 0, y: 0 });
  let currentDirIndex = 0;
  let currentBandCount = 0;
  let currentSize = 1;

  if (currentCell) {
    walkedCells.push(currentCell);
  }

  while (unwalkedCells.length > 0) {
    let nextCell: SpiralCell | undefined;

    while (nextCell === undefined) {
      if (currentCell) {
        const { x, y } = currentCell;
        const [dx, dy] = directions[currentDirIndex % directions.length];
        const [nx, ny] = [x + dx, y + dy];
        const nextIndex = getCellIndex({ x: nx, y: ny });

        if (nextIndex >= 0) {
          currentSize += 1;
          nextCell = unwalkedCells[nextIndex];
          nextCell.meta = { direction: [dx, dy] };
        } else {
          if (currentBandCount >= bandSize - 1) {
            const [rx, ry] = rotationTranslates[currentDirIndex % rotationTranslates.length]({
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
          } else {
            const [bx, by] = bandTranslates[currentDirIndex % bandTranslates.length]({
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
              if (!nextCell) {
                return walkedCells;
              }
              nextCell.meta = { direction: [dx, dy], translate: [bx, by] };
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
