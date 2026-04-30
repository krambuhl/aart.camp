import Link from 'next/link';
import { Stack } from '@/components/shared/Stack';
import { BodyText, DataText } from '@/components/shared/Text';
import { constants } from '@/data';
import { tokens } from '@/tokens';
import * as styles from './TopBar.module.css';
import type { TopBarProps } from './types';

export function TopBar({ title, date }: TopBarProps) {
  const isSubpage = Boolean(title);

  return (
    <Stack
      as="header"
      direction={{ xs: 'vertical', sm: 'horizontal' }}
      alignment={{ xs: 'start', sm: 'baseline' }}
      justify="start"
      gap={{ xs: tokens.space.x4, sm: tokens.space.x16 }}
      className={styles.root}
    >
      <Link href="/" className={styles.brand}>
        <BodyText as="span" size="sm">
          {isSubpage ? `← ${constants.SITE_NAME}` : constants.SITE_NAME}
        </BodyText>
      </Link>

      {title && (
        <BodyText as="span" size="sm" className={styles.title}>
          {title}
        </BodyText>
      )}

      {date && (
        <DataText as="span" size="xs">
          {new Date(date).toLocaleDateString()}
        </DataText>
      )}
    </Stack>
  );
}
