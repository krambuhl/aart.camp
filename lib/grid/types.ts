export type Direction = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'down-right' | 'down-left';

export type Cell = [x: number, y: number];

interface HandlerData {
  currentCell: Cell;
  currentDirection: Direction;
}

export type GetNextCellHandler<T extends HandlerData = HandlerData> = (state: T, stepSize?: number) => Cell;

export type GetNextDirectionHandler<T extends HandlerData = HandlerData> = (state: T, stepSize?: number) => Direction;
