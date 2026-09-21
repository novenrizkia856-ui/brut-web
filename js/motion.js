/**
 * Scroll motion.
 *
 * The overview is the landing, so the job card is the first thing on screen
 * and it arrives flat. As the reader scrolls on, the card folds back on its
 * top edge until it is edge on, shrinking and blurring as it goes, and the
 * headline block lifts away above it. The section closes itself.
 *
 * The fold is the point, so the card stays opaque for most of it and only
 * fades in the last stretch. Fading early would hide the very movement the
 * reader is meant to see.
 *
 * Nothing here is required for the page to be readable. Under
 * prefers-reduced-motion everything stays in place and no scroll listener is
 * attached.
 */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* ------------------------------------------------------------ the card ---
 * c is how far the card has closed: 0 flat and facing the reader, 1 folded
 * edge on and gone.
 */
function drawCard(card, c) {
  const t = easeInOut(clamp(c));

  card.style.opacity = (1 - clamp((c - 0.62) / 0.38)).toFixed(3);
  card.style.filter = t > 0.001 ? `blur(${(t * 10).toFixed(2)}px)` : "";
  card.style.transform =
    `translateY(${mix(0, -150, t).toFixed(2)}px) ` +
    `rotateX(${mix(0, 88, t).toFixed(3)}deg) ` +
    `scale(${mix(1, 0.5, t).toFixed(4)})`;

  /* The state pills belong to the card face, so they go with it. */
  const facing = t < 0.35;
  for (const tag of card.querySelectorAll(".brut-job-card__tag")) {
    tag.style.opacity = facing ? "1" : "0";
    tag.style.transform = facing ? "scale(1)" : "scale(.4)";
  }
}

/* The headline and its sub header rise and clear ahead of the card. */
function drawIntro(intro, c) {
  const t = clamp(c / 0.7);
  intro.style.opacity = (1 - t).toFixed(3);
  intro.style.transform = `translateY(${(-90 * easeInOut(t)).toFixed(2)}px)`;
}

/**
 * How far the reader has gone past the landing, 0 to 1.
 *
 * The fold waits until the whole card has been seen flat. On a tall screen
 * that is almost at once; on a short laptop screen the card's figures sit
 * below the fold, so the hold stretches until they have scrolled into view.
 * Then about two thirds of a screen of scrolling closes it.
 *
 * @param {number} cardBottom where the card ends with the page at the top
 */
function departure(cardBottom = 0) {
  const seen = cardBottom - window.innerHeight + 40;
  const hold = Math.max(window.innerHeight * 0.04, seen);
  const travel = window.innerHeight * 0.65;
  return clamp((window.scrollY - hold) / travel);
}

/* ----------------------------------------------------------- reveals -----
 * The headline and sub header ship with an inline start state and are let in
 * once, on load. After that the intro wrapper owns their motion.
 */
function reveals() {
  const items = [...document.querySelectorAll(".brut-built__heading, .brut-built__description")];
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
    el.style.transitionDelay = `${i * 140}ms`;
    seen.observe(el);
  });
}

/* --------------------------------------------------------------- start ---- */
function start() {
  const card = document.querySelector(".brut-built__visual");
  const intro = document.querySelector(".brut-built__intro");
  reveals();
  if (!card) return;

  if (REDUCED) {
    drawCard(card, 0);
    return;
  }

  /* Where the card ends when nothing is folding it, read with the transform
     cleared so a mid page reload does not measure a card already closing. */
  let cardBottom = 0;
  const measure = () => {
    const kept = [card.style.transform, card.style.filter];
    card.style.transform = "";
    card.style.filter = "";
    cardBottom = card.getBoundingClientRect().bottom + window.scrollY;
    [card.style.transform, card.style.filter] = kept;
  };

  let queued = false;
  const frame = () => {
    queued = false;
    const c = departure(cardBottom);
    drawCard(card, c);
    if (intro) drawIntro(intro, c);
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  measure();
  frame();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => {
    measure();
    onScroll();
  }, { passive: true });
}

start();

export { drawCard, departure };
