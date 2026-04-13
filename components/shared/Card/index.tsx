import cx from 'classnames';

import * as styles from './Card.module.css';
import type { CardProps } from './types';

export function Card({ padding, className, children, ...props }: CardProps) {
  const classList = cx(
    styles.root,
    {
      [styles.paddingNone]: padding === 'none',
      [styles.paddingDefault]: padding === 'default',
    },
    className,
  );
  return (
    <div {...props} className={classList}>
      {children}
    </div>
  );
}

export function CardPadding({ padding, className, children, ...props }: CardProps) {
  const classList = cx(
    {
      [styles.paddingNone]: padding === 'none',
      [styles.paddingDefault]: padding === 'default',
    },
    className,
  );
  return (
    <div {...props} className={classList}>
      {children}
    </div>
  );
}
