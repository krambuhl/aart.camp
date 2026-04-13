import type { P5CanvasInstance } from 'react-p5-wrapper';
import type { CoreComponent } from '@/types/core';

export interface SketchProps extends Omit<CoreComponent, 'children'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setup: (p: P5CanvasInstance, store: any) => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw: (p: P5CanvasInstance, store: any) => void;

  aspectRatio?: number;
}
