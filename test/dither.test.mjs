/**
 * The dithered GPU at the centre of the proof section.
 *
 * The preview browser often runs hidden, where requestAnimationFrame never
 * fires, so these pin down what the picture is made of: that boxes are
 * closed and wound outward, that the rasteriser keeps the nearest surface and
 * drops faces turned away, that the dither turns a tone into the right share
 * of dots, and that the model reads as a chip from the angle it is shown at.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { box, gpuPackage, rasterize, dither, BAYER4, SPAN } from "../js/dither.js";
import { rotate, normalOf, shade, LIGHT } from "../js/geometry.js";

const at = (buffer, size, x, y) => buffer[y * size + x];

/* ---------------------------------------------------------- geometry ---- */

test("rotation is rigid: it keeps distances from the origin", () => {
  const p = [0.3, -0.8, 0.5];
  const r = rotate(p, 1.1, -0.7);
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...r)) < 1e-12);
});

test("a face pointed at the light is lit fully, one turned away not at all", () => {
  assert.ok(shade(LIGHT).diffuse > 0.99);
  const back = shade([0, 0, -1]);
  assert.equal(back.facing, false);
  assert.equal(back.diffuse, 0);
});

/* --------------------------------------------------------------- box ---- */

test("a box is twelve triangles", () => {
  assert.equal(box([0, 0, 0], [1, 1, 1], 0.5).length, 12);
});

test("every triangle of a box faces outward", () => {
  const centre = [0.4, -0.2, 0.1];
  for (const t of box(centre, [1, 0.3, 2], 0.5)) {
    const n = normalOf(t.a, t.b, t.c);
    const mid = [0, 1, 2].map((k) => (t.a[k] + t.b[k] + t.c[k]) / 3 - centre[k]);
    assert.ok(n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] > 0);
  }
});

test("a box carries its tone and any extra tags onto every triangle", () => {
  for (const t of box([0, 0, 0], [1, 1, 1], 0.7, { part: "die" })) {
    assert.equal(t.tone, 0.7);
    assert.equal(t.part, "die");
  }
});

/* -------------------------------------------------------- rasteriser ---- */

test("a box seen head on fills the middle and leaves the corners empty", () => {
  const size = 40;
  const light = rasterize(box([0, 0, 0], [1, 1, 1], 1), { size, yaw: 0, pitch: 0, scale: 10 });
  assert.ok(at(light, size, 20, 20) > 0);
  assert.equal(at(light, size, 1, 1), 0);
  assert.equal(at(light, size, 38, 38), 0);
});

test("only the face turned to the viewer is drawn, at its lit brightness", () => {
  const size = 40;
  const light = rasterize(box([0, 0, 0], [1, 1, 1], 1), { size, yaw: 0, pitch: 0, scale: 10 });
  /* head on, the one visible face is +z, lit by LIGHT's z component */
  const expected = 0.14 + 0.86 * LIGHT[2];
  assert.ok(Math.abs(at(light, size, 20, 20) - expected) < 1e-6, `got ${at(light, size, 20, 20)}`);
});

test("the nearer of two overlapping boxes wins", () => {
  const size = 40;
  const far = box([0, 0, -1], [1, 1, 0.2], 0.2);
  const near = box([0, 0, 1], [1, 1, 0.2], 1);
  for (const order of [[...far, ...near], [...near, ...far]]) {
    const light = rasterize(order, { size, yaw: 0, pitch: 0, scale: 8 });
    assert.ok(at(light, size, 20, 20) > 0.5, "the far box drew over the near one");
  }
});

test("the die heartbeat only brightens the die", () => {
  const size = 90;
  const view = { size, yaw: 0.3, pitch: -0.74, scale: size / SPAN };
  const calm = rasterize(gpuPackage(), view);
  const flash = rasterize(gpuPackage(), { ...view, glow: (part) => (part === "die" ? 0.5 : 0) });
  let brighter = 0;
  for (let i = 0; i < calm.length; i += 1) if (flash[i] > calm[i] + 1e-9) brighter += 1;
  assert.ok(brighter > 50, "the die did not brighten");
  /* the corners of the substrate are far from the die and must not change */
  let changedOutside = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      if ((x < size * 0.2 || x > size * 0.8) && flash[i] !== calm[i]) changedOutside += 1;
    }
  }
  assert.equal(changedOutside, 0);
});

/* ------------------------------------------------------------ dither ---- */

test("the Bayer thresholds are sixteen distinct steps inside 0 and 1", () => {
  assert.equal(new Set(BAYER4).size, 16);
  for (const t of BAYER4) assert.ok(t > 0 && t < 1);
});

test("dithering keeps the tone: a grey of n sixteenths lights n dots in every tile", () => {
  const size = 16;
  for (let n = 0; n <= 16; n += 1) {
    const light = new Float32Array(size * size).fill(n / 16);
    const on = dither(light, size);
    const lit = on.reduce((sum, v) => sum + v, 0);
    assert.equal(lit, n * (size * size) / 16, `grey ${n}/16 lit ${lit}`);
  }
});

test("nothing drawn means no dots", () => {
  const size = 12;
  assert.equal(dither(new Float32Array(size * size), size).reduce((a, b) => a + b, 0), 0);
});

/* ------------------------------------------------------------- model ---- */

test("the chip is shown from above: its top is lit and fills a good share of the frame", () => {
  const size = 100;
  const light = rasterize(gpuPackage(), { size, yaw: 0.5, pitch: -0.74, scale: size / SPAN });
  let drawn = 0;
  for (const v of light) if (v > 0) drawn += 1;
  const share = drawn / (size * size);
  assert.ok(share > 0.18 && share < 0.7, `chip covers ${(share * 100).toFixed(1)}%`);
  /* the die sits in the middle and is the brightest thing there */
  assert.ok(at(light, size, 50, 48) > 0.55, `centre was ${at(light, size, 50, 48)}`);
});

test("the chip stays inside its frame at every angle it turns through", () => {
  const size = 100;
  for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.4) {
    for (const pitch of [-0.81, -0.74, -0.67]) {
      const light = rasterize(gpuPackage(), { size, yaw, pitch, scale: size / SPAN });
      for (let k = 0; k < size; k += 1) {
        for (const i of [k, (size - 1) * size + k, k * size, k * size + size - 1]) {
          assert.equal(light[i], 0, `touched the edge at yaw ${yaw.toFixed(1)}`);
        }
      }
    }
  }
});
