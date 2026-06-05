import NextLink from 'next/link';
import { Stack } from '@/components/shared/Stack';
import { DataText, HeadingText } from '@/components/shared/Text';
import { tokens } from '@/tokens';
import * as styles from './FileListing.module.css';
import type { FileListingProps } from './types';

export function FileListing({ files, ...props }: FileListingProps) {
  const fileList = files.filter(({ name }) => name !== 'index').sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Stack alignment="start" gap={{ xs: tokens.space.x12, sm: tokens.space.x16 }} {...props}>
      {fileList ? (
        fileList.map(({ title, date, url }) => (
          <NextLink key={title} href={url} className={styles.fileLink}>
            <Stack
              alignment={{ xs: 'start', sm: 'baseline' }}
              gap={{ xs: tokens.space.x2, sm: tokens.space.x16 }}
              direction={{ xs: 'vertical', sm: 'horizontal' }}
              className={styles.fileStack}
            >
              <HeadingText as="h3" size="xs">
                {title}
              </HeadingText>

              <DataText as="div" size="xs">
                {new Date(date).toLocaleDateString('en-US')}
              </DataText>
            </Stack>
          </NextLink>
        ))
      ) : (
        <div>No Files</div>
      )}
    </Stack>
  );
}
