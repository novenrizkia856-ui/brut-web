/**
 * A dithered GPU.
 *
 * The centre of the proof section is a GPU package, modelled as a handful of
 * boxes (substrate, interposer, die, four memory stacks, a row of capacitors),
 * rasterised into a small intensity buffer and then reduced to one bit per
 * pixel with an ordered Bayer dither. Drawn as square dots, it reads in the
 * same language as the rest of the page: the dithered cloud behind the
 * boundaries section, the dot grid on the run cards, the dotted closing.
 *
 * Everything here is pure and covered by test/dither.test.mjs. js/core.js
 * only decides when to draw and where the dots land.
 */
import { rotate, normalOf, shade } from "./geometry.js";

/** @typedef {[number, number, number]} Point */
/** @typedef {{a: Point, b: Point, c: Point, tone: number, gloss?: number, part?: string}} Triangle */

/**
 * An axis aligned box as twelve outward wound triangles.
 *
 * @param {Point} centre
 * @param {Point} size full width, height and depth
 * @param {number} tone base brightness, 0 to 1
 * @returns {Triangle[]}
 */
export function box(centre, size, tone, extra = {}) {
  const [cx, cy, cz] = centre;
  const [hx, hy, hz] = size.map((n) => n / 2);
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];

  /* Each face: four corners counter clockwise seen from outside. */
  const quads = [
    [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)],     /* +z front */
    [v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1)], /* -z back  */
    [v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1)],     /* +x right */
    [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], /* -x left  */
    [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], /* -y top   */
    [v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)],     /* +y base  */
  ];

  const triangles = [];
  for (const [p, q, r, s] of quads) {
    const centreOfFace = [0, 1, 2].map((k) => (p[k] + r[k]) / 2);
    const outward = [0, 1, 2].map((k) => centreOfFace[k] - centre[k]);
    /* Wind each triangle so its normal agrees with the outward direction. */
    for (const [a, b, c] of [[p, q, r], [p, r, s]]) {
      const n = normalOf(a, b, c);
      const agrees = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] > 0;
      triangles.push({ a, b: agrees ? b : c, c: agrees ? c : b, tone, ...extra });
    }
  }
  return triangles;
}

/**
 * The GPU package. One unit is roughly half the substrate. "Up" is negative
 * y, so parts stacked on the substrate have smaller y.
 *
 * @returns {Triangle[]}
 */
export function gpuPackage() {
  const parts = [
    box([0, 0, 0], [2.2, 0.14, 2.2], 0.46, { part: "substrate" }),
    box([0, -0.11, 0], [1.56, 0.08, 1.24], 0.2, { part: "interposer" }),
    box([0, -0.21, 0], [0.84, 0.12, 0.8], 1.0, { part: "die", gloss: 0.55 }),
  ];

  /* four stacks of high bandwidth memory, two either side of the die */
  for (const x of [-0.6, 0.6]) {
    for (const z of [-0.3, 0.3]) {
      parts.push(box([x, -0.225, z], [0.24, 0.15, 0.46], 0.86, { part: "memory", gloss: 0.2 }));
    }
  }

  /* capacitors along the front and back edges of the substrate */
  for (let i = 0; i < 7; i += 1) {
    const x = -0.78 + i * 0.26;
    for (const z of [-0.88, 0.88]) {
      parts.push(box([x, -0.1, z], [0.12, 0.07, 0.07], 0.9, { part: "cap" }));
    }
  }

  return parts.flat();
}

const AMBIENT = 0.14;

/**
 * Model units across the frame. The substrate is 2.2 wide, so its diagonal
 * is about 3.1, and perspective enlarges the near corner as it swings round;
 * this leaves a margin so no angle clips it.
 */
export const SPAN = 4.1;

/**
 * Rasterise triangles into a square intensity buffer with a depth buffer.
 * Faces turned from the viewer are culled; the rest are flat shaded from
 * the shared key light.
 *
 * @param {Triangle[]} triangles
 * @param {{size: number, yaw: number, pitch: number, scale: number, glow?: (part: string) => number}} view
 *   size   buffer edge in pixels
 *   scale  buffer pixels per model unit
 *   glow   optional extra brightness per part, for the die's heartbeat
 *   ids    optional Uint16Array, filled with the face drawn at each pixel
 * @returns {Float32Array} brightness per pixel, 0 where nothing was drawn
 */
export function rasterize(triangles, { size, yaw, pitch, scale, glow, ids }) {
  const light = new Float32Array(size * size);
  const depth = new Float32Array(size * size).fill(-Infinity);
  const half = size / 2;
  const LENS = 4.2;

  const place = (p) => {
    const r = rotate(p, yaw, pitch);
    const k = LENS / (LENS - r[2]);
    return [half + r[0] * scale * k, half + r[1] * scale * k, r[2], r];
  };

  for (let index = 0; index < triangles.length; index += 1) {
    const t = triangles[index];
    /* box() emits each face as two consecutive triangles */
    const face = (index >> 1) + 1;
    const A = place(t.a);
    const B = place(t.b);
    const C = place(t.c);

    const { facing, diffuse, specular } = shade(normalOf(A[3], B[3], C[3]));
    if (!facing) continue;

    const lit = Math.min(1,
      t.tone * (AMBIENT + (1 - AMBIENT) * diffuse) +
      (t.gloss || 0) * specular +
      (glow ? glow(t.part) : 0));

    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(A[1], B[1], C[1])));

    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(area) < 1e-9) continue;

    for (let y = minY; y <= maxY; y += 1) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
        const i = y * size + x;
        if (z <= depth[i]) continue;
        depth[i] = z;
        light[i] = Math.max(lit, 0.0001);
        if (ids) ids[i] = face;
      }
    }
  }
  return light;
}

/** The 4 x 4 Bayer matrix as thresholds strictly between 0 and 1. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

/**
 * Reduce a brightness buffer to on and off dots with an ordered dither. The
 * pattern is fixed to the pixel grid rather than the object, so as the chip
 * turns its tones crawl through the dots the way the page's cloud does.
 *
 * @returns {Uint8Array} 1 where a dot is drawn
 */
export function dither(light, size) {
  const on = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      if (light[i] > BAYER4[(y & 3) * 4 + (x & 3)]) on[i] = 1;
    }
  }
  return on;
}

/**
 * Where one face meets another, or meets empty space: the part outlines.
 * Dither alone turns a model into texture; the outline is what makes the
 * parts read as parts. One pixel wide, taken on the right and lower side of
 * each boundary so a line is never doubled.
 *
 * @param {Uint16Array} ids face per pixel from rasterize, 0 for empty
 * @returns {Uint8Array} 1 on an outline pixel
 */
export function outline(ids, size) {
  const edge = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const own = ids[i];
      const right = x + 1 < size ? ids[i + 1] : 0;
      const down = y + 1 < size ? ids[i + size] : 0;
      const left = x > 0 ? ids[i - 1] : 0;
      const up = y > 0 ? ids[i - size] : 0;
      if (own) {
        if ((right && right !== own) || (down && down !== own) || !left || !up || !right || !down) edge[i] = 1;
      }
    }
  }
  return edge;
}
