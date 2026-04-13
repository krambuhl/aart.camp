import { FileListing } from 'components/app/FileListing';
import { PageHeader } from 'components/shared/PageHeader';
import { Spacer } from 'components/shared/Spacer';
import { Stack } from 'components/shared/Stack';
import { registry } from 'sketches/registry';
import { tokens } from 'tokens';

const files = registry.map(({ slug, meta }) => ({
  name: slug,
  title: meta.title,
  date: meta.date,
  url: `/sketch/${slug}`,
}));

export default function Home() {
  return (
    <Stack>
      <PageHeader title="Sketches" />
      <Spacer pt={{ xs: tokens.space.x24, sm: tokens.space.x48 }} pb={tokens.space.x24}>
        <FileListing files={files} />
      </Spacer>
    </Stack>
  );
}
