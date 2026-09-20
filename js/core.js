/**
 * The evidence core.
 *
 * Centre of the constellation in the proof section. The reference rendered a
 * crystal here with three.js and the export captured an empty frame, so the
 * slot arrived blank.
 *
 * What sits there now is a turning wireframe: an icosahedron with an
 * octahedron inside it running the other way, and a light that travels one
 * edge at a time. That last part is the reason it is worth watching. The core
 * is not decoration for its own sake, it is the protocol moving a job across
 * the network, one hop at a time.
 *
 * Plain 2D canvas, no library. The geometry lives in js/wireframe.js; this
 * file is only the clock and the ink. It draws nothing while it is off screen,
 * and stays on its first frame under prefers-reduced-motion.
 */
import { icosahedron, octahedron, edgesOf, project, fade, nextHop } from "./wireframe.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const TURN = 0.00016; /* radians per millisecond, the outer shell */
const HOP_MS = 1500;  /* how long the light takes to cross one edge */

const ink = (z, near, far) => `rgba(255,255,255,${fade(z, near, far).toFixed(3)})`;

function start() {
  const canvas = document.querySelector(".brut-proof-crystal-three canvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  /* The export left the captured frame on as a background image. */
  canvas.style.background = "none";

  const shell = icosahedron();
  const shellEdges = edgesOf(shell);
  const inner = octahedron();
  const innerEdges = edgesOf(inner);

  let size = 0;

  function measure() {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    size = Math.max(1, Math.round(box.width || canvas.width));
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  let hop = { edge: 0, forward: true, since: 0 };

  function draw(now) {
    const yaw = now * TURN;
    const pitch = Math.sin(now * TURN * 0.42) * 0.42;

    context.clearRect(0, 0, size, size);
    context.lineCap = "round";

    /* inner solid, turning the other way and a touch faster */
    const innerPoints = inner.map((p) => project(p, -yaw * 1.45, pitch * 0.7, size * 0.52));
    const offset = size * 0.24;
    context.lineWidth = 0.9;
    for (const [a, b] of innerEdges) {
      const p = innerPoints[a];
      const q = innerPoints[b];
      context.strokeStyle = ink((p.z + q.z) / 2, 0.08, 0.3);
      context.beginPath();
      context.moveTo(p.x + offset, p.y + offset);
      context.lineTo(q.x + offset, q.y + offset);
      context.stroke();
    }

    /* outer shell */
    const points = shell.map((p) => project(p, yaw, pitch, size));
    context.lineWidth = 1.1;
    for (const [a, b] of shellEdges) {
      const p = points[a];
      const q = points[b];
      context.strokeStyle = ink((p.z + q.z) / 2, 0.1, 0.5);
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(q.x, q.y);
      context.stroke();
    }

    for (const p of points) {
      context.fillStyle = ink(p.z, 0.2, 0.85);
      context.beginPath();
      context.arc(p.x, p.y, fade(p.z, 0.9, 1.9), 0, Math.PI * 2);
      context.fill();
    }

    /* the job in flight */
    if (now - hop.since >= HOP_MS) {
      hop = { ...nextHop(shellEdges, hop.edge, hop.forward), since: now };
    }
    const [from, to] = shellEdges[hop.edge];
    const a = points[hop.forward ? from : to];
    const b = points[hop.forward ? to : from];
    const t = Math.min(1, (now - hop.since) / HOP_MS);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;

    context.strokeStyle = ink(z, 0.2, 0.75);
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(x, y);
    context.stroke();

    context.fillStyle = ink(z, 0.55, 1);
    context.beginPath();
    context.arc(x, y, fade(z, 1.6, 3), 0, Math.PI * 2);
    context.fill();
  }

  measure();
  draw(0);
  if (REDUCED) return;

  /* ------------------------------------------------- run only when seen --
   * requestAnimationFrame already stops itself in a hidden tab, so the only
   * thing worth gating on here is whether the core is actually on screen.
   */
  let raf = 0;
  let running = false;

  const tick = (now) => {
    draw(now);
    raf = requestAnimationFrame(tick);
  };

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === running) return;
    running = entry.isIntersecting;
    if (running) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  }).observe(canvas);

  addEventListener("resize", measure, { passive: true });
}

start();
