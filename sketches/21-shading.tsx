'use client';
// @ts-nocheck
import type p5 from 'p5';
import { Sketch } from '@/components/app/Sketch';
import { Area } from '@/components/shared/Area';
import { tokens } from '@/tokens';
import type { P5Color } from '@/types/p5';

const frag = (a: TemplateStringsArray) => a[0];
const vert = (a: TemplateStringsArray) => a[0];

const baseBg: P5Color = [0 / 255, 0 / 255, 0 / 255, 255];
const canvasSize = 512;

const nodes = 11;
const padding = 48;

const gutter = -0.5;
const offset = padding / 2 - nodes / 2;
const size = (canvasSize - padding * 2) / nodes;

export const meta = {
  title: 'Shading',
  date: '2022-11-08T00:00:00',
};
let shader: any;
export default function Output() {
  return (
    <Area width={tokens.size.x768}>
      <Sketch
        setup={(p: p5, store) => {
          p.createCanvas(canvasSize, canvasSize, p.WEBGL);
          p.colorMode(p.HSL);

          shader = p.createShader(vs, fs);

          store.frames = Array(nodes ** 2)
            .fill(null)
            .map((_, i) => ({
              x: i % nodes,
              y: Math.floor(i / nodes),
            }));
        }}
        draw={(p, store) => {
          p.clear(...baseBg);
          p.noStroke();
          // p.orbitControl()
          p.normalMaterial();

          const start = p.frameCount;
          const length = store.frames.length;

          p.shader(shader);
          shader.setUniform('frame', start);

          for (let i = 0; i < length; i++) {
            const pos = store.frames[i];
            const time = start / 5;

            // const color = (pos.x + offset) * (pos.y + offset) + time
            // const fill = p.color(rainbow[Math.floor(color % rainbow.length)])

            const x = offset + (pos.x - nodes / 2) * size;
            const y = offset + (pos.y - nodes / 2) * size;
            const scale = size - gutter;

            p.push();

            shader.setUniform('x', x);
            shader.setUniform('y', y);

            p.translate(x, y);
            p.rotateX(p.sin((x * size) / 4) + p.cos(time / 12));
            p.rotateY(p.sin((y * size) / 8) + p.cos(time / 16));
            p.rotateZ(p.sin(x * y + time / 10));

            // p.torus(scale * 0.5, scale * 0.4)
            // p.box(scale * 1.8, scale * 1.8, scale * 1.8, 420, 420)
            p.sphere(scale * 0.4);

            p.pop();
          }
        }}
      />
    </Area>
  );
}

const vs = vert`
  attribute vec3 aPosition;
  attribute vec2 aTexCoord;
  attribute vec3 aNormal;

  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  
  uniform float frame;
  uniform float x;
  uniform float y;

  varying vec2 vTexCoord;
  varying vec3 vNormal;

  void main() {
    vec4 positionVec4 = vec4(aPosition, 1.0);
    float frequency = 2.0;
    float amplitude = 1.0;

    vNormal = aNormal;
    gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
    vTexCoord = aTexCoord;
  }
`;

const fs = frag`
  precision mediump float;

  uniform float frame;
  uniform float x;
  uniform float y;

  varying vec2 vTexCoord;
  varying vec3 vNormal;

  void main() {
    vec3 color = vec3(frame, frame, frame);
    gl_FragColor = vec4(vNormal, color);
  }
`;
