import type { P5CanvasInstance } from 'react-p5-wrapper';
import type { CoreComponent } from '@/types/core';

export interface SketchProps extends Omit<CoreComponent, 'children'> {
  setup: (p: P5CanvasInstance, store: any) => void;
  draw: (p: P5CanvasInstance, store: any) => void;

  aspectRatio?: number;
}
