import type { P5CanvasInstance, Sketch as SketchType } from '@p5-wrapper/react';
import dynamic from 'next/dynamic';
import { type CSSProperties, useCallback, useState } from 'react';
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
  const [isStarted, setStarted] = useState(false);

  const sketch: SketchType = useCallback(
    (p: P5CanvasInstance) => {
      const store = new Map();

      p.setup = () => {
        p.frameRate(60);
        isStarted && setup?.(p, store);
      };

      p.draw = () => {
        setStarted(true);
        isStarted && draw?.(p, store);
      };
    },
    [isStarted, setup, draw],
  );

  return (
    <div className={styles.sketch} style={{ '--sketch-aspect-ratio': aspectRatio } as CSSProperties} {...props}>
      <SketchWrapper sketch={sketch} />
    </div>
  );
}
