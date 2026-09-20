/**
 * Wireframe geometry for the evidence core.
 *
 * Pure: solids, their edges, and the rotation and projection that turn a
 * point into a place on the canvas. Kept apart from js/core.js so the maths
 * can be checked in test/ without a browser, and so the drawing code stays
 * about drawing.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

/** @typedef {[number, number, number]} Point */

const length = (p) => Math.hypot(p[0], p[1], p[2]);

export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Scale a solid so its furthest vertex sits on the unit sphere. */
export function normalise(points) {
  const longest = Math.max(...points.map(length));
  return points.map((p) => p.map((n) => n / longest));
}

/** The twelve vertices of a regular icosahedron. */
export function icosahedron() {
  const points = [];
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      points.push([0, sa * 1, sb * PHI], [sa * 1, sb * PHI, 0], [sb * PHI, 0, sa * 1]);
    }
  }
  return normalise(points);
}

/** The six vertices of a regular octahedron. */
export function octahedron() {
  return normalise([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
}

/**
 * Every pair separated by the solid's shortest distance, which for a regular
 * solid is exactly its edge. `slack` absorbs floating point drift.
 */
export function edgesOf(points, slack = 1.05) {
  let shortest = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      shortest = Math.min(shortest, distance(points[i], points[j]));
    }
  }
  const edges = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distance(points[i], points[j]) <= shortest * slack) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * Rotate about Y then X and project onto the canvas, with enough perspective
 * that the near face reads as nearer.
 *
 * @param {Point} point on the unit sphere
 * @param {number} yaw radians
 * @param {number} pitch radians
 * @param {number} size canvas edge in CSS pixels
 * @returns {{x:number, y:number, z:number}} z stays in [-1, 1] for depth cues
 */
export function project(point, yaw, pitch, size) {
  const [x0, y0, z0] = point;

  const x1 = x0 * Math.cos(yaw) - z0 * Math.sin(yaw);
  const z1 = x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);

  const depth = 2.6 / (2.6 - z2);
  const radius = size * 0.31;
  return { x: size / 2 + x1 * radius * depth, y: size / 2 + y2 * radius * depth, z: z2 };
}

/** Depth to ink, so the far side of a shell recedes rather than vanishing. */
export const fade = (z, near, far) => near + ((z + 1) / 2) * (far - near);

/**
 * Choose the next edge for the travelling light, continuing from whichever
 * vertex it just reached.
 *
 * @param {[number,number][]} edges
 * @param {number} index the edge it is on
 * @param {boolean} forward travelling from edge[0] to edge[1]
 * @param {() => number} random injectable for the tests
 */
export function nextHop(edges, index, forward, random = Math.random) {
  const [from, to] = edges[index];
  const at = forward ? to : from;

  const options = [];
  for (let i = 0; i < edges.length; i += 1) {
    if (edges[i][0] === at || edges[i][1] === at) options.push(i);
  }

  const next = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  return { edge: next, forward: edges[next][0] === at };
}
