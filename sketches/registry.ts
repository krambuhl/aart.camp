import dynamic from 'next/dynamic';

interface SketchEntry {
  slug: string;
  meta: { title: string; date: string };
  component: React.ComponentType;
}

export const registry: SketchEntry[] = [
  {
    slug: '1-formulas',
    meta: { title: 'Formulas', date: '2022-04-03' },
    component: dynamic(() => import('./1-formulas')),
  },
  {
    slug: '2-particle-blob',
    meta: { title: 'Particle Blob', date: '2022-04-05' },
    component: dynamic(() => import('./2-particle-blob')),
  },
  {
    slug: '3-big-donut',
    meta: { title: 'Big Donut', date: '2022-04-16' },
    component: dynamic(() => import('./3-big-donut')),
  },
  {
    slug: '4-big-diamond',
    meta: { title: 'Big Diamond', date: '2022-04-16T00:00:00' },
    component: dynamic(() => import('./4-big-diamond')),
  },
  {
    slug: '5-donuts-are-for-winners',
    meta: { title: 'Donuts are for Winners', date: '2022-05-11T00:00:00' },
    component: dynamic(() => import('./5-donuts-are-for-winners')),
  },
  {
    slug: '6-splitting-stars',
    meta: { title: 'Splitting Stars', date: '2022-05-14T00:00:00' },
    component: dynamic(() => import('./6-splitting-stars')),
  },
  {
    slug: '7-old-school-grid',
    meta: { title: 'Old School Grid', date: '2022-09-29T00:00:00' },
    component: dynamic(() => import('./7-old-school-grid')),
  },
  {
    slug: '8-grid-a',
    meta: { title: 'Grid A', date: '2022-10-02T00:00:00' },
    component: dynamic(() => import('./8-grid-a')),
  },
  {
    slug: '9-grid-b',
    meta: { title: 'Grid B', date: '2022-10-02T00:00:01' },
    component: dynamic(() => import('./9-grid-b')),
  },
  {
    slug: '10-grid-c',
    meta: { title: 'Grid C', date: '2022-10-02T00:00:02' },
    component: dynamic(() => import('./10-grid-c')),
  },
  {
    slug: '11-grid-d',
    meta: { title: 'Grid D', date: '2022-10-03T00:00:00' },
    component: dynamic(() => import('./11-grid-d')),
  },
  {
    slug: '12-grid-e',
    meta: { title: 'Grid E', date: '2022-10-03T00:00:01' },
    component: dynamic(() => import('./12-grid-e')),
  },
  {
    slug: '13-back-to-the-third-dimension',
    meta: { title: 'Back to the Third Dimension', date: '2022-10-05T00:00:00' },
    component: dynamic(() => import('./13-back-to-the-third-dimension')),
  },
  {
    slug: '14-back-to-3d',
    meta: { title: 'Back to 3d', date: '2022-10-06T00:00:00' },
    component: dynamic(() => import('./14-back-to-3d')),
  },
  {
    slug: '20-grid-f',
    meta: { title: 'Grid F', date: '2022-11-07T00:00:00' },
    component: dynamic(() => import('./20-grid-f')),
  },
  {
    slug: '21-shading',
    meta: { title: 'Shading', date: '2022-11-08T00:00:00' },
    component: dynamic(() => import('./21-shading')),
  },
  {
    slug: '22-sprial-checkers',
    meta: { title: 'Spiral Checkers', date: '2023-03-20T00:00:00' },
    component: dynamic(() => import('./22-sprial-checkers')),
  },
  {
    slug: '23-sprial-machine',
    meta: { title: 'Spiral Machine', date: '2023-03-25T00:00:00' },
    component: dynamic(() => import('./23-sprial-machine')),
  },
  {
    slug: '24-beep-boop',
    meta: { title: 'Beep Boop', date: '2023-03-28T10:00:00' },
    component: dynamic(() => import('./24-beep-boop')),
  },
  {
    slug: '25-big-sprial',
    meta: { title: 'Big Spiral', date: '2023-03-29T10:00:00' },
    component: dynamic(() => import('./25-big-sprial')),
  },
  {
    slug: '26-robitman',
    meta: { title: 'Robitman', date: '2023-03-30T10:00:00' },
    component: dynamic(() => import('./26-robitman')),
  },
  {
    slug: '27-super-quilts-du',
    meta: { title: 'Super Quilts Du', date: '2023-04-10T10:00:00' },
    component: dynamic(() => import('./27-super-quilts-du')),
  },
  {
    slug: '28-super-quilts-tres',
    meta: { title: 'Super Quilts Tres', date: '2023-04-10T11:00:00' },
    component: dynamic(() => import('./28-super-quilts-tres')),
  },
  {
    slug: '29-detector',
    meta: { title: 'Detector', date: '2023-04-10T12:00:00' },
    component: dynamic(() => import('./29-detector')),
  },
  {
    slug: '30-detector-quilt',
    meta: { title: 'Detector Quilt', date: '2023-04-10T14:00:00' },
    component: dynamic(() => import('./30-detector-quilt')),
  },
  {
    slug: '31-state-machine-spiral',
    meta: { title: 'State Machine Spiral', date: '2023-04-10T16:00:00' },
    component: dynamic(() => import('./31-state-machine-spiral')),
  },
  {
    slug: '32-spiral-checkers-2',
    meta: { title: 'Spiral Checkers 2', date: '2023-04-15T01:00:00' },
    component: dynamic(() => import('./32-spiral-checkers-2')),
  },
  {
    slug: '33-spiral-checkers-3',
    meta: { title: 'Spiral Checkers 3', date: '2023-04-18T01:00:00' },
    component: dynamic(() => import('./33-spiral-checkers-3')),
  },
  {
    slug: '34-spiral-checkers-4',
    meta: { title: 'Spiral Checkers 4', date: '2023-04-21T12:00:00' },
    component: dynamic(() => import('./34-spiral-checkers-4')),
  },
  {
    slug: '35-broken-spiral',
    meta: { title: 'Broken Spiral', date: '2023-04-22T12:00:00' },
    component: dynamic(() => import('./35-broken-spiral')),
  },
  {
    slug: '35-spiral-checkers-5',
    meta: { title: 'Spiral Checkers 5', date: '2024-09-01T01:00:00' },
    component: dynamic(() => import('./35-spiral-checkers-5')),
  },
  {
    slug: '36-reignite',
    meta: { title: 'Reignite', date: '2024-11-22T01:00:00' },
    component: dynamic(() => import('./36-reignite')),
  },
  {
    slug: '37-walker-ranger',
    meta: { title: 'Walker Ranger', date: '2024-12-12T01:00:00' },
    component: dynamic(() => import('./37-walker-ranger')),
  },
  {
    slug: '38-walker-ranger-2',
    meta: { title: 'Walker Ranger 2', date: '2024-12-12T02:00:00' },
    component: dynamic(() => import('./38-walker-ranger-2')),
  },
  {
    slug: '39-walking-buddy',
    meta: { title: 'Walking Buddy', date: '2024-12-29T01:00:00' },
    component: dynamic(() => import('./39-walking-buddy')),
  },
  {
    slug: '40-the-spins',
    meta: { title: 'The Spins', date: '2025-01-11T01:00:00' },
    component: dynamic(() => import('./40-the-spins')),
  },
  {
    slug: '41-hell-yea',
    meta: { title: 'Hell Yea', date: '2025-07-09T01:00:00' },
    component: dynamic(() => import('./41-hell-yea')),
  },
  {
    slug: '42-robot-thought',
    meta: { title: 'Robot Thought', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./42-robot-thought')),
  },
  {
    slug: '43-robot-thought-2',
    meta: { title: 'Robot Thought 2 — Chorus', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./43-robot-thought-2')),
  },
  {
    slug: '44-robot-thought-3',
    meta: { title: 'Robot Thought 3 — Interference', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./44-robot-thought-3')),
  },
  {
    slug: '45-robot-thought-4',
    meta: { title: 'Robot Thought 4 — Cardinal', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./45-robot-thought-4')),
  },
  {
    slug: '46-robot-thought-5',
    meta: { title: 'Robot Thought 5 — Fern Memory', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./46-robot-thought-5')),
  },
  {
    slug: '47-robot-thought-6',
    meta: { title: 'Robot Thought 6 — Dahlia Sun', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./47-robot-thought-6')),
  },
  {
    slug: '48-robot-thought-7',
    meta: { title: 'Robot Thought 7 — Soft Family', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./48-robot-thought-7')),
  },
  {
    slug: '49-robot-thought-8',
    meta: { title: 'Robot Thought 8 — Cardinal Drift', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./49-robot-thought-8')),
  },
  {
    slug: '50-robot-thought-9',
    meta: { title: 'Robot Thought 9 — Polar Dance', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./50-robot-thought-9')),
  },
  {
    slug: '51-robot-thought-10',
    meta: { title: 'Robot Thought 10 — Cardinal Weave', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./51-robot-thought-10')),
  },
  {
    slug: '52-robot-thought-11',
    meta: { title: 'Robot Thought 11 — Gyre', date: '2025-09-02T00:00:00' },
    component: dynamic(() => import('./52-robot-thought-11')),
  },
  {
    slug: '53-tsuru',
    meta: { title: 'Tsuru — JAL Crane', date: '2026-04-30T00:00:00' },
    component: dynamic(() => import('./53-tsuru')),
  },
  {
    slug: '54-haneda-night',
    meta: { title: 'Haneda Night — Neon Descent', date: '2026-04-30T00:00:00' },
    component: dynamic(() => import('./54-haneda-night')),
  },
  {
    slug: '55-omakase',
    meta: { title: 'Omakase', date: '2026-04-30T00:00:00' },
    component: dynamic(() => import('./55-omakase')),
  },
  {
    slug: '56-engimono',
    meta: { title: 'Engimono — Good Luck', date: '2026-04-30T00:00:00' },
    component: dynamic(() => import('./56-engimono')),
  },
];
