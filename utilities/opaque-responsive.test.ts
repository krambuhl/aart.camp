import { describe, expect, it } from 'vitest';

import { unwrapResponsive, wrapResponsive } from '@/utilities/opaque-responsive';

describe('wrapResponsive', () => {
  it('returns an empty responsive object when given undefined', () => {
    const result = wrapResponsive(undefined);
    expect(unwrapResponsive(result)).toEqual({});
  });

  it('wraps a single value under the xs breakpoint', () => {
    const result = wrapResponsive(10);
    expect(unwrapResponsive(result)).toEqual({ xs: 10 });
  });

  it('preserves an already-responsive object unchanged', () => {
    const result = wrapResponsive({ xs: 10, md: 20 });
    expect(unwrapResponsive(result)).toEqual({ xs: 10, md: 20 });
  });
});
