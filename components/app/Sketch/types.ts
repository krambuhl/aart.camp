import type p5 from 'p5';
import type { CoreComponent } from '@/types/core';

export interface SketchProps extends Omit<CoreComponent, 'children'> {
  setup: (p: p5, store: any) => void;
  draw: (p: p5, store: any) => void;

  aspectRatio?: number;
}
