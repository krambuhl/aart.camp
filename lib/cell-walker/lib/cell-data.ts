import { generateGridPositions } from '@/lib/grid';
import type { Cell } from '@/lib/grid/types';

import type { CellData, EnrichedCellData, ProgramConfig, ProgramState, UnwalkedCellData } from '../types';

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

// enrich the walked cell data with additional metadata
export function enrichWalkedCellData(state: ProgramState) {
  // create a map for the enriched cell data
  const enrichedCellData = new Map<string, EnrichedCellData>();

  // enrich the walked cell data with the relative
  // and absolute counts and other metadata
  state.walkedCellData.forEach((firstPassCellData, cellKey) => {
    const cellData: EnrichedCellData = {
      ...firstPassCellData,
      previousCellData: null,
      nextCellData: null,
      totalPathCount: state.totalPathCount,
      totalWalkedCellCount: state.totalWalkedCellCount,
      isHead: !!firstPassCellData.previousCell,
      isTail: !!firstPassCellData.nextCell,
      absolute: {
        ...firstPassCellData.absolute,
        totalStepCount: state.absoluteStepCount,
        totalLegCount: state.absoluteLegCount,
      },
      relative: {
        ...firstPassCellData.relative,
        totalStepCount: state.relativeStepCount[firstPassCellData.currentPathCount],
        totalLegCount: state.relativeLegCount[firstPassCellData.currentPathCount],
      },
    };

    enrichedCellData.set(cellKey, cellData);
  });

  // once we have enriched the walked cell data
  // we can link the previous and next cell data
  enrichedCellData.forEach((cellData) => {
    const previousCellData = enrichedCellData.get(cellData.previousCell?.join() ?? '');
    if (previousCellData) {
      cellData.previousCellData = previousCellData;
      previousCellData.nextCellData = cellData;
    }

    const nextCellData = enrichedCellData.get(cellData.nextCell?.join() ?? '');
    if (nextCellData) {
      cellData.nextCellData = nextCellData;
      nextCellData.previousCellData = cellData;
    }
  });

  return enrichedCellData;
}

// enrich the walked cell data and flatten into a simpler
// array of cell data which we can used in the grid design
export function enrichAndFlattenCellData(state: ProgramState, config: Required<ProgramConfig>) {
  // enrich the walked cell data with additional metadata
  const enrichedCellData = enrichWalkedCellData(state);

  // flatten the walked cell data into an array
  // which can be used to generate the grid design
  const flattenedCellData: CellData[] = [];
  const gridCellPositions = generateGridPositions(config.gridSize);

  // loop through the grid positions and enrich the cell data
  gridCellPositions.forEach(([x, y]) => {
    const cellKey = [x, y].join();
    // get the cell data from the enriched cell data
    // or the unwalked cell data if it doesn't exist
    const cellData = enrichedCellData.get(cellKey) ?? state.unwalkedCellData.get(cellKey);

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
