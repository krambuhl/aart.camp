'use client';
import type { P5CanvasInstance } from 'react-p5-wrapper';
import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 512;

// const sides = 41 * 1
// const padding = 32
// const offset = 0

const sides = 29;
const padding = 32;

const gutter = -0.5;
const size = (canvasSize - padding * 2) / sides;

export const meta = {
  title: 'Grid F',
  date: '2022-11-07T00:00:00',
};
let shader: any;
export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p: P5CanvasInstance, store) => {
          p.createCanvas(canvasSize, canvasSize, p.WEBGL);
          p.colorMode(p.HSL);

          shader = p.createShader(vs, fs);

          store.frames = Array(sides ** 2)
            .fill(null)
            .map((_, i) => ({
              x: i % sides,
              y: Math.floor(i / sides),
            }));
        }}
        draw={(p, store) => {
          p.clear(...baseBg);
          p.noStroke();
          p.normalMaterial();

          const start = p.frameCount;
          const length = store.frames.length;

          p.shader(shader);
          shader.setUniform('uFrameCount', start);

          for (let i = 0; i < length; i++) {
            const pos = store.frames[i];
            const time = start / 5;

            // const color = (pos.x + offset) * (pos.y + offset) + time
            // const fill = p.color(rainbow[Math.floor(color % rainbow.length)])

            const x = (pos.x - sides / 2) * size;
            const y = (pos.y - sides / 2) * size;
            const scale = size - gutter;

            p.push();

            shader.setUniform('x', x);
            shader.setUniform('y', y);

            p.translate(x, y, p.sin(x * y + time / 10) * (p.sin(x * 0.2) * p.cos(y * 0.1) * 4));
            p.rotateX(p.sin(x / size / 4) + p.cos(time / 12));
            p.rotateY(p.sin(y / size / 8) + p.cos(time / 16));
            p.rotateZ(x * y + time / 10);
            // p.torus(scale * 0.5, scale * 0.4)
            // p.box(scale * 1.8, scale * 1.8, scale * 1.8, 420, 420)
            p.sphere(scale);

            p.pop();
          }
        }}
      />
    </Area>
  );
}

const vs = `
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;
  attribute vec3 aNormal;

  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform float x;
  uniform float y;

  varying vec2 vTexCoord;
  varying vec3 vNormal;
  void main() {
    vec4 positionVec4 = vec4(aPosition, 2.0);
    float frequency = 2.0;
    float amplitude = 1.;
    float distortion = sin(positionVec4.x * frequency + 1.0 * 0.1);
    // positionVec4.x += distortion * ((1.) / 3.01) * aNormal.x * amplitude;
    vNormal = aNormal;
    gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
    vTexCoord = aTexCoord;
  }
`;

const fs = `
  precision mediump float;
  varying vec2 vTexCoord;
  varying vec3 vNormal;

  void main() {
    vec3 color = vNormal * 0.5 + 0.5;
    gl_FragColor = vec4(color, 1.5);
  }
`;
