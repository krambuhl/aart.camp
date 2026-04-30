import type { P5CanvasInstance, Sketch as SketchType } from '@p5-wrapper/react';
import dynamic from 'next/dynamic';
import { type CSSProperties, useCallback, useRef } from 'react';
import { BodyText } from '@/components/shared/Text';
import * as styles from './Sketch.module.css';
import type { SketchProps } from './types';

const SketchWrapper = dynamic(
  async () => {
    const mod = await import('@p5-wrapper/react');

    return mod.P5Canvas;
  },
  {
    ssr: false,
    loading: () => (
      <BodyText size="sm" className={styles.loading}>
        loading...
      </BodyText>
    ),
  },
);

export function Sketch({ setup, draw, aspectRatio, ...props }: SketchProps) {
  // Keep latest setup/draw in refs so the sketch callback identity stays stable
  // across re-renders. P5Canvas creates a new p5 instance whenever the sketch
  // prop changes; an unstable callback leaves the previous canvas mounted.
  const setupRef = useRef(setup);
  const drawRef = useRef(draw);
  setupRef.current = setup;
  drawRef.current = draw;

  const sketch: SketchType = useCallback((p: P5CanvasInstance) => {
    const store = new Map();

    p.setup = () => {
      p.frameRate(60);
      setupRef.current?.(p, store);
    };

    p.draw = () => {
      drawRef.current?.(p, store);
    };
  }, []);

  return (
    <div className={styles.sketch} style={{ '--sketch-aspect-ratio': aspectRatio } as CSSProperties} {...props}>
      <SketchWrapper sketch={sketch} />
    </div>
  );
}
