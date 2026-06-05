import dynamic from 'next/dynamic';

import { manifest } from './manifest';

interface SketchEntry {
  slug: string;
  meta: { title: string; date: string };
  component: React.ComponentType;
}

// Each slug doubles as its module filename (`./<slug>.tsx`), so the component
// map is derived from the manifest — there is no second list of keys to keep
// in sync. The build fails if a manifest entry has no matching sketch file.
// This is the only place the dynamic-import graph lives; routes that need
// just metadata import the manifest instead.
export const registry: SketchEntry[] = manifest.map(({ slug, title, date }) => ({
  slug,
  meta: { title, date },
  component: dynamic(() => import(`./${slug}`)),
}));
