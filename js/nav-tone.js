/**
 * Header tone.
 *
 * The brand, the section nav and the contract bar are all fixed, so they stay
 * on screen over sections that are black and sections that are paper. Each
 * section already declares which it is with data-nav-tone; the reference build
 * read that and recoloured the header, and the export lost the script that did
 * it, leaving white text over the light sections.
 *
 * Everything up there is drawn in currentColor or a mix of it, so setting one
 * colour carries the pill backings and borders with it. The brand mark is a
 * fixed white glyph rather than currentColor, so it inverts instead.
 *
 * The section under the header is found with an observer watching a one pixel
 * band at the header's own height, not with a scroll listener. Several of
 * these sections are pinned or sticky and settle after the scroll that caused
 * them to move, so a scroll listener leaves the tone one section stale.
 */
const LIGHT = "#070707";
const DARK = "#ffffff";

/* The band sits level with the header, a little below the top edge. */
const probeAt = () => (window.innerHeight > 640 ? 44 : 31);

function start() {
  const chrome = [
    document.querySelector(".brut-hero__header"),
    document.querySelector(".brut-hero__nav"),
    document.querySelector("[data-ca-bar]"),
  ].filter(Boolean);
  const mark = document.querySelector(".brut-hero__brand-mark");
  const zones = [...document.querySelectorAll("[data-nav-tone]")];
  if (!chrome.length || !zones.length) return;

  const crossing = new Set();
  let current = "";
  let observer = null;

  function apply() {
    /* Later in the document wins, so a pinned stage lying over the section
       behind it reports the one actually on top. */
    let tone = "dark";
    for (const zone of zones) if (crossing.has(zone)) tone = zone.dataset.navTone;
    if (tone === current) return;
    current = tone;

    const colour = tone === "light" ? LIGHT : DARK;
    for (const element of chrome) element.style.color = colour;
    if (mark) mark.style.filter = tone === "light" ? "invert(1)" : "";
  }

  function observe() {
    if (observer) observer.disconnect();
    crossing.clear();

    const probe = probeAt();
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target);
          else crossing.delete(entry.target);
        }
        apply();
      },
      { rootMargin: `-${probe}px 0px -${Math.max(0, window.innerHeight - probe - 1)}px 0px` }
    );
    for (const zone of zones) observer.observe(zone);
  }

  observe();

  let resizeTimer = 0;
  addEventListener(
    "resize",
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(observe, 150);
    },
    { passive: true }
  );
}

start();
