import Link from 'next/link';
import { Stack } from '@/components/shared/Stack';
import { BodyText } from '@/components/shared/Text';
import { tokens } from '@/tokens';
import * as styles from './SketchNav.module.css';
import type { SketchNavProps } from './types';

export function SketchNav({ prev, next }: SketchNavProps) {
  if (!prev && !next) return null;

  return (
    <Stack
      as="footer"
      direction={{ xs: 'vertical', sm: 'horizontal' }}
      alignment={{ xs: 'start', sm: 'center' }}
      justify={{ xs: 'start', sm: 'between' }}
      gap={tokens.space.x12}
      className={styles.root}
    >
      {prev ? (
        <Link href={`/sketch/${prev.slug}`} className={styles.link}>
          <BodyText as="span" size="sm">
            ← {prev.title}
          </BodyText>
        </Link>
      ) : (
        <span className={styles.placeholder} />
      )}

      {next ? (
        <Link href={`/sketch/${next.slug}`} className={styles.link}>
          <BodyText as="span" size="sm">
            {next.title} →
          </BodyText>
        </Link>
      ) : (
        <span className={styles.placeholder} />
      )}
    </Stack>
  );
}
