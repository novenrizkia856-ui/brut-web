/**
 * The evidence core's geometry.
 *
 * The browser preview runs as a hidden document, where requestAnimationFrame
 * never fires, so the core cannot be checked on screen. These cover the part
 * that decides what it looks like: that the solids are the right solids, that
 * turning actually moves the points, and that the travelling light walks
 * edges that meet.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  icosahedron,
  octahedron,
  edgesOf,
  project,
  fade,
  nextHop,
  distance,
} from "../js/wireframe.js";

const close = (a, b, slack = 1e-9) => Math.abs(a - b) <= slack;

test("the icosahedron has twelve vertices and thirty edges", () => {
  const points = icosahedron();
  assert.equal(points.length, 12);
  assert.equal(edgesOf(points).length, 30);
});

test("the octahedron has six vertices and twelve edges", () => {
  const points = octahedron();
  assert.equal(points.length, 6);
  assert.equal(edgesOf(points).length, 12);
});

test("every vertex sits on the unit sphere", () => {
  for (const point of [...icosahedron(), ...octahedron()]) {
    assert.ok(close(Math.hypot(...point), 1, 1e-12), `radius was ${Math.hypot(...point)}`);
  }
});

test("every edge of a regular solid is the same length", () => {
  const points = icosahedron();
  const lengths = edgesOf(points).map(([a, b]) => distance(points[a], points[b]));
  for (const value of lengths) assert.ok(close(value, lengths[0], 1e-9));
});

test("turning moves the points", () => {
  const point = icosahedron()[0];
  const still = project(point, 0, 0, 100);
  const turned = project(point, 0.8, 0, 100);
  assert.ok(Math.hypot(still.x - turned.x, still.y - turned.y) > 1);
});

test("a full turn comes back to where it started", () => {
  const point = icosahedron()[3];
  const before = project(point, 0, 0, 100);
  const after = project(point, Math.PI * 2, 0, 100);
  assert.ok(close(before.x, after.x, 1e-9));
  assert.ok(close(before.y, after.y, 1e-9));
});

test("projection keeps the drawing inside the canvas", () => {
  const points = icosahedron();
  for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.2) {
    for (const point of points) {
      const p = project(point, yaw, 0.42, 200);
      assert.ok(p.x >= 0 && p.x <= 200, `x was ${p.x}`);
      assert.ok(p.y >= 0 && p.y <= 200, `y was ${p.y}`);
    }
  }
});

test("the near face projects wider than the far face", () => {
  const near = project([0, 0, 1], 0, 0, 100);
  const far = project([0, 0, -1], 0, 0, 100);
  assert.ok(near.z > far.z);
  /* both sit on the axis, so depth shows up in the ink instead */
  assert.ok(fade(near.z, 0.1, 0.5) > fade(far.z, 0.1, 0.5));
});

test("fade spans exactly the range it is given", () => {
  assert.ok(close(fade(-1, 0.1, 0.5), 0.1));
  assert.ok(close(fade(1, 0.1, 0.5), 0.5));
  assert.ok(close(fade(0, 0, 1), 0.5));
});

test("the light only ever moves to an edge that touches the one it is on", () => {
  const points = icosahedron();
  const edges = edgesOf(points);
  let hop = { edge: 0, forward: true };

  /* a rotating stand in for Math.random, so the walk is deterministic */
  let step = 0;
  const random = () => ((step++ * 7) % 11) / 11;

  for (let i = 0; i < 200; i += 1) {
    const arrivedAt = hop.forward ? edges[hop.edge][1] : edges[hop.edge][0];
    hop = nextHop(edges, hop.edge, hop.forward, random);
    const next = edges[hop.edge];
    assert.ok(next.includes(arrivedAt), `edge ${next} does not touch vertex ${arrivedAt}`);
    assert.equal(hop.forward, next[0] === arrivedAt);
  }
});

test("the light never leaves the solid", () => {
  const edges = edgesOf(icosahedron());
  let hop = { edge: 0, forward: true };
  for (let i = 0; i < 100; i += 1) {
    hop = nextHop(edges, hop.edge, hop.forward, () => 0.999999);
    assert.ok(hop.edge >= 0 && hop.edge < edges.length);
  }
});

/* ------------------------------------------------------------ lighting -- */

import { facesOf, rotate, normalOf, shade, LIGHT } from "../js/wireframe.js";

test("the icosahedron has twenty faces, the octahedron eight", () => {
  const ico = icosahedron();
  const oct = octahedron();
  assert.equal(facesOf(ico, edgesOf(ico)).length, 20);
  assert.equal(facesOf(oct, edgesOf(oct)).length, 8);
});

test("every face is wound so its normal points outward", () => {
  const points = icosahedron();
  for (const [a, b, c] of facesOf(points, edgesOf(points))) {
    const n = normalOf(points[a], points[b], points[c]);
    const centre = [0, 1, 2].map((k) => (points[a][k] + points[b][k] + points[c][k]) / 3);
    assert.ok(n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] > 0);
  }
});

test("winding survives rotation, so facing is right at every angle", () => {
  const points = icosahedron();
  const faces = facesOf(points, edgesOf(points));
  for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.7) {
    const turned = points.map((p) => rotate(p, yaw, 0.4));
    const facing = faces.filter(([a, b, c]) => normalOf(turned[a], turned[b], turned[c])[2] > 0);
    /* a convex solid always shows roughly half its faces */
    assert.ok(facing.length >= 8 && facing.length <= 12, `saw ${facing.length} faces`);
  }
});

test("a face pointed at the light is brighter than one pointed away", () => {
  const toward = shade(LIGHT);
  const edgeOn = shade([1, 0, 0.01]);
  assert.ok(toward.diffuse > edgeOn.diffuse);
  assert.ok(toward.diffuse > 0.99);
});

test("faces turned from the viewer get no light at all", () => {
  const back = shade([0, 0, -1]);
  assert.equal(back.facing, false);
  assert.equal(back.diffuse, 0);
  assert.equal(back.specular, 0);
});

test("the highlight is tight: only faces near the mirror angle catch it", () => {
  assert.ok(shade([0, 0, 1]).specular < 0.5);
  assert.ok(shade([1, 0, 0.05]).specular < 0.01);
});
