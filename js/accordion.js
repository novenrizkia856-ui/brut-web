/**
 * The proof accordion.
 *
 * Four points share one panel. The active point advances on its own, and the
 * rail beside each title fills over that point's dwell so the cycle is visible
 * rather than surprising. Clicking a title or a rail jumps straight to it, and
 * pointer or keyboard focus holds the cycle where it is.
 *
 * Under prefers-reduced-motion nothing advances by itself; the accordion is
 * still fully usable by click and keyboard.
 */
const DWELL = 7000;

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

function setup() {
  const list = document.querySelector(".brut-proof-accordion");
  if (!list) return;

  const items = [...list.querySelectorAll(".brut-proof-accordion__item")];
  const triggers = items.map((item) => item.querySelector(".brut-proof-accordion__trigger"));
  const panels = items.map((item) => item.querySelector(".brut-proof-accordion__panel"));
  const rails = [...document.querySelectorAll(".brut-proof-progress__rail")];
  const fills = rails.map((rail) => rail.querySelector("span"));
  if (!items.length) return;

  let index = items.findIndex((item) => item.classList.contains("is-active"));
  if (index < 0) index = 0;
  let startedAt = performance.now();
  let held = false;
  let raf = 0;

  function show(next, { restart = true } = {}) {
    index = (next + items.length) % items.length;
    items.forEach((item, i) => {
      const on = i === index;
      item.classList.toggle("is-active", on);
      if (triggers[i]) triggers[i].setAttribute("aria-expanded", String(on));
      if (panels[i]) panels[i].setAttribute("aria-hidden", String(!on));
    });
    if (restart) startedAt = performance.now();
  }

  function paint(now) {
    const elapsed = held ? 0 : now - startedAt;
    const ratio = REDUCED ? 0 : Math.min(1, elapsed / DWELL);
    fills.forEach((fill, i) => {
      if (!fill) return;
      fill.style.height = i === index ? `${(ratio * 100).toFixed(1)}%` : "0%";
    });
    if (!REDUCED && !held && elapsed >= DWELL) show(index + 1);
    raf = requestAnimationFrame(paint);
  }

  triggers.forEach((trigger, i) => {
    if (!trigger) return;
    trigger.addEventListener("click", () => show(i));
  });
  rails.forEach((rail, i) => rail.addEventListener("click", () => show(i)));

  const hold = () => { held = true; };
  const release = () => {
    if (!held) return;
    held = false;
    startedAt = performance.now();
  };
  list.addEventListener("pointerenter", hold);
  list.addEventListener("pointerleave", release);
  list.addEventListener("focusin", hold);
  list.addEventListener("focusout", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hold(); else release();
  });

  show(index, { restart: true });
  raf = requestAnimationFrame(paint);
  addEventListener("pagehide", () => cancelAnimationFrame(raf));
}

setup();
