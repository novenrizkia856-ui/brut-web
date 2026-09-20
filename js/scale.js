/**
 * Stage scaling.
 *
 * The layout is drawn at a fixed 1440 x 841 stage and scaled to the viewport.
 * The reference build set these variables from script; the export froze them at
 * one window size, so the page did not respond to a resize until this file put
 * them back.
 *
 *   --brut-ui-scale      grows type and padding past the 1440 design width
 *   --brut-stage-scale   fits the 841 tall stage into the viewport height
 *   --brut-stage-height  that stage's own height, already scaled
 *
 * Every rule reads these through var(..., fallback), so the page still renders
 * correctly if this file never runs.
 */
const DESIGN_WIDTH = 1440;
const DESIGN_STAGE = 841;
const CARD_WIDTH = 887;   /* the job card is drawn at this width */
const CARD_HEIGHT = 479;

/* Design heights per section, read off the reference build. */
const SECTION_HEIGHT = {
  built: 924,
  proof: 841,
  "one-run": 841,
  scoring: 702,
  trace: 642,
  boundaries: 1223,
  closing: 818,
};

/* Which stage height each scaled section uses. */
const STAGE_OF = [
  [".brut-st-scoring", SECTION_HEIGHT.scoring],
  [".brut-st-trace", SECTION_HEIGHT.trace],
];

const round = (n) => Math.round(n * 1e6) / 1e6;

function apply() {
  const home = document.querySelector(".brut-home");
  if (!home) return;

  const ui = Math.max(1, window.innerWidth / DESIGN_WIDTH);
  const stage = Math.min(1, window.innerHeight / DESIGN_STAGE);

  home.style.setProperty("--brut-ui-scale", round(ui));
  home.style.setProperty("--brut-stage-scale", round(ui));
  /* Below 927px the job card keeps its 887px drawing and is scaled to fit,
     so its container has to shrink by the same factor or it leaves a gap. */
  const card = Math.min(1, (window.innerWidth - 40) / CARD_WIDTH);
  home.style.setProperty("--brut-card-scale", round(card));
  home.style.setProperty("--brut-card-height", `${round(CARD_HEIGHT * card)}px`);
  for (const [name, height] of Object.entries(SECTION_HEIGHT)) {
    home.style.setProperty(`--brut-${name}-stage-height`, `${round(height * ui)}px`);
  }

  for (const [selector, height] of STAGE_OF) {
    for (const section of document.querySelectorAll(selector)) {
      section.style.setProperty("--brut-stage-scale", round(stage));
      section.style.setProperty("--brut-stage-height", `${round(height * stage)}px`);
    }
  }
  for (const section of document.querySelectorAll(".brut-bc-boundaries, .brut-bc-protocol-screen, .brut-bc-closing")) {
    section.style.setProperty("--brut-bc-stage-scale", round(stage));
  }
}

apply();
addEventListener("resize", apply, { passive: true });
addEventListener("orientationchange", apply);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);

export { apply };
