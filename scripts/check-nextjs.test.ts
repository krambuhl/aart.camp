// check-nextjs.test.ts — vitest coverage for analyzeFile.
//
// Cases exercise the headline detection branches: use-client correctness
// (both directions), sketch exception, framework antipatterns (<img>,
// raw <a href>, Pages-Router APIs, <head> JSX), plus a clean baseline.

import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { analyzeFile } from './check-nextjs.ts';

const ROOT = process.cwd();
const p = (rel: string) => join(ROOT, rel);

describe('check-nextjs', () => {
  test('flags file using a hook without use client', () => {
    const source = `
      import { useState } from 'react';
      export function Counter() {
        const [n, setN] = useState(0);
        return <div>{n}</div>;
      }
    `;
    const findings = analyzeFile(p('components/Counter.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-missing')).toBe(true);
  });

  test('flags file using a JSX event handler without use client', () => {
    const source = `
      export function Button() {
        return <button onClick={() => {}}>click</button>;
      }
    `;
    const findings = analyzeFile(p('components/Button.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-missing')).toBe(true);
  });

  test('flags file using a browser global without use client', () => {
    const source = `
      export function Page() {
        const w = window.innerWidth;
        return <div>{w}</div>;
      }
    `;
    const findings = analyzeFile(p('app/page.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-missing')).toBe(true);
  });

  test('flags vacuous use client (no client features, not a sketch)', () => {
    const source = `
      'use client';
      export function StaticBlurb() {
        return <p>hello</p>;
      }
    `;
    const findings = analyzeFile(p('components/StaticBlurb.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-vacuous')).toBe(true);
  });

  test('does NOT flag vacuous use client when file is under sketches/', () => {
    const source = `
      'use client';
      import { Sketch } from '@/components/app/Sketch';
      export function MySketch() {
        return <Sketch setup={() => {}} draw={() => {}} />;
      }
    `;
    const findings = analyzeFile(p('sketches/53-my-sketch.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-vacuous')).toBe(false);
  });

  test('does NOT flag vacuous use client when component renders <Sketch>', () => {
    // Sketch rendering qualifies for the p5-wrapper exception even outside sketches/.
    const source = `
      'use client';
      import { Sketch } from '@/components/app/Sketch';
      export function FeaturedSketch() {
        return <Sketch setup={() => {}} draw={() => {}} />;
      }
    `;
    const findings = analyzeFile(p('components/FeaturedSketch.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-vacuous')).toBe(false);
  });

  test('does NOT flag use client + hooks combo (correctly client)', () => {
    const source = `
      'use client';
      import { useState } from 'react';
      export function Counter() {
        const [n, setN] = useState(0);
        return <button onClick={() => setN(n + 1)}>{n}</button>;
      }
    `;
    const findings = analyzeFile(p('components/Counter.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-use-client-missing')).toBe(false);
    expect(findings.some((f) => f.code === 'nextjs-use-client-vacuous')).toBe(false);
  });

  test('flags <img> in a component file', () => {
    const source = `
      export function Avatar() {
        return <img src="/avatar.png" alt="me" />;
      }
    `;
    const findings = analyzeFile(p('components/Avatar.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-img-not-image')).toBe(true);
  });

  test('flags raw <a href="/..."> internal link in a component', () => {
    const source = `
      export function HomeLink() {
        return <a href="/about">About</a>;
      }
    `;
    const findings = analyzeFile(p('components/HomeLink.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-anchor-not-link')).toBe(true);
  });

  test('does NOT flag <a href="https://..."> external link', () => {
    const source = `
      export function ExtLink() {
        return <a href="https://example.com">ext</a>;
      }
    `;
    const findings = analyzeFile(p('components/ExtLink.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-anchor-not-link')).toBe(false);
  });

  test('flags getServerSideProps in app/ file', () => {
    const source = `
      export async function getServerSideProps() {
        return { props: {} };
      }
      export default function Page() {
        return <div>page</div>;
      }
    `;
    const findings = analyzeFile(p('app/page.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-pages-router-api')).toBe(true);
  });

  test('flags <head> JSX in app/ file', () => {
    const source = `
      export default function Layout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <head><title>oops</title></head>
            <body>{children}</body>
          </html>
        );
      }
    `;
    const findings = analyzeFile(p('app/layout.tsx'), source);
    expect(findings.some((f) => f.code === 'nextjs-head-not-metadata')).toBe(true);
  });

  test('clean component file produces no findings', () => {
    const source = `
      import type { ReactNode } from 'react';
      export function Wrap({ children }: { children: ReactNode }) {
        return <div className="wrap">{children}</div>;
      }
    `;
    const findings = analyzeFile(p('components/Wrap.tsx'), source);
    expect(findings).toEqual([]);
  });
});
