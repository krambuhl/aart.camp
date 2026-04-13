import type { AppLayoutProps } from './types';

import cx from 'classnames';

import { Area } from '@/components/shared/Area';
import { Spacer } from '@/components/shared/Spacer';
import { tokens } from '@/tokens';

import * as styles from './AppLayout.module.css';

export function AppLayout({ width = tokens.size.x1280, className, children, ...props }: AppLayoutProps) {
  const classList = cx(styles.root, className);
  return (
    <Area width={width} {...props} className={classList}>
      <Spacer
        id="content"
        pv={{
          xs: tokens.space.x32,
          sm: tokens.space.x56,
        }}
        ph={tokens.space.x24}
        className={styles.main}
      >
        {children}
      </Spacer>
    </Area>
  );
}
