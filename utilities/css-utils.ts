import type { AnyToken } from '@/types/tokens';
import { type Breakpoint, type OpaqueResponsive, reduceResponsive } from '@/utilities/opaque-responsive';

export function responsiveStyleList<T>(responsiveValues: OpaqueResponsive<T>, transform: (value: T, breakpoint: Breakpoint) => string) {
  return reduceResponsive(
    responsiveValues,
    (acc, value, breakpoint) => {
      const transformedValue = transform(value, breakpoint);
      if (transformedValue) {
        return `${acc} ${transformedValue}`;
      }
      return acc;
    },
    '',
  );
}

export function buildTokenKeyMap<T extends AnyToken>(tokens: Record<string, T>) {
  return Object.keys(tokens).reduce(
    (acc, key) => {
      const token = tokens[key as keyof typeof tokens];
      acc[token as T] = key;
      return acc;
    },
    {} as Record<T, string>,
  );
}
