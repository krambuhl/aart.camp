import cx from 'classnames';

import { CoreComponent } from '@/types/core';

import * as styles from './Grid.module.css';

export type GridProps = CoreComponent;

export function Grid({ className, children, ...props }: GridProps) {
  const classList = cx(styles.grid, className);
  return (
    <div {...props} className={classList}>
      {children}
    </div>
  );
}
