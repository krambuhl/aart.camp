'use client';

import type p5 from 'p5';
import { type CSSProperties, useEffect, useRef } from 'react';
import * as styles from './Sketch.module.css';
import type { SketchProps } from './types';

export function Sketch({ setup, draw, aspectRatio, ...props }: SketchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setupRef = useRef(setup);
  const drawRef = useRef(draw);
  setupRef.current = setup;
  drawRef.current = draw;

  useEffect(() => {
    let instance: p5 | null = null;
    let cancelled = false;

    void (async () => {
      const { default: P5 } = await import('p5');
      if (cancelled || !containerRef.current) return;

      const store = new Map();
      instance = new P5((p) => {
        p.setup = () => {
          p.frameRate(60);
          setupRef.current?.(p, store);
        };
        p.draw = () => {
          drawRef.current?.(p, store);
        };
      }, containerRef.current);
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      instance = null;
    };
  }, []);

  return (
    <div className={styles.sketch} style={{ '--sketch-aspect-ratio': aspectRatio } as CSSProperties} {...props}>
      <div ref={containerRef} />
    </div>
  );
}
