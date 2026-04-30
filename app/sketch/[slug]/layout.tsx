import { notFound } from 'next/navigation';
import { AppLayout } from '@/components/shared/AppLayout';
import { SketchNav } from '@/components/shared/SketchNav';
import { TopBar } from '@/components/shared/TopBar';
import { registry } from '@/sketches/registry';

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SketchLayout({ children, params }: Props) {
  const { slug } = await params;
  const idx = registry.findIndex((s) => s.slug === slug);
  if (idx === -1) notFound();

  const entry = registry[idx];
  const prevEntry = idx > 0 ? registry[idx - 1] : null;
  const nextEntry = idx < registry.length - 1 ? registry[idx + 1] : null;

  const prev = prevEntry ? { slug: prevEntry.slug, title: prevEntry.meta.title } : null;
  const next = nextEntry ? { slug: nextEntry.slug, title: nextEntry.meta.title } : null;

  return (
    <AppLayout topBar={<TopBar title={entry.meta.title} date={entry.meta.date} />} footer={<SketchNav prev={prev} next={next} />} centerContent>
      {children}
    </AppLayout>
  );
}
