import { useMemo } from 'react';
import type { Formula } from './types';

const lerp = (x: number, y: number, a: number) => x * (1 - a) + y * a;

interface FindLimitsOptions {
  start: number;
  end: number;
  limit?: number;
}

export function useLimits(fn: Formula, { start, end, limit = 10000 }: FindLimitsOptions) {
  return useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (let index = 0; index <= limit; index++) {
      const progress = index / limit;
      const input = lerp(start, end, progress);
      const output = fn(input);

      if (output < min) {
        min = output;
      }
      if (output > max) {
        max = output;
      }
    }

    return { min, max };
  }, [fn, start, end, limit]);
}
