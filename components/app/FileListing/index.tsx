import type { FileListingProps } from './types';

import NextLink from 'next/link';
import { useMemo } from 'react';

import { Area } from '@/components/shared/Area';
import { Stack } from '@/components/shared/Stack';
import { BodyText, HeadingText } from '@/components/shared/Text';
import { tokens } from '@/tokens';

import * as styles from './FileListing.module.css';

export function FileListing({ files, ...props }: FileListingProps) {
  const fileList = useMemo(() => {
    return files
      .filter(({ name }) => name !== 'index')
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((file) => {
        const date = new Date(file.date);

        return {
          ...file,
          year: date.getFullYear(),
          month: date.getMonth(),
        };
      });
  }, [files]);

  return (
    <Area width={tokens.size.x384} {...props}>
      <Stack gap={{ xs: tokens.space.x6, sm: tokens.space.x12 }}>
        {fileList ? (
          fileList
            .filter(({ name }) => name !== 'index')
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map(({ title, date, url }) => (
              <NextLink key={title} href={url} className={styles.fileLink}>
                <Stack
                  gap={tokens.space.x16}
                  direction={{ xs: 'vertical', sm: 'horizontal' }}
                  className={styles.fileStack}
                >
                  <HeadingText as="h3" size="xs">
                    {title}
                  </HeadingText>

                  <BodyText as="div" size="xs">
                    {new Date(date).toLocaleDateString('en-US')}
                  </BodyText>
                </Stack>
              </NextLink>
            ))
        ) : (
          <div>No Files</div>
        )}
      </Stack>
    </Area>
  );
}
