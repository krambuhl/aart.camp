import cx from 'classnames';

import { tokens } from '@/tokens';
import type { CoreComponent } from '@/types/core';
import type { SizeToken } from '@/types/tokens';
import { buildTokenKeyMap, responsiveStyleList } from '@/utilities/css-utils';
import { type ValueOrResponsive, wrapResponsive } from '@/utilities/opaque-responsive';

import * as styles from './Area.module.css';

const sizeTokenMap = buildTokenKeyMap(tokens.size);

export interface AreaProps extends CoreComponent {
  as?: 'div' | 'section' | 'header' | 'footer';
  width?: ValueOrResponsive<SizeToken>;
}

export function Area({ as: Component = 'div', width = tokens.size.x768, className, children, ...props }: AreaProps) {
  const responsiveWidth = wrapResponsive(width);
  const classList = cx(
    styles.root,
    responsiveStyleList(responsiveWidth, (value, bp) => styles[`w-${sizeTokenMap[value]}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}
