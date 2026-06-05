import dynamic from 'next/dynamic';

import { manifest } from './manifest';

interface SketchEntry {
  slug: string;
  meta: { title: string; date: string };
  component: React.ComponentType;
}

// Per-sketch component factories, keyed by slug. This is the only place the
// dynamic-import graph lives — routes that need just metadata import the
// manifest instead, keeping the import(...) wiring out of their bundle.
const components: Record<string, React.ComponentType> = {
  '1-formulas': dynamic(() => import('./1-formulas')),
  '2-particle-blob': dynamic(() => import('./2-particle-blob')),
  '3-big-donut': dynamic(() => import('./3-big-donut')),
  '4-big-diamond': dynamic(() => import('./4-big-diamond')),
  '5-donuts-are-for-winners': dynamic(() => import('./5-donuts-are-for-winners')),
  '6-splitting-stars': dynamic(() => import('./6-splitting-stars')),
  '7-old-school-grid': dynamic(() => import('./7-old-school-grid')),
  '8-grid-a': dynamic(() => import('./8-grid-a')),
  '9-grid-b': dynamic(() => import('./9-grid-b')),
  '10-grid-c': dynamic(() => import('./10-grid-c')),
  '11-grid-d': dynamic(() => import('./11-grid-d')),
  '12-grid-e': dynamic(() => import('./12-grid-e')),
  '13-back-to-the-third-dimension': dynamic(() => import('./13-back-to-the-third-dimension')),
  '14-back-to-3d': dynamic(() => import('./14-back-to-3d')),
  '20-grid-f': dynamic(() => import('./20-grid-f')),
  '21-shading': dynamic(() => import('./21-shading')),
  '22-sprial-checkers': dynamic(() => import('./22-sprial-checkers')),
  '23-sprial-machine': dynamic(() => import('./23-sprial-machine')),
  '24-beep-boop': dynamic(() => import('./24-beep-boop')),
  '25-big-sprial': dynamic(() => import('./25-big-sprial')),
  '26-robitman': dynamic(() => import('./26-robitman')),
  '27-super-quilts-du': dynamic(() => import('./27-super-quilts-du')),
  '28-super-quilts-tres': dynamic(() => import('./28-super-quilts-tres')),
  '29-detector': dynamic(() => import('./29-detector')),
  '30-detector-quilt': dynamic(() => import('./30-detector-quilt')),
  '31-state-machine-spiral': dynamic(() => import('./31-state-machine-spiral')),
  '32-spiral-checkers-2': dynamic(() => import('./32-spiral-checkers-2')),
  '33-spiral-checkers-3': dynamic(() => import('./33-spiral-checkers-3')),
  '34-spiral-checkers-4': dynamic(() => import('./34-spiral-checkers-4')),
  '35-broken-spiral': dynamic(() => import('./35-broken-spiral')),
  '35-spiral-checkers-5': dynamic(() => import('./35-spiral-checkers-5')),
  '36-reignite': dynamic(() => import('./36-reignite')),
  '37-walker-ranger': dynamic(() => import('./37-walker-ranger')),
  '38-walker-ranger-2': dynamic(() => import('./38-walker-ranger-2')),
  '39-walking-buddy': dynamic(() => import('./39-walking-buddy')),
  '40-the-spins': dynamic(() => import('./40-the-spins')),
  '41-hell-yea': dynamic(() => import('./41-hell-yea')),
  '42-robot-thought': dynamic(() => import('./42-robot-thought')),
  '43-robot-thought-2': dynamic(() => import('./43-robot-thought-2')),
  '44-robot-thought-3': dynamic(() => import('./44-robot-thought-3')),
  '45-robot-thought-4': dynamic(() => import('./45-robot-thought-4')),
  '46-robot-thought-5': dynamic(() => import('./46-robot-thought-5')),
  '47-robot-thought-6': dynamic(() => import('./47-robot-thought-6')),
  '48-robot-thought-7': dynamic(() => import('./48-robot-thought-7')),
  '49-robot-thought-8': dynamic(() => import('./49-robot-thought-8')),
  '50-robot-thought-9': dynamic(() => import('./50-robot-thought-9')),
  '51-robot-thought-10': dynamic(() => import('./51-robot-thought-10')),
  '52-robot-thought-11': dynamic(() => import('./52-robot-thought-11')),
  '53-tsuru': dynamic(() => import('./53-tsuru')),
  '54-haneda-night': dynamic(() => import('./54-haneda-night')),
  '55-omakase': dynamic(() => import('./55-omakase')),
  '56-engimono': dynamic(() => import('./56-engimono')),
  '57-super-quilts-cuatro': dynamic(() => import('./57-super-quilts-cuatro')),
  '58-super-quilts-cinco': dynamic(() => import('./58-super-quilts-cinco')),
  '59-super-quilts-seis': dynamic(() => import('./59-super-quilts-seis')),
  '60-super-quilts-siete': dynamic(() => import('./60-super-quilts-siete')),
  '61-super-quilts-ocho': dynamic(() => import('./61-super-quilts-ocho')),
  '62-super-quilts-nueve': dynamic(() => import('./62-super-quilts-nueve')),
};

export const registry: SketchEntry[] = manifest.map(({ slug, title, date }) => ({
  slug,
  meta: { title, date },
  component: components[slug],
}));
