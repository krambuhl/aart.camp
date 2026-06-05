import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { constants } from '@/data';
import { manifest } from '@/sketches/manifest';
import { registry } from '@/sketches/registry';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return manifest.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = manifest.find((s) => s.slug === slug);
  if (!entry) return {};

  return {
    title: `${entry.title} — ${constants.SITE_NAME}`,
  };
}

export default async function SketchPage({ params }: Props) {
  const { slug } = await params;
  const entry = registry.find((s) => s.slug === slug);
  if (!entry) notFound();

  const SketchComponent = entry.component;

  return <SketchComponent />;
}
