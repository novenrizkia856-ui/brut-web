/**
 * Scroll motion.
 *
 * The export kept the markup and the CSS but lost the script that drove them,
 * so several blocks were frozen mid animation: the hero camera, the tilted job
 * card, the route line and its dots. This file drives the same custom
 * properties the stylesheet already reads, at the same values the reference
 * build used.
 *
 * Nothing here is required for the page to be readable. Under
 * prefers-reduced-motion every element is placed at its finished state and no
 * scroll listener is attached.
 */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;

/* ---------------------------------------------------------------- hero ---
 * The hero is three screens tall with a sticky stage. Across that scroll the
 * camera pulls back from 2x to 1x while tracking the route, the line draws in,
 * each dot lands as the camera reaches it, and the copy fades near the end.
 */
const ROUTE_POINTS = [
  [16.5, 54], [26, 42], [35.3, 33], [44.9, 21], [54.2, 14], [63.6, 22],
  [73, 30], [82.5, 26], [92, 33], [101.4, 38.5], [110.5, 35],
];
const ROUTE_LENGTH = 123.565; /* matches the dasharray in the markup */
const ART_CENTRE = [61, 49];  /* middle of the 122 x 98 artwork viewBox */

function heroParts() {
  const hero = document.querySelector(".brut-hero");
  if (!hero) return null;
  return {
    hero,
    stage: hero.querySelector(".brut-hero__stage"),
    scale: hero.querySelector(".brut-hero__graph-scale"),
    pan: hero.querySelector(".brut-hero__graph-pan"),
    route: hero.querySelector(".brut-hero__route"),
    dots: [...hero.querySelectorAll("[data-hero-dot]")],
  };
}

/* Position along the route at progress p, linear between the known points. */
function routeAt(p) {
  const span = (ROUTE_POINTS.length - 1) * clamp(p);
  const i = Math.min(ROUTE_POINTS.length - 2, Math.floor(span));
  const t = span - i;
  return [mix(ROUTE_POINTS[i][0], ROUTE_POINTS[i + 1][0], t), mix(ROUTE_POINTS[i][1], ROUTE_POINTS[i + 1][1], t)];
}

function drawHero(parts, p) {
  const { hero, scale, pan, route, dots } = parts;
  /* The camera tracks the scrollbar one to one. An eased camera reads as a
     lag between the wheel and the picture, so only the dots are eased. */
  const eased = clamp(p);
  const zoom = mix(2, 1, eased);
  /* Early on the camera tracks the route. As it pulls back it settles on the
     middle of the chart, so the sequence ends on the whole picture. */
  const [rx, ry] = routeAt(eased);
  const settle = eased * eased;
  const x = mix(rx, ART_CENTRE[0], settle);
  const y = mix(ry, ART_CENTRE[1], settle);

  if (scale) scale.setAttribute("transform", `translate(61 49) scale(${zoom.toFixed(4)})`);
  if (pan) pan.setAttribute("transform", `translate(${(-x).toFixed(3)} ${(-y).toFixed(3)})`);
  if (route) route.style.strokeDashoffset = (ROUTE_LENGTH * (1 - eased)).toFixed(3);

  dots.forEach((dot, i) => {
    const reached = clamp((eased - i / dots.length) * dots.length * 1.6);
    dot.setAttribute("r", (1.5 * easeOut(reached)).toFixed(3));
  });

  hero.style.setProperty("--brut-hero-graph-opacity", mix(0.45, 0.9, eased).toFixed(3));
  /* the copy and the scroll hint clear out over the last quarter */
  hero.style.setProperty("--brut-hero-fade", clamp((p - 0.74) / 0.22).toFixed(3));
  hero.style.setProperty("--brut-hero-progress", clamp(p).toFixed(4));
}

/* ------------------------------------------------------- tilted job card ---
 * The card lies back and lifts into place as its section arrives.
 */
function drawCard(card, q) {
  const eased = easeOut(clamp(q));
  card.style.opacity = mix(0.4, 1, eased).toFixed(3);
  card.style.transform =
    `translateY(${mix(-220, 0, eased).toFixed(2)}px) ` +
    `rotateX(${mix(70, 0, eased).toFixed(3)}deg) ` +
    `scale(${mix(0.6, 1, eased).toFixed(4)})`;

  /* The state pills ship hidden and land once the card is nearly flat. Their
     stagger is already in the stylesheet as a transition delay. */
  const landed = eased > 0.62;
  for (const tag of card.querySelectorAll(".brut-job-card__tag")) {
    tag.style.opacity = landed ? "1" : "0";
    tag.style.transform = landed ? "scale(1)" : "scale(.4)";
  }
}

/* Progress of an element through the viewport, 0 before it arrives, 1 once it
 * has settled in the upper half. */
function progressOf(el, lead = 0.9, tail = 0.35) {
  const r = el.getBoundingClientRect();
  const h = window.innerHeight;
  return clamp((h * lead - r.top) / (h * (lead - tail) + r.height * 0.5));
}

function finish(parts, card) {
  if (parts) drawHero(parts, 1);
  if (card) drawCard(card, 1);
}

/* ----------------------------------------------------------- reveals -----
 * Blocks that ship with an inline start state and wait to be let in.
 */
function reveals() {
  const items = [...document.querySelectorAll(".brut-built__description, .brut-built__heading")];
  for (const el of items) {
    el.style.transition = "opacity 900ms cubic-bezier(.22,.61,.36,1), transform 900ms cubic-bezier(.22,.61,.36,1)";
  }
  if (REDUCED) {
    for (const el of items) {
      el.style.opacity = "1";
      el.style.transform = "none";
    }
    return;
  }
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.opacity = "1";
      entry.target.style.transform = "none";
      seen.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -12% 0px" });
  items.forEach((el, i) => {
    el.style.transitionDelay = `${i * 120}ms`;
    seen.observe(el);
  });
}

/* --------------------------------------------------------------- start ---- */
function start() {
  const parts = heroParts();
  const card = document.querySelector(".brut-built__visual");
  reveals();

  if (REDUCED) {
    finish(parts, card);
    return;
  }

  let queued = false;
  const frame = () => {
    queued = false;
    if (parts) {
      const box = parts.hero.getBoundingClientRect();
      /* the stage is sticky, so the travel is the section minus the stage */
      const stage = parts.stage ? parts.stage.getBoundingClientRect().height : window.innerHeight;
      const range = Math.max(1, box.height - stage);
      drawHero(parts, clamp(-box.top / range));
    }
    if (card) drawCard(card, progressOf(card));
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  frame();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
}

start();
