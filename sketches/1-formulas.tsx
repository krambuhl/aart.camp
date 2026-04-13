'use client';

import type { FormulaSketchProps } from 'components/app/FormulaSketch/types';

import { useMemo } from 'react';

import { FormulaSketch } from 'components/app/FormulaSketch';
import { Area } from 'components/shared/Area';
import { Grid } from 'components/shared/Grid';
import { tokens } from 'tokens';

export const meta = {
  title: 'Formulas',
  date: '2022-04-03',
};

export default function FormulaList() {
  const formulaList = useMemo(() => getFormulas(), []);

  return (
    <Area width={tokens.size.x768}>
    <Grid>
      {formulaList.map((config, i) => (
        <FormulaSketch key={i} {...config} />
      ))}
    </Grid>
  </Area>
  );
}

function getFormulas(): FormulaSketchProps[] {
  return [
    {
      formulaName: 'f(x) = sin(x)',
      formula: (x: number) => Math.sin(x),
    },
    {
      formulaName: 'f(x) = cos(x)',
      formula: (x: number) => Math.cos(x),
    },
    {
      formulaName: 'f(x) = tan(x)',
      formula: (x: number) => Math.tan(x),
      min: -4,
      max: 4,
    },
    {
      formulaName: 'f(x) = log(x)',
      formula: (x: number) => Math.log(x),
      min: 0,
    },
  ];
}
