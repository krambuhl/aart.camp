'use client';

import type { P5Color } from 'types/p5';

import { Sketch } from 'components/app/Sketch';
import { Area } from 'components/shared/Area';
import { HtmlTitle } from 'components/shared/HtmlTitle';
import { Stack } from 'components/shared/Stack';
import { BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange } from 'data/paint';
import { createRandomWalkerGrid } from 'lib/random-walker';
import { tokens } from 'tokens';

export const meta = {
  title: 'Robot Thought',
  date: '2025-09-02T00:00:00',
};

const bgColor: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const ratio = 1 / 1; // square
const canvasSizeX = 1280;
const canvasSizeY = 1280 * ratio;

const padding = 40;
const gutter = -0.5;

const stepsX = 61;
const stepsY = 61;
const sizeX = (canvasSizeX - padding * 2) / stepsX;
const sizeY = (canvasSizeY - padding * 2) / stepsY;

const grid = createRandomWalkerGrid({
  gridSize: [stepsX, stepsY],
  initialCell: [0, 0],
});

function lerpPalette(p: any, palette: string[], t: number) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  const scaled = clamped * (palette.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(palette.length - 1, i0 + 1);
  const frac = scaled - i0;
  const c0 = p.color(palette[i0]);
  const c1 = p.color(palette[i1]);
  return p.lerpColor(c0, c1, frac);
}

export default function Output() {
  return (
    <>
      <HtmlTitle title={meta.title} />

      <Stack gap={tokens.space.x24}>
        <Area width={tokens.size.x640}>
          <Sketch
            aspectRatio={1}
            setup={(p) => {
              p.createCanvas(canvasSizeX, canvasSizeY);
              p.noStroke();
              p.colorMode(p.HSL, 360, 100, 100, 1);
            }}
            draw={(p) => {
              // reset
              p.clear(...bgColor);

              const time = p.frameCount / 24;

              // unified heat-map palette
              const palette = [BlueVelvet, Lavender, SkyBlue, Malachite, YellowCab, Orangina, BloodOrange];

              const cx = stepsX / 2;
              const cy = stepsY / 2;
              const maxDist = Math.hypot(cx, cy);

              for (const cellData of grid) {
                const {
                  cell: [fx, fy],
                } = cellData;

                const x = fx - cx;
                const y = fy - cy;
                const posX = fx * sizeX;
                const posY = fy * sizeY;

                // components for color selection
                const radial = 1 - Math.min(1, Math.hypot(x, y) / maxDist);
                const wave = 0.5 + 0.5 * Math.sin(x * 0.45 - y * 0.35 + time * 2.2);
                const field = p.noise(fx * 0.08 + time * 0.3, fy * 0.08 - time * 0.25);

                // combine with slight bias toward walked cells
                const walkedBias = cellData.walked ? 0.15 : -0.05;
                const t = Math.max(0, Math.min(1, 0.45 * field + 0.35 * wave + 0.2 * radial + walkedBias));

                const c = lerpPalette(p, palette, t);
                const h = p.hue(c);
                const s = p.saturation(c);
                const l = p.lightness(c);

                // adjust luminance subtly for depth
                const lAdj = cellData.walked ? l * 1.08 : l * 0.85;
                const sAdj = cellData.walked ? s * 1.05 : s * 0.9;
                p.fill(h, Math.min(100, sAdj), Math.min(100, lAdj), 1);

                p.rect(posX + padding, posY + padding, sizeX - gutter, sizeY - gutter);
              }
            }}
          />
        </Area>
      </Stack>
    </>
  );
}
