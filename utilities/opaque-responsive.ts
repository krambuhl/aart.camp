import { tokens } from '@/tokens';

import { breakpointNames } from './breakpoints';

// The breakpoints that we support in our design system
export type Breakpoint = keyof typeof tokens.breakpoint;

// A responsive property is a value which can change between breakpoints
export type Responsive<T> = Partial<Record<Breakpoint, T>>;

// Symbols are used to make it difficult to access responsive values directly
const isResponsiveKey = Symbol();
const isResponsiveValue = Symbol();
const responsiveValue = Symbol();

/**
 * An opaque object that wraps a responsive value. we use symbols to make it
 * difficult to access responsive value directly.
 */
export class OpaqueResponsive<T> {
  public [isResponsiveKey] = isResponsiveValue;
  public [responsiveValue]: Responsive<T>;
  constructor(value: Responsive<T>) {
    this[responsiveValue] = value ?? {};
  }
}

/**
 * Either a single value or a responsive object of a certain type
 */
export type ValueOrResponsive<T> = T | Responsive<T>;

/**
 * Creates an opaque object that wraps a responsive value
 */
export function wrapResponsive<T>(value?: ValueOrResponsive<T> | OpaqueResponsive<T>): OpaqueResponsive<T> {
  // if the value is undefined, we create a responsive object with the value set to undefined
  if (value === undefined || value === null || value === false) {
    return new OpaqueResponsive({});
  }

  // If the value is already a wrapped responsive value, return it as is
  if (value instanceof OpaqueResponsive) {
    return value;
  }

  // here we duck-type the value to see if it is a responsive object
  // we check if the object has any of the breakpoints or if it is an empty object
  if (isResponsive(value)) {
    return new OpaqueResponsive(value);
  }

  // if the value is not a responsive object, we create a responsive object from the single value
  return new OpaqueResponsive({ xs: value as T });
}

/**
 * Unwraps a responsive value from a wrapped responsive object and throws an error
 * if the value is not a OpaqueResponsive object.
 */
export function unwrapResponsive<T>(value: OpaqueResponsive<T>): Responsive<T> {
  if (!(isResponsiveKey in value) || value[isResponsiveKey] !== isResponsiveValue) {
    throw new Error(`Invalid responsive value: ${value}`);
  }

  return value[responsiveValue];
}

export function mapResponsive<T, U>(value: OpaqueResponsive<T>, fn: (value: T) => U): Responsive<U> {
  const unwrapped = unwrapResponsive(value);
  const mapped: Responsive<U> = {};

  for (const breakpointName of breakpointNames) {
    if (unwrapped[breakpointName] !== undefined) {
      mapped[breakpointName] = fn(unwrapped[breakpointName]);
    }
  }

  return mapped;
}

export function reduceResponsive<T, U>(
  value: OpaqueResponsive<T>,
  fn: (acc: U, value: T, breakpointName: Breakpoint) => U,
  initialValue: U,
): U {
  const unwrapped = unwrapResponsive(value);
  let acc = initialValue;

  for (const breakpointName of breakpointNames) {
    if (unwrapped[breakpointName] !== undefined) {
      acc = fn(acc, unwrapped[breakpointName], breakpointName);
    }
  }

  return acc;
}

/**
 * Merge multiple responsive values into a single responsive value
 * where the values are merged together
 */
export function mergeResponsive<T>(values: Array<OpaqueResponsive<T>>): OpaqueResponsive<T> {
  const merged: Responsive<T> = {};

  for (const opaqueResponsiveValue of values) {
    const unwrappedResponsive = unwrapResponsive(opaqueResponsiveValue);

    for (const breakpointName of breakpointNames) {
      if (unwrappedResponsive[breakpointName] !== undefined) {
        merged[breakpointName] = unwrappedResponsive[breakpointName];
      }
    }
  }

  return wrapResponsive(merged);
}

/**
 * Merge multiple responsive values into a unified responsive value
 * with keys that are merged together
 */
export function mergeNamedResponsive<T>(values: {
  [K in keyof T]: OpaqueResponsive<T[K]>;
}): OpaqueResponsive<Partial<T>> {
  // build up a new object with the merged values
  const merged: Responsive<Partial<T>> = {};

  // keep track of all the values so we can group them by breakpoint later
  const allValues: { [K in keyof T]?: Responsive<T[K]> } = {};

  // keep track of the latest values so we can cascade them later
  const latestValues: Partial<T> = {};

  // eslint-disable-next-line guard-for-in
  for (const key in values) {
    allValues[key] = unwrapResponsive(values[key]);
    latestValues[key] = allValues[key]?.xs;
  }

  for (const breakpointName of breakpointNames) {
    let usesBreakpoint = false;

    // eslint-disable-next-line guard-for-in
    for (const key in allValues) {
      const unwrappedValue = allValues[key];

      if (unwrappedValue?.[breakpointName] !== undefined) {
        usesBreakpoint = true;
        latestValues[key] = unwrappedValue[breakpointName];
      }
    }

    // only add the latest values if this breakpoint shows
    // up in any ofthe responsive values
    if (usesBreakpoint) {
      merged[breakpointName] = { ...latestValues };
    }
  }

  return wrapResponsive(merged);
}

/**
 * Merge multiple responsive values into a single responsive value
 * where the values are merged together with values cascading from
 * smaller breakpoints to larger breakpoints like in CSS media queries
 *
 * For example, if we have the following values:
 * - p: { xs: 10, sm: 20, md: 30 }
 * - pv: { xs: 5, md: 15 }
 *
 * we would get the following merged values:
 * - { xs: 5, sm: 5, md: 15, lg: 15, xl: 15, xxl: 15 }
 */
export function mergeResponsivePreferringLastValue<T>(values: Array<OpaqueResponsive<T>>): OpaqueResponsive<T> {
  const merged: Responsive<T> = {};
  const unwrappedValues = values.map(unwrapResponsive);
  const latestValues = [];

  for (const breakpointName of breakpointNames) {
    let head: T | undefined;

    for (let i = 0; i < unwrappedValues.length; i++) {
      const unwrappedValue = unwrappedValues[i];

      if (unwrappedValue[breakpointName] !== undefined) {
        latestValues[i] = unwrappedValue[breakpointName];
      }

      head = latestValues[i] ?? head;
    }

    if (head !== undefined) {
      merged[breakpointName] = head;
    }
  }

  return wrapResponsive(merged);
}

/**
 * Predicate to check if an opaque object has values
 */
export function hasResponsiveValue<T>(value: OpaqueResponsive<T>) {
  const unwrapped = unwrapResponsive(value);
  return Object.keys(unwrapped).length > 0;
}

/**
 * Predicate to check if a value is a responsive object
 */
export function isResponsive<T>(value: ValueOrResponsive<T>) {
  return (
    value &&
    typeof value === 'object' &&
    ('xs' in value ||
      'sm' in value ||
      'md' in value ||
      'lg' in value ||
      'xl' in value ||
      'xxl' in value ||
      Object.keys(value).length === 0)
  );
}
