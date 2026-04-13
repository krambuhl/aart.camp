import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { PageHeader } from 'components/shared/PageHeader';
import { Stack } from 'components/shared/Stack';
import { constants } from 'data';
import { registry } from 'sketches/registry';
import { tokens } from 'tokens';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return registry.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = registry.find((s) => s.slug === slug);
  if (!entry) return {};

  return {
    title: `${entry.meta.title} — ${constants.SITE_NAME}`,
  };
}

export default async function SketchPage({ params }: Props) {
  const { slug } = await params;
  const entry = registry.find((s) => s.slug === slug);
  if (!entry) notFound();

  const SketchComponent = entry.component;

  return (
    <Stack gap={tokens.space.x24}>
      <PageHeader title={entry.meta.title} date={entry.meta.date} />
      <SketchComponent />
    </Stack>
  );
}
