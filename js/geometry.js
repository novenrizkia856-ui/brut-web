/**
 * 3D maths shared by the evidence core.
 *
 * Pure: rotation, face normals and lighting. Screen convention throughout is
 * x right, y down, z toward the viewer, so a larger z is nearer and "up" is
 * negative y.
 */

/** @typedef {[number, number, number]} Point */

/**
 * Rotate about Y (yaw) then X (pitch).
 * @param {Point} point
 * @returns {Point}
 */
export function rotate(point, yaw, pitch) {
  const [x0, y0, z0] = point;
  const x1 = x0 * Math.cos(yaw) - z0 * Math.sin(yaw);
  const z1 = x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

/** Unit normal of a triangle, following its winding. */
export function normalOf(a, b, c) {
  return unit(cross(sub(b, a), sub(c, a)));
}

/* Key light from the upper left, in front. */
export const LIGHT = unit([-0.45, -0.65, 0.62]);
const HALF = unit([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

/**
 * Lambert diffuse plus a Blinn specular for a face with normal n. A face
 * turned away from the viewer gets neither.
 *
 * @returns {{facing: boolean, diffuse: number, specular: number}}
 */
export function shade(n, shininess = 26) {
  const facing = n[2] > 0;
  if (!facing) return { facing, diffuse: 0, specular: 0 };
  return {
    facing,
    diffuse: Math.max(0, dot(n, LIGHT)),
    specular: Math.max(0, dot(n, HALF)) ** shininess,
  };
}
