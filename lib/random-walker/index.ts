import { generateGridPositions } from '@/lib/grid';

import { flattenCellData, generateUnwalkedCellData } from './lib/cell-data';
import type { CellData, ProgramConfig, ProgramState, WalkedCellData } from './types';

function initProgramState({ initialCell, gridSize }: Required<ProgramConfig>): ProgramState {
  const gridCellPositions = generateGridPositions(gridSize);
  const unwalkedCellData = generateUnwalkedCellData(gridCellPositions);

  // define the state machine values with the initial data
  // these values will be updated as the state machine progresses
  const state: ProgramState = {
    currentState: 'start',
    currentCell: initialCell,
    previousCell: null,
    nextCell: null,
    unwalkedCellData,
    walkedCellData: new Map<string, WalkedCellData>(),
  };

  return state;
}

function walkGrid(state: ProgramState): ProgramState {
  let currentCellCount = 0;

  while (state.unwalkedCellData.size > 0) {
    const sortedPairs = state.unwalkedCellData
      .entries()
      .toArray()
      .map(([key, value]) => ({ key, value: Math.random() * value.cell[0] + Math.random() * value.cell[1] }))
      .sort((a, b) => a.value - b.value);

    const { key: cellKey, value: cellValue } = sortedPairs[0];

    const cellData = state.unwalkedCellData.get(cellKey);

    if (!cellData) {
      throw new Error(`Cell data is missing for cell key: ${cellKey}`);
    }

    state.unwalkedCellData.delete(cellKey);
    state.walkedCellData.set(cellKey, {
      ...cellData,
      walked: true,
      stepCount: currentCellCount++,
      value: [cellValue, cellValue, cellValue],
    });
  }

  return state;
}

export function createRandomWalkerGrid({ initialCell = [0, 0], gridSize = [40, 40] }: ProgramConfig): CellData[] {
  // define the program config values as an object to
  // make it easier to pass to the state machine functions
  const config: Required<ProgramConfig> = {
    initialCell,
    gridSize,
  };

  // define the state machine values with the initial data
  // these values will be updated as the state machine progresses
  const initialState = initProgramState(config);

  // walk the grid and update the state based on the walker
  const state = walkGrid(initialState);

  // enrich the first pass walked cell data and flatten
  // into a simpler array of cell data
  return flattenCellData(state, config);
}
