import cx from 'classnames';
import { tokens } from '@/tokens';
import { buildTokenKeyMap, responsiveStyleList } from '@/utilities/css-utils';
import { wrapResponsive } from '@/utilities/opaque-responsive';
import * as styles from './Stack.module.css';
import type { StackProps } from './types';

const spaceTokenMap = buildTokenKeyMap(tokens.space);

export function Stack({
  as: Component = 'div',
  direction = 'vertical',
  alignment = 'center',
  justify = 'start',
  gap = tokens.space.x0,
  className,
  children,
  ...props
}: StackProps) {
  const responsiveDirection = wrapResponsive(direction);
  const responsiveAlignment = wrapResponsive(alignment);
  const responsiveJustify = wrapResponsive(justify);
  const responsiveGap = wrapResponsive(gap);
  const classList = cx(
    styles.root,
    responsiveStyleList(responsiveDirection, (value, bp) => styles[`direction-${value}-${bp}`]),
    responsiveStyleList(responsiveAlignment, (value, bp) => styles[`alignment-${value}-${bp}`]),
    responsiveStyleList(responsiveJustify, (value, bp) => styles[`justify-${value}-${bp}`]),
    responsiveStyleList(responsiveGap, (value, bp) => styles[`gap-${spaceTokenMap[value]}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}
