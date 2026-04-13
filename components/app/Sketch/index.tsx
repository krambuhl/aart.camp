import dynamic from 'next/dynamic';
import type P5 from 'p5';
import { type CSSProperties, useCallback, useState } from 'react';
import type { Sketch as SketchType } from 'react-p5-wrapper';
import { BodyText } from '@/components/shared/Text';
import * as styles from './Sketch.module.css';
import type { SketchProps } from './types';

const SketchWrapper = dynamic(
  async () => {
    const mod = await import('react-p5-wrapper');

    return mod.ReactP5Wrapper;
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
    (p: P5) => {
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
