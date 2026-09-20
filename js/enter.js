/**
 * Section entrances.
 *
 * The export already carries the whole choreography for these sections: the
 * scorecard rows, the trace cards, their dots and connectors, and the first
 * build panel all have keyframes and per element delays in the stylesheet.
 * What it lost is the script that switched them on, so the markup shipped
 * frozen in the finished state and the animations never played.
 *
 * Each section declares its own start state under `.is-motion-ready`, and
 * plays it once the matching class lands:
 *
 *   .brut-st-scoring, .brut-st-trace   ->  is-entered
 *   .brut-bc-protocol-stage            ->  is-active
 *
 * The protocol stage is the reason this matters beyond polish. Its start
 * state is opacity 0, so without the class the whole section was invisible.
 *
 * Entrances play once. Replaying on every pass turns a page into a slideshow
 * the reader has to wait for.
 */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Selector to the class that starts its animation. */
const STAGES = [
  [".brut-st-scoring", "is-entered"],
  [".brut-st-trace", "is-entered"],
  [".brut-bc-protocol-stage", "is-active"],
];

function start() {
  const targets = [];
  for (const [selector, className] of STAGES) {
    for (const el of document.querySelectorAll(selector)) targets.push([el, className]);
  }
  if (!targets.length) return;

  if (REDUCED || !("IntersectionObserver" in window)) {
    for (const [el, className] of targets) el.classList.add(className);
    return;
  }

  const classOf = new Map(targets);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(classOf.get(entry.target));
        observer.unobserve(entry.target);
      }
    },
    /* A little into view, so the run does not start off the bottom edge. */
    { rootMargin: "0px 0px -18% 0px" }
  );

  for (const [el] of targets) observer.observe(el);
}

start();
