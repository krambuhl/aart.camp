import { useMemo } from 'react';
import type { Formula } from './types';

const min = (list: number[]) => {
  return list.reduce((cur, num) => (num < cur ? num : cur), Infinity);
};

const max = (list: number[]) => {
  return list.reduce((cur, num) => (num > cur ? num : cur), -Infinity);
};

const pair = (inputs: number[], outputs: number[]) => {
  return inputs.map((input, index) => [input, outputs[index]]);
};

export function useFormula(inputs: [number], fn: Formula) {
  const outputs = useMemo(() => inputs.map(fn), [inputs, fn]);
  const pairs = useMemo(() => pair(inputs, outputs), [inputs, outputs]);

  // min/max
  const inputMin = useMemo(() => min(inputs), [inputs]);
  const inputMax = useMemo(() => max(inputs), [inputs]);
  const outputMin = useMemo(() => min(outputs), [outputs]);
  const outputMax = useMemo(() => max(outputs), [outputs]);

  return {
    inputs,
    outputs,
    pairs,
    inputMin,
    inputMax,
    outputMin,
    outputMax,
  };
}
