import { getNextCell as defaultGetNextCell, getNextDirection as defaultGetNextDirection, generateGridPositions } from '@/lib/grid';

import { enrichAndFlattenCellData, generateUnwalkedCellData } from './lib/cell-data';
import {
  handleDetectState as defaultHandleDetectState,
  handleEnterState as defaultHandleEnterState,
  handleExitState as defaultHandleExitState,
  handleFillState as defaultHandleFillState,
  handleTurnState as defaultHandleTurnState,
  handleWalkState as defaultHandleWalkState,
} from './lib/state-transitions';
import type { CellData, ProgramConfig, ProgramState, WalkedCellData } from './types';

function initProgramState({ initialCell, initialDirection, gridSize }: Required<ProgramConfig>): ProgramState {
  const gridCellPositions = generateGridPositions(gridSize);
  const unwalkedCellData = generateUnwalkedCellData(gridCellPositions);

  // define the state machine values with the initial data
  // these values will be updated as the state machine progresses
  const state: ProgramState = {
    currentState: 'enter',
    currentCell: initialCell,
    previousCell: null,
    nextCell: null,
    currentDirection: initialDirection,
    absoluteStepCount: 0,
    absoluteLegCount: 0,
    relativeStepCount: [],
    relativeLegCount: [],
    currentLegStepCount: 0,
    lastLegStepCount: 0,
    maxLegCount: null,
    totalPathCount: 0,
    totalWalkedCellCount: 0,
    failCount: 0,
    unwalkedCellData,
    walkedCellData: new Map<string, WalkedCellData>(),
  };

  return state;
}

export function walkGrid({
  initialCell = [0, 0],
  initialDirection = 'right',
  gridSize = [40, 40],
  maxPathCount = Infinity,
  maxPathSteps = Infinity,
  maxLegCount = Infinity,
  maxLegSteps = Infinity,
  maxFailCount = 4,
  getNextCell = defaultGetNextCell,
  getNextDirection = defaultGetNextDirection,
  handleEnterState = defaultHandleEnterState,
  handleDetectState = defaultHandleDetectState,
  handleFillState = defaultHandleFillState,
  handleWalkState = defaultHandleWalkState,
  handleTurnState = defaultHandleTurnState,
  handleExitState = defaultHandleExitState,
}: ProgramConfig): CellData[] {
  // define the program config values as an object to
  // make it easier to pass to the state machine functions
  const config: Required<ProgramConfig> = {
    initialCell,
    initialDirection,
    gridSize,
    maxPathCount,
    maxPathSteps,
    maxLegCount,
    maxLegSteps,
    maxFailCount,
    getNextCell,
    getNextDirection,
    handleEnterState,
    handleDetectState,
    handleFillState,
    handleWalkState,
    handleTurnState,
    handleExitState,
  };

  // define the state machine values with the initial data
  // these values will be updated as the state machine progresses
  const state = initProgramState(config);

  // loop until the program is completed with each iteration
  // representing a single state transition a state machine
  while (state.currentState !== 'complete') {
    if (state.currentState === 'enter') {
      handleEnterState(state, config);
    } else if (state.currentState === 'detect') {
      handleDetectState(state, config);
    } else if (state.currentState === 'fill') {
      handleFillState(state, config);
    } else if (state.currentState === 'walk') {
      handleWalkState(state, config);
    } else if (state.currentState === 'turn') {
      handleTurnState(state, config);
    } else if (state.currentState === 'exit') {
      handleExitState(state, config);
    }
  }

  // enrich the first pass walked cell data and flatten
  // into a simpler array of cell data
  return enrichAndFlattenCellData(state, config);
}
