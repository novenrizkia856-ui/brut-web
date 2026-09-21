/**
 * The evidence core, and the constellation around it.
 *
 * The centre of the proof section is a lit glass crystal: an icosahedron with
 * shaded facets, specular highlights on the faces turned to the light, and
 * a glowing octahedron seen through it, turning the other way. A light walks
 * its edges one at a time, which is the protocol moving a job.
 *
 * The five evidence nodes around it are not floating on their own any more.
 * They ride one tilted ring around the core, turning with it, passing behind
 * it and in front of it, scaled and dimmed by depth. Each time the light on
 * the core finishes a hop it fires a pulse down a link to the next node, and
 * the node flares when the pulse lands. One clock drives all of it, so it
 * reads as one system rather than six animations.
 *
 * Plain 2D canvas, no library. Geometry and lighting live in
 * js/wireframe.js and are covered by test/. Nothing runs while the section is
 * off screen, and under prefers-reduced-motion the first frame is all there
 * is and the nodes stay where the layout put them.
 */
import {
  icosahedron, octahedron, edgesOf, facesOf, rotate, normalOf, shade, fade, nextHop,
} from "./wireframe.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const TURN = 0.00022;     /* radians per millisecond, the crystal */
const ORBIT = 0.00013;    /* radians per millisecond, the ring of nodes */
const HOP_MS = 1200;      /* the light crossing one edge */
const PULSE_MS = 700;     /* a pulse crossing a link */
const HIT_MS = 650;       /* how long a node flares */
const TILT = 0.42;        /* the ring leans toward the viewer */

const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/**
 * Build a field on a proof visual. Returned rather than started, so the
 * page's own loop drives it and tooling can call frame(now) directly.
 */
export function createField(visual) {
  const canvas = document.createElement("canvas");
  canvas.className = "brut-proof-field";
  canvas.setAttribute("aria-hidden", "true");
  visual.prepend(canvas);
  const context = canvas.getContext("2d");

  const shell = icosahedron();
  const shellEdges = edgesOf(shell);
  const shellFaces = facesOf(shell, shellEdges);
  const inner = octahedron();
  const innerEdges = edgesOf(inner);
  const innerFaces = facesOf(inner, innerEdges);

  const nodes = [...visual.querySelectorAll(".brut-proof-node")];

  let width = 1;
  let height = 1;

  function measure() {
    const box = visual.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  let hop = { edge: 0, forward: true, since: 0 };
  let target = 0;
  const pulses = [];   /* { node, since } */
  const hits = new Map();

  /* ----------------------------------------------------------- crystal -- */

  function drawCrystal(now, cx, cy, radius) {
    const yaw = now * TURN;
    const pitch = 0.35 + Math.sin(now * TURN * 0.5) * 0.3;
    const place = (p, r) => {
      const depth = 3 / (3 - p[2]);
      return { x: cx + p[0] * r * depth, y: cy + p[1] * r * depth, z: p[2] };
    };

    /* halo and a floor shadow, so it sits in the space */
    const halo = context.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 2.1);
    halo.addColorStop(0, "rgba(171,85,255,0.20)");
    halo.addColorStop(0.45, "rgba(120,110,255,0.07)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = halo;
    context.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

    context.save();
    context.translate(cx, cy + radius * 1.5);
    context.scale(1, 0.22);
    const floor = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.1);
    floor.addColorStop(0, "rgba(0,0,0,0.55)");
    floor.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = floor;
    context.beginPath();
    context.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const outer3 = shell.map((p) => rotate(p, yaw, pitch));
    const outer = outer3.map((p) => place(p, radius));

    /* the far side of the glass, seen through the near side */
    context.lineJoin = "round";
    for (const [a, b, c] of shellFaces) {
      const n = normalOf(outer3[a], outer3[b], outer3[c]);
      if (n[2] > 0) continue;
      context.fillStyle = rgba(190, 200, 255, 0.035 + (1 + n[1]) * 0.02);
      context.beginPath();
      context.moveTo(outer[a].x, outer[a].y);
      context.lineTo(outer[b].x, outer[b].y);
      context.lineTo(outer[c].x, outer[c].y);
      context.closePath();
      context.fill();
    }

    /* the core inside, glowing, turning the other way */
    const coreGlow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.7);
    coreGlow.addColorStop(0, "rgba(255,255,255,0.55)");
    coreGlow.addColorStop(0.35, "rgba(200,160,255,0.28)");
    coreGlow.addColorStop(1, "rgba(171,85,255,0)");
    context.fillStyle = coreGlow;
    context.beginPath();
    context.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
    context.fill();

    const inner3 = inner.map((p) => rotate(p, -yaw * 1.6, pitch * 0.6 + 0.4));
    const innerPts = inner3.map((p) => place(p, radius * 0.4));
    const innerOrder = innerFaces
      .map((f) => ({ f, z: (inner3[f[0]][2] + inner3[f[1]][2] + inner3[f[2]][2]) / 3 }))
      .sort((p, q) => p.z - q.z);
    for (const { f: [a, b, c] } of innerOrder) {
      const n = normalOf(inner3[a], inner3[b], inner3[c]);
      const { facing, diffuse, specular } = shade(n, 18);
      if (!facing) continue;
      context.fillStyle = rgba(
        Math.round(200 + 55 * diffuse),
        Math.round(170 + 75 * diffuse),
        255,
        0.45 + diffuse * 0.4 + specular * 0.3
      );
      context.beginPath();
      context.moveTo(innerPts[a].x, innerPts[a].y);
      context.lineTo(innerPts[b].x, innerPts[b].y);
      context.lineTo(innerPts[c].x, innerPts[c].y);
      context.closePath();
      context.fill();
    }

    /* the near side of the glass: lit facets, highlights, a tint where the
       light splits, then the bright edges on top */
    const near = shellFaces
      .map((f) => ({ f, n: normalOf(outer3[f[0]], outer3[f[1]], outer3[f[2]]) }))
      .filter(({ n }) => n[2] > 0)
      .sort((p, q) => p.n[2] - q.n[2]);

    for (const { f: [a, b, c], n } of near) {
      const { diffuse, specular } = shade(n);
      const path = () => {
        context.beginPath();
        context.moveTo(outer[a].x, outer[a].y);
        context.lineTo(outer[b].x, outer[b].y);
        context.lineTo(outer[c].x, outer[c].y);
        context.closePath();
      };

      path();
      context.fillStyle = rgba(235, 240, 255, 0.05 + diffuse * 0.26);
      context.fill();

      /* a thin dispersion tint, green one side, violet the other */
      path();
      context.fillStyle = n[0] > 0
        ? rgba(23, 222, 142, n[0] * 0.10)
        : rgba(171, 85, 255, -n[0] * 0.14);
      context.fill();

      if (specular > 0.02) {
        path();
        context.fillStyle = rgba(255, 255, 255, specular * 0.85);
        context.fill();
      }
    }

    context.lineCap = "round";
    for (const [a, b] of shellEdges) {
      const z = (outer[a].z + outer[b].z) / 2;
      context.strokeStyle = rgba(255, 255, 255, fade(z, 0.08, 0.75));
      context.lineWidth = z > 0 ? 1.3 : 0.8;
      context.beginPath();
      context.moveTo(outer[a].x, outer[a].y);
      context.lineTo(outer[b].x, outer[b].y);
      context.stroke();
    }

    /* the job walking the edges */
    let fired = false;
    if (now - hop.since >= HOP_MS) {
      hop = { ...nextHop(shellEdges, hop.edge, hop.forward), since: now };
      fired = true;
    }
    const [from, to] = shellEdges[hop.edge];
    const s = outer[hop.forward ? from : to];
    const e = outer[hop.forward ? to : from];
    const t = Math.min(1, (now - hop.since) / HOP_MS);
    const x = s.x + (e.x - s.x) * t;
    const y = s.y + (e.y - s.y) * t;

    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(s.x, s.y);
    context.lineTo(x, y);
    context.stroke();

    const spark = context.createRadialGradient(x, y, 0, x, y, 12);
    spark.addColorStop(0, "rgba(255,255,255,1)");
    spark.addColorStop(0.3, "rgba(210,180,255,0.7)");
    spark.addColorStop(1, "rgba(171,85,255,0)");
    context.fillStyle = spark;
    context.beginPath();
    context.arc(x, y, 12, 0, Math.PI * 2);
    context.fill();

    return fired;
  }

  /* ------------------------------------------------------- the ring ---- */

  /** Where node i sits on the ring at time now, in canvas pixels. */
  function nodePlace(i, now, cx, cy) {
    const angle = (i / nodes.length) * Math.PI * 2 + now * ORBIT;
    const ring = [Math.cos(angle), 0, Math.sin(angle)];
    const [x, y, z] = rotate(ring, 0, TILT);
    return {
      x: cx + x * width * 0.4,
      y: cy + y * height * 0.62,
      z,
    };
  }

  function frame(now) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.17;

    context.clearRect(0, 0, width, height);

    const places = nodes.map((_, i) => nodePlace(i, now, cx, cy));

    /* links first, under everything, brighter toward the viewer */
    for (const p of places) {
      const grad = context.createLinearGradient(cx, cy, p.x, p.y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, rgba(255, 255, 255, fade(p.z, 0.06, 0.32)));
      context.strokeStyle = grad;
      context.lineWidth = 1;
      context.setLineDash([3, 5]);
      context.lineDashOffset = -now * 0.02;
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(p.x, p.y);
      context.stroke();
    }
    context.setLineDash([]);

    if (drawCrystal(now, cx, cy, radius) && nodes.length) {
      pulses.push({ node: target, since: now });
      target = (target + 1) % nodes.length;
    }

    /* pulses flying out along the links */
    for (let k = pulses.length - 1; k >= 0; k -= 1) {
      const pulse = pulses[k];
      const t = (now - pulse.since) / PULSE_MS;
      if (t >= 1) {
        hits.set(pulse.node, now);
        pulses.splice(k, 1);
        continue;
      }
      const p = places[pulse.node];
      const x = cx + (p.x - cx) * t;
      const y = cy + (p.y - cy) * t;
      const glow = context.createRadialGradient(x, y, 0, x, y, 9);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(1, "rgba(171,85,255,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, 9, 0, Math.PI * 2);
      context.fill();
    }

    /* the nodes themselves, placed by the same clock */
    nodes.forEach((node, i) => {
      const p = places[i];
      const near = (p.z + 1) / 2;
      node.style.left = `${((p.x / width) * 100).toFixed(3)}%`;
      node.style.top = `${((p.y / height) * 100).toFixed(3)}%`;
      node.style.transform = `translate(-50%,-50%) scale(${(0.72 + near * 0.42).toFixed(3)})`;
      node.style.opacity = (0.45 + near * 0.55).toFixed(3);
      /* behind the crystal when on the far side of the ring */
      node.style.setProperty("--node-z", p.z < 0 ? "0" : "2");
      const hit = hits.get(i);
      node.classList.toggle("is-hit", hit !== undefined && now - hit < HIT_MS);
    });
  }

  measure();
  return { canvas, frame, measure };
}

/* The running field, kept so tooling can step it by hand. */
let active = null;
export const activeField = () => active;

function start() {
  const visual = document.querySelector(".brut-proof-visual");
  if (!visual) return;

  const field = createField(visual);
  active = field;
  visual.classList.add("is-orbiting");
  field.frame(0);
  addEventListener("resize", () => {
    field.measure();
    if (REDUCED) field.frame(0);
  }, { passive: true });

  if (REDUCED) return;

  let raf = 0;
  let running = false;
  const tick = (now) => {
    field.frame(now);
    raf = requestAnimationFrame(tick);
  };

  /* requestAnimationFrame already stops in a hidden tab, so the only thing
     worth gating on is whether the section is on screen at all. */
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting === running) return;
    running = entry.isIntersecting;
    if (running) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  }).observe(visual);
}

start();
