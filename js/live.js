/**
 * Live panels.
 *
 * Three pieces of the landing page present live state, so they behave like
 * it rather than sitting still:
 *
 *   the job card     heartbeat bars breathing out of phase, the four
 *                    figures counting up to their values once on arrival
 *   the scorecard    a highlight walking the provider rows, and the numbers
 *                    ticking the way a live listing does
 *   the first build  the four scope rows checked off in turn, held, reset
 *
 * The values that tick are illustrative, as the section already says, and
 * never drift far: jobs only ever climb, uptime wanders a tenth either way
 * inside a fixed band, and the score follows from the other two.
 *
 * Everything here starts when its panel scrolls into view and stops when it
 * leaves. Under prefers-reduced-motion nothing moves and every figure shows
 * its real value.
 */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run `begin` while `el` is on screen, and the cleanup it returns when not. */
function whileVisible(el, begin) {
  let end = null;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !end) end = begin() || (() => {});
    else if (!entry.isIntersecting && end) {
      end();
      end = null;
    }
  }, { threshold: 0.2 }).observe(el);
}

/* ----------------------------------------------------------- job card ---- */

function heartbeat() {
  const bars = document.querySelectorAll(".brut-job-card__body-mark");
  bars.forEach((bar, i) => {
    /* Each bar gets its own period and phase, so the trace ripples instead
       of pumping in unison. Negative delays start them mid cycle. */
    bar.style.setProperty("--beat-duration", `${(0.9 + ((i * 37) % 9) / 10).toFixed(2)}s`);
    bar.style.setProperty("--beat-delay", `${(-(i * 0.17)).toFixed(2)}s`);
  });
}

/**
 * Count the card's four figures up from zero once, when the card is first
 * seen. The real value is left in place until the first frame actually runs,
 * so a tab that never paints still shows the right numbers.
 */
function countUp() {
  const values = [...document.querySelectorAll(".brut-job-card__metrics dd")];
  if (!values.length) return;

  const parsed = values.map((dd) => {
    const text = dd.textContent.trim();
    const match = text.match(/^(\D*)([\d.]+)(\D*)$/);
    if (!match) return null;
    const decimals = (match[2].split(".")[1] || "").length;
    return { dd, prefix: match[1], value: Number(match[2]), suffix: match[3], decimals, text };
  });

  const DURATION = 1400;
  let started = false;

  const run = () => {
    if (started) return;
    started = true;
    let t0 = 0;
    const step = (now) => {
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      for (const item of parsed) {
        if (!item) continue;
        item.dd.textContent = t < 1
          ? `${item.prefix}${(item.value * eased).toFixed(item.decimals)}${item.suffix}`
          : item.text;
      }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const card = document.querySelector(".brut-job-card");
  if (!card) return;
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    run();
  }, { threshold: 0.3 }).observe(card);
}

/* ---------------------------------------------------------- scorecard ---- */

function scorecard() {
  const card = document.querySelector(".brut-st-scorecard");
  const rows = [...document.querySelectorAll(".brut-st-scorecard__table tbody tr")];
  if (!card || !rows.length) return;

  /* Read the listing back out of the table, so the markup stays the source. */
  const cells = rows.map((row) => {
    const td = row.querySelectorAll("td");
    return {
      row,
      uptime: td[1],
      jobs: td[2],
      score: td[3],
      base: {
        uptime: Number.parseFloat(td[1].textContent),
        jobs: Number.parseInt(td[2].textContent, 10),
        score: Number.parseFloat(td[3].textContent),
      },
      now: {
        uptime: Number.parseFloat(td[1].textContent),
        jobs: Number.parseInt(td[2].textContent, 10),
      },
    };
  });

  const flash = (td, text) => {
    if (td.textContent === text) return;
    td.textContent = text;
    td.classList.remove("is-tick");
    void td.offsetWidth; /* restart the flash */
    td.classList.add("is-tick");
  };

  whileVisible(card, () => {
    let lit = 0;
    const walk = setInterval(() => {
      rows.forEach((row, i) => row.classList.toggle("is-lit", i === lit));
      lit = (lit + 1) % rows.length;
    }, 1100);

    const tick = setInterval(() => {
      const c = cells[Math.floor(Math.random() * cells.length)];
      c.now.jobs += 1;
      c.now.uptime = Math.min(
        c.base.uptime + 0.3,
        Math.max(c.base.uptime - 0.3, c.now.uptime + (Math.random() < 0.5 ? -0.1 : 0.1))
      );
      /* The score follows uptime and history, so it moves with them. */
      const score = c.base.score + (c.now.uptime - c.base.uptime) * 2 + (c.now.jobs - c.base.jobs) * 0.05;

      flash(c.jobs, String(c.now.jobs));
      flash(c.uptime, `${c.now.uptime.toFixed(1)}%`);
      flash(c.score, score.toFixed(1));
    }, 1500);

    return () => {
      clearInterval(walk);
      clearInterval(tick);
      rows.forEach((row) => row.classList.remove("is-lit"));
    };
  });
}

/* ------------------------------------------------------- first build ----- */

function firstBuild() {
  const panel = document.querySelector(".brut-bc-protocol-panel");
  const rows = [...document.querySelectorAll(".brut-bc-protocol-row")];
  if (!panel || !rows.length) return;

  const STEP = 850;
  const HOLD = 2200;

  whileVisible(panel, () => {
    let timer = 0;
    let i = 0;

    const reset = () => rows.forEach((row) => row.classList.remove("is-checking", "is-checked"));

    const next = () => {
      rows.forEach((row) => row.classList.remove("is-checking"));
      if (i < rows.length) {
        rows[i].classList.add("is-checking", "is-checked");
        i += 1;
        timer = setTimeout(next, STEP);
      } else {
        timer = setTimeout(() => {
          reset();
          i = 0;
          timer = setTimeout(next, STEP);
        }, HOLD);
      }
    };

    timer = setTimeout(next, 700);
    return () => {
      clearTimeout(timer);
      reset();
    };
  });
}

/* --------------------------------------------------------------- start ---- */

heartbeat();
if (!REDUCED) {
  countUp();
  scorecard();
  firstBuild();
}
