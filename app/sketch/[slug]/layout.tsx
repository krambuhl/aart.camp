import { notFound } from 'next/navigation';
import { AppLayout } from '@/components/shared/AppLayout';
import { TopBar } from '@/components/shared/TopBar';
import { registry } from '@/sketches/registry';

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SketchLayout({ children, params }: Props) {
  const { slug } = await params;
  const entry = registry.find((s) => s.slug === slug);
  if (!entry) notFound();

  return <AppLayout topBar={<TopBar title={entry.meta.title} date={entry.meta.date} />}>{children}</AppLayout>;
}
