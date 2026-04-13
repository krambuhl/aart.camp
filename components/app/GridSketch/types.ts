import type { P5Color } from '@/types/p5';

export interface GridSketchProps {
  bg: P5Color;
  canvasSize: number;
  sides: number;
  padding: number;
  fill: (pos: { x: number; y: number }, frame: number) => string;
}
