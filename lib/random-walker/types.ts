import { Cell } from 'lib/grid/types';

export type State = 'start' | 'walk' | 'complete';

/**
 * the unwalked cell data is generated before the walk has started
 */
export interface UnwalkedCellData {
  /** the original index of the cell */
  index: number;

  /** flag to indicate if the cell has been walked */
  walked: false;

  /** the coordinate of the cell */
  cell: Cell;

  /** total number of cells */
  totalCellCount: number;
}

/**
 * the data is generated during the actual walk and describes
 * the metadata of the cell we are currently observing.
 **/
export interface WalkedCellData extends Omit<UnwalkedCellData, 'walked'> {
  walked: true;
  stepCount: number;
  value: [number, number, number];
}

export interface ProgramState {
  currentState: State;
  currentCell: Cell;
  previousCell: Cell | null;
  nextCell: Cell | null;
  unwalkedCellData: Map<string, UnwalkedCellData>;
  walkedCellData: Map<string, WalkedCellData>;
}

/**
 * the program conig is used to congigure the state machine
 */
export interface ProgramConfig {
  /** the starting cell when the program starts */
  initialCell?: Cell;

  /** the number of cells in the grid */
  gridSize: Cell;
}

export type CellData = UnwalkedCellData | WalkedCellData;
