'use client';

// Smoke-test fixture for the antagonist evaluator panel.
//
// Intentionally contains a11y catalog hits (missing alt on <img>,
// button without an accessible name) and a nextjs catalog hit
// ('use client' declared but no browser API / hook used —
// `nextjs-use-client-unused`).
//
// Lives outside Biome's `files.includes` and check-nextjs's
// SCOPE_DIRS, so the antipatterns do not pollute repo-wide CLI
// signals. Not imported anywhere; dead code from Next.js's perspective.
//
// See ./README.md for the fixture convention. Authored in the
// Phase 2 D8 smoke test of the 2026-05-02-agent-guilds project.

interface BadImageProps {
  src: string;
  caption: string;
}

export function BadImage({ src, caption }: BadImageProps) {
  return (
    <section>
      <img src={src} />
      <button type="button">
        <span aria-hidden="true">×</span>
      </button>
      <p>{caption}</p>
    </section>
  );
}
