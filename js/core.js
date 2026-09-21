/**
 * The evidence core, and the constellation around it.
 *
 * The centre of the proof section is a GPU package, turning slowly, drawn as
 * dithered square dots rather than lit glass. The page already speaks in
 * dither: the cloud behind the boundaries, the dot grid on the run cards, the
 * dotted closing. A glossy glowing object said something else, so the core
 * now says it in the page's own voice, and it shows the thing BRUT actually
 * rents.
 *
 * The five evidence nodes ride one tilted ring around it on the same clock,
 * passing in front and behind. Every beat, the die flashes and sends a single
 * pixel down a link to the next node, which lights when it lands. Nothing
 * glows: links are hairlines, pulses are square pixels on the same grid as
 * the chip.
 *
 * The model, rasteriser and dither live in js/dither.js and are covered by
 * test/. Nothing runs while the section is off screen; under
 * prefers-reduced-motion the first frame is all there is.
 */
import { rotate } from "./geometry.js";
import { gpuPackage, rasterize, dither, outline, SPAN } from "./dither.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const TURN = 0.00024;   /* radians per millisecond, the chip */
const ORBIT = 0.00011;  /* radians per millisecond, the ring of nodes */
const BEAT_MS = 1200;   /* one pulse sent per beat */
const PULSE_MS = 650;   /* a pulse crossing its link */
const HIT_MS = 600;     /* how long a node stays lit */
const FLASH_MS = 420;   /* the die flash as a pulse leaves */
const TILT = 0.42;      /* the ring leans toward the viewer */
const DOT_PX = 2.5;     /* target size of one dither cell, in CSS pixels */

const INK = "#f2f2f2";
const DIM = "#8f94a3";

export function createField(visual) {
  const canvas = document.createElement("canvas");
  canvas.className = "brut-proof-field";
  canvas.setAttribute("aria-hidden", "true");
  visual.prepend(canvas);
  const context = canvas.getContext("2d");

  const model = gpuPackage();
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

  let lastBeat = -Infinity;
  let target = 0;
  const pulses = [];
  const hits = new Map();

  function nodePlace(i, now, cx, cy) {
    const angle = (i / nodes.length) * Math.PI * 2 + now * ORBIT;
    const [x, y, z] = rotate([Math.cos(angle), 0, Math.sin(angle)], 0, TILT);
    return { x: cx + x * width * 0.4, y: cy + y * height * 0.62, z };
  }

  function drawChip(now, cx, cy) {
    const side = Math.min(width, height) * 0.94;
    const size = Math.max(64, Math.min(200, Math.round(side / DOT_PX)));
    const cell = side / size;
    const left = cx - side / 2;
    const top = cy - side / 2;

    const flash = Math.max(0, 1 - (now - lastBeat) / FLASH_MS);
    const ids = new Uint16Array(size * size);
    const light = rasterize(model, {
      size,
      ids,
      yaw: now * TURN,
      pitch: -0.74 + Math.sin(now * TURN * 0.6) * 0.07,
      scale: size / SPAN,
      glow: (part) => (part === "die" ? flash * 0.5 : 0),
    });
    const on = dither(light, size);
    const edge = outline(ids, size);

    /* Three inks: outlines at full strength, bright tones, dim tones. */
    const dot = Math.max(1, cell * 0.78);
    const inkOf = (i) => (edge[i] ? 2 : on[i] ? (light[i] > 0.7 ? 1 : 0) : -1);
    for (const [colour, which] of [[DIM, 0], [INK, 1], [INK, 2]]) {
      context.fillStyle = colour;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (inkOf(y * size + x) !== which) continue;
          context.fillRect(left + x * cell, top + y * cell, dot, dot);
        }
      }
    }
    return cell;
  }

  function frame(now) {
    const cx = width / 2;
    const cy = height / 2;
    context.clearRect(0, 0, width, height);

    const places = nodes.map((_, i) => nodePlace(i, now, cx, cy));

    /* hairline links, fainter for nodes on the far side of the ring */
    context.setLineDash([2, 4]);
    context.lineWidth = 1;
    for (const p of places) {
      context.strokeStyle = `rgba(255,255,255,${(0.1 + ((p.z + 1) / 2) * 0.22).toFixed(3)})`;
      context.beginPath();
      context.moveTo(Math.round(cx) + 0.5, Math.round(cy) + 0.5);
      context.lineTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5);
      context.stroke();
    }
    context.setLineDash([]);

    if (nodes.length && now - lastBeat >= BEAT_MS) {
      lastBeat = now;
      pulses.push({ node: target, since: now });
      target = (target + 1) % nodes.length;
    }

    const cell = drawChip(now, cx, cy);

    /* a pulse is one pixel of the chip's own grid, travelling */
    const grain = Math.max(3, Math.round(cell * 1.4));
    context.fillStyle = INK;
    for (let k = pulses.length - 1; k >= 0; k -= 1) {
      const t = (now - pulses[k].since) / PULSE_MS;
      if (t >= 1) {
        hits.set(pulses[k].node, now);
        pulses.splice(k, 1);
        continue;
      }
      const p = places[pulses[k].node];
      const x = cx + (p.x - cx) * t;
      const y = cy + (p.y - cy) * t;
      context.fillRect(Math.round(x - grain / 2), Math.round(y - grain / 2), grain, grain);
    }

    nodes.forEach((node, i) => {
      const p = places[i];
      const near = (p.z + 1) / 2;
      node.style.left = `${((p.x / width) * 100).toFixed(3)}%`;
      node.style.top = `${((p.y / height) * 100).toFixed(3)}%`;
      node.style.transform = `translate(-50%,-50%) scale(${(0.74 + near * 0.38).toFixed(3)})`;
      node.style.opacity = (0.45 + near * 0.55).toFixed(3);
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
