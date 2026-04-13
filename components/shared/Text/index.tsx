import type { HeadingTextProps, BodyTextProps, DataTextProps } from './types';

import cx from 'classnames';
import React from 'react';

import { responsiveStyleList } from '@/utilities/css-utils';
import { wrapResponsive } from '@/utilities/opaque-responsive';

import * as styles from './Text.module.css';

export function HeadingText({ as: Component = 'h3', size = 'md', className, children, ...props }: HeadingTextProps) {
  const responsiveSize = wrapResponsive(size);
  const classList = cx(
    styles.heading,
    responsiveStyleList(responsiveSize, (value, bp) => styles[`heading-size-${value}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}

export function BodyText({ as: Component = 'p', size = 'md', className, children, ...props }: BodyTextProps) {
  const responsiveSize = wrapResponsive(size);
  const classList = cx(
    styles.body,
    responsiveStyleList(responsiveSize, (value, bp) => styles[`body-size-${value}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}

export function DataText({ as: Component = 'p', size = 'md', className, children, ...props }: DataTextProps) {
  const responsiveSize = wrapResponsive(size);
  const classList = cx(
    styles.data,
    responsiveStyleList(responsiveSize, (value, bp) => styles[`data-size-${value}-${bp}`]),
    className,
  );

  return (
    <Component className={classList} {...props}>
      {children}
    </Component>
  );
}
