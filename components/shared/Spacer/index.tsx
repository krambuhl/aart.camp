import type { SpacerProps } from './types';

import cx from 'classnames';
import React from 'react';

import { tokens } from '@/tokens';
import { buildTokenKeyMap, responsiveStyleList } from '@/utilities/css-utils';

import * as styles from './Spacer.module.css';
import { wrapAndMergeResponsiveSides } from './lib';

const spaceTokenMap = buildTokenKeyMap(tokens.space);

export function Spacer({
  as: Component = 'div',
  ma,
  mh,
  mv,
  mt,
  mr,
  mb,
  ml,
  pa,
  ph,
  pv,
  pt,
  pr,
  pb,
  pl,
  className,
  children,
  ...props
}: SpacerProps) {
  const padding = wrapAndMergeResponsiveSides({
    a: pa,
    v: pv,
    h: ph,
    t: pt,
    b: pb,
    l: pl,
    r: pr,
  });
  const margin = wrapAndMergeResponsiveSides({
    a: ma,
    v: mv,
    h: mh,
    t: mt,
    b: mb,
    l: ml,
    r: mr,
  });

  const classList = cx(
    styles.root,
    responsiveStyleList(padding.top, (value, bp) => styles[`pt-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(padding.bottom, (value, bp) => styles[`pb-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(padding.left, (value, bp) => styles[`pl-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(padding.right, (value, bp) => styles[`pr-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(margin.top, (value, bp) => styles[`mt-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(margin.bottom, (value, bp) => styles[`mb-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(margin.left, (value, bp) => styles[`ml-${spaceTokenMap[value]}-${bp}`]),
    responsiveStyleList(margin.right, (value, bp) => styles[`mr-${spaceTokenMap[value]}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}

<Spacer mt={tokens.space.x24} mb={{ xs: tokens.space.x32, sm: tokens.space.x48 }} />;
