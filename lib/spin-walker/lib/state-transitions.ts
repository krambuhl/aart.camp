import type { StateTransitionHandler, WalkedCellData } from '../types';

// the `enter` state is the start of a path
// there can be multiple paths that we can take
export const handleEnterState: StateTransitionHandler = (state, config) => {
  // reset the relative counts at the start of a path
  state.relativeStepCount.push(0);
  state.relativeLegCount.push(0);

  // reset prev/next cell data
  state.previousCell = null;
  state.nextCell = null;

  // reset the fail count
  state.failCount = 0;

  // next we want to detect the next cell
  state.currentState = 'fill';
  state.currentDirection = config.initialDirection;
};

// the `detect` state is used to detect the next cell
// in the current path. Here we check if we should
// walk to the next cell or turn to the next direction
export const handleDetectState: StateTransitionHandler = (state, config) => {
  // if we have walked the maximum number of steps
  // or legs we can exit the current path
  if (state.relativeLegCount[state.totalPathCount] > config.maxLegCount || state.relativeStepCount[state.totalPathCount] > config.maxPathSteps) {
    state.currentState = 'exit';
    return;
  }

  const detectorSize =
    // if we are in the first path  and we have walked less than 3 legs
    // then we should use a smaller detector size
    state.totalPathCount > 0 || state.absoluteLegCount < 3 ? 1 : 4;

  const detectorCell = config.getNextCell(state, detectorSize);
  const detectorCellKey = detectorCell.join();

  // check if we have walked the detector cell already
  const hasWalkedDetectorCell = state.walkedCellData.has(detectorCellKey);
  if (hasWalkedDetectorCell) {
    state.currentState = state.failCount++ > config.maxFailCount ? 'exit' : 'turn';
    return;
  }

  const hasUnwalkedDetectorCell = state.unwalkedCellData.has(detectorCellKey);
  if (!hasUnwalkedDetectorCell) {
    state.currentState = state.failCount++ > config.maxFailCount ? 'exit' : 'turn';
    return;
  }

  state.currentState = 'walk';
};

// the `fill` state is where we define the cell values
// for the cell we are currently observing
export const handleFillState: StateTransitionHandler = (state, config) => {
  // check if we have a current unwalked cell data
  const currentUnwalkedCellData = state.unwalkedCellData.get(state.currentCell.join());

  // if we don't have a current unwalked cell data
  // something is wrong and we should bail
  if (!currentUnwalkedCellData) {
    throw new Error(`No unwalked cell data found for cell: ${state.currentCell}`);
  }

  const cellKey = state.currentCell.join();
  if (state.walkedCellData.has(cellKey)) {
    state.currentState = 'exit';

    if (state.failCount > config.maxFailCount) {
      // throw new Error(
      //   `Cell has already been walked too many times: ${state.currentCell}`
      // );
    }

    return;
  }

  // increment the total number of walked cells
  state.totalWalkedCellCount += 1;
  state.absoluteStepCount += 1;
  state.currentLegStepCount += 1;
  state.relativeStepCount[state.totalPathCount] += 1;

  // define the walked cell data
  const cellData: WalkedCellData = {
    ...currentUnwalkedCellData,
    walked: true,
    previousCell: state.previousCell,
    nextCell: state.nextCell,
    direction: state.currentDirection,
    currentPathCount: state.totalPathCount,
    absolute: {
      stepCount: state.absoluteStepCount,
      legCount: state.absoluteLegCount,
    },
    relative: {
      stepCount: state.relativeStepCount[state.totalPathCount],
      legCount: state.relativeLegCount[state.totalPathCount],
    },
  };

  // save the first pass walked cell data
  state.walkedCellData.set(cellKey, cellData);

  // reset the fail count
  state.failCount = 0;

  // next we want to detect the next cell
  state.currentState = 'detect';
};

// the `walk` state represents walking to the next cell
// on the current path in the current direction
export const handleWalkState: StateTransitionHandler = (state, config) => {
  if (state.maxLegCount && state.relativeLegCount[state.totalPathCount] > state.maxLegCount && state.currentLegStepCount < state.lastLegStepCount - 2) {
    state.currentState = 'exit';
    return;
  }

  const nextCell = config.getNextCell(state);
  const nextCellKey = nextCell.join();

  const nextCellData = state.unwalkedCellData.get(nextCellKey);

  if (nextCellData) {
    state.previousCell = [...state.currentCell];
    state.currentCell = nextCell;
    state.nextCell = nextCell;
    state.currentState = 'fill';
  } else {
    throw new Error(`No unwalked cell data found for cell: ${nextCell}`);
  }
};

// the `turn` state represents turning to the next direction
// on the current path based on the current direction
export const handleTurnState: StateTransitionHandler = (state, config) => {
  // check if the current leg is longer than the detector size
  if (state.currentLegStepCount < 4) {
    state.lastLegStepCount = state.currentLegStepCount;
    state.maxLegCount = state.relativeLegCount[0];
    state.currentState = 'exit';
    return;
  }

  state.currentDirection = config.getNextDirection(state);
  state.absoluteLegCount += 1;
  state.relativeLegCount[state.totalPathCount] += 1;
  state.currentLegStepCount = 0;
  state.currentState = 'detect';
};

// the `exit` state is where we exit the current path
// and determine if we should `complete` the program
// or `enter` the next path
export const handleExitState: StateTransitionHandler = (state, config) => {
  if (state.totalPathCount > config.maxPathCount) {
    state.currentState = 'complete';
    return;
  }

  state.currentCell = config.initialCell;
  state.currentDirection = 'down';
  state.totalPathCount += 1;

  const nextCell = config.getNextCell(state, state.totalPathCount);
  const nextCellKey = nextCell.join();

  const hasUnwalkedNextCell = !state.walkedCellData.has(nextCellKey);
  if (hasUnwalkedNextCell) {
    state.currentCell = nextCell;
    state.currentState = state.totalPathCount > 2 ? 'complete' : 'enter';
    return;
  }

  state.currentState = 'complete';
};
