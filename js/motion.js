/**
 * Scroll motion.
 *
 * The overview is the landing, so the job card is the first thing on screen
 * and it arrives already flat. The reference played this transform the other
 * way, tilting a card up into place as its section arrived. Here it runs in
 * reverse: the card lies back and lifts away as the reader scrolls on, so the
 * section closes itself instead of introducing itself.
 *
 * Nothing here is required for the page to be readable. Under
 * prefers-reduced-motion the card stays flat and no scroll listener is
 * attached.
 */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const mix = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;

/* ------------------------------------------------------------ the card ---
 * q is how present the card is: 1 flat and facing the reader, 0 laid back
 * and gone. The angle and scale are the reference's own values, played from
 * the other end.
 */
function drawCard(card, q) {
  const eased = easeOut(clamp(q));

  card.style.opacity = mix(0, 1, eased).toFixed(3);
  card.style.transform =
    `translateY(${mix(-210, 0, eased).toFixed(2)}px) ` +
    `rotateX(${mix(72, 0, eased).toFixed(3)}deg) ` +
    `scale(${mix(0.62, 1, eased).toFixed(4)})`;

  /* The state pills belong to the card face, so they go with it. */
  const facing = eased > 0.62;
  for (const tag of card.querySelectorAll(".brut-job-card__tag")) {
    tag.style.opacity = facing ? "1" : "0";
    tag.style.transform = facing ? "scale(1)" : "scale(.4)";
  }
}

/**
 * How far the reader has moved past the landing section.
 *
 * The card holds its face for a moment first, so a small scroll does not
 * immediately start closing the thing the reader just arrived at.
 */
function departure(section) {
  const box = section.getBoundingClientRect();
  const hold = window.innerHeight * 0.12;
  const travel = Math.max(1, box.height * 0.7);
  return clamp((-box.top - hold) / travel);
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
  const card = document.querySelector(".brut-built__visual");
  const section = document.querySelector(".brut-built");
  reveals();
  if (!card || !section) return;

  if (REDUCED) {
    drawCard(card, 1);
    return;
  }

  let queued = false;
  const frame = () => {
    queued = false;
    drawCard(card, 1 - departure(section));
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
