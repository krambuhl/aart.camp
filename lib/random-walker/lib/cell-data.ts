import { generateGridPositions } from '@/lib/grid';
import type { Cell } from '@/lib/grid/types';

import type { CellData, ProgramConfig, ProgramState, UnwalkedCellData } from '../types';

export function generateUnwalkedCellData(positions: Cell[]) {
  // create a map of all the unwalked cell data
  const unwalkedCellData = new Map<string, UnwalkedCellData>();

  // generate the unwalked cell data
  positions.forEach(([x, y], i) => {
    unwalkedCellData.set([x, y].join(), {
      index: i,
      cell: [x, y],
      totalCellCount: positions.length,
      walked: false,
    });
  });

  return unwalkedCellData;
}

// enrich the walked cell data and flatten into a simpler
// array of cell data which we can used in the grid design
export function flattenCellData(state: ProgramState, config: Required<ProgramConfig>) {
  // flatten the walked cell data into an array
  // which can be used to generate the grid design
  const flattenedCellData: CellData[] = [];
  const gridCellPositions = generateGridPositions(config.gridSize);

  // loop through the grid positions and enrich the cell data
  gridCellPositions.forEach(([x, y]) => {
    const cellKey = [x, y].join();
    // get the cell data from the walked cell data
    // or the unwalked cell data if it doesn't exist
    const cellData = state.walkedCellData.get(cellKey) ?? state.unwalkedCellData.get(cellKey);

    if (cellData) {
      flattenedCellData.push(cellData);
    }
  });

  // if the flattened cell data length does not match the grid cell positions
  // then we have an issue and we should bail
  if (flattenedCellData.length !== gridCellPositions.length) {
    throw new Error('Flattened walked cell data length does not match total cell count');
  }

  return flattenedCellData;
}
