import { FileListing } from '@/components/app/FileListing';
import { AppLayout } from '@/components/shared/AppLayout';
import { Stack } from '@/components/shared/Stack';
import { HeadingText } from '@/components/shared/Text';
import { TopBar } from '@/components/shared/TopBar';
import { registry } from '@/sketches/registry';
import { tokens } from '@/tokens';

const files = registry.map(({ slug, meta }) => ({
  name: slug,
  title: meta.title,
  date: meta.date,
  url: `/sketch/${slug}`,
}));

export default function Home() {
  return (
    <AppLayout topBar={<TopBar />} width={tokens.size.x768}>
      <Stack alignment="start" gap={tokens.space.x24}>
        <HeadingText as="h1" size={{ xs: 'lg', sm: 'xl' }}>
          Sketches
        </HeadingText>
        <FileListing files={files} />
      </Stack>
    </AppLayout>
  );
}
