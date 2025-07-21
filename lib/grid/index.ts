import { Cell, Direction, GetNextDirectionHandler, GetNextCellHandler } from './types';

export function generateGridPositions(size: Cell): Cell[] {
  const [x, y] = size;

  return Array(x * y)
    .fill(null)
    .map((_, i) => [i % x, Math.floor(i / x)]);
}

export const getNextCell: GetNextCellHandler = ({ currentCell, currentDirection }, stepSize = 1) => {
  const [x, y] = currentCell;
  switch (currentDirection) {
    case 'up':
      return [x, y - stepSize];
    case 'down':
      return [x, y + stepSize];
    case 'left':
      return [x - stepSize, y];
    case 'right':
      return [x + stepSize, y];
    case 'up-right':
      return [x + stepSize, y - stepSize];
    case 'up-left':
      return [x - stepSize, y - stepSize];
    case 'down-right':
      return [x + stepSize, y + stepSize];
    case 'down-left':
      return [x - stepSize, y + stepSize];
    default:
      return currentCell;
  }
};

export const directions: Direction[] = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
];

export const getNextDirection: GetNextDirectionHandler = ({ currentDirection }, stepSize = 2) => {
  const currentIndex = directions.indexOf(currentDirection);
  return directions[(currentIndex + stepSize) % directions.length];
};
