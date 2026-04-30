import cx from 'classnames';
import { Area } from '@/components/shared/Area';
import { Spacer } from '@/components/shared/Spacer';
import { tokens } from '@/tokens';
import * as styles from './AppLayout.module.css';
import type { AppLayoutProps } from './types';

export function AppLayout({ width = tokens.size.x1280, className, children, topBar, footer, centerContent, ...props }: AppLayoutProps) {
  const classList = cx(styles.root, className);
  const mainClass = cx(styles.main, centerContent && styles.centered);
  return (
    <Area width={width} {...props} className={classList}>
      {topBar}
      <Spacer
        id="content"
        pv={{
          xs: tokens.space.x24,
          sm: tokens.space.x32,
        }}
        ph={tokens.space.x24}
        className={mainClass}
      >
        {children}
      </Spacer>
      {footer}
    </Area>
  );
}
