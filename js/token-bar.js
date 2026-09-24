/**
 * Token mint line.
 *
 * The BRUT SPL token is separate from the BRUT program, so this line shows
 * only `tokenMint` and never the program id.
 *
 * `tokenLaunched` is what reveals it, not the presence of a mint. That way
 * the mint can be filled in and reviewed ahead of time while the line still
 * reads "Coming soon", and launch is a one word edit on the deployed site.
 */
import { config, explorerAddress, shortAddress } from "./config.js";

const FEEDBACK_MS = 1800;
const COMPACT = matchMedia("(max-width: 767px)");

/**
 * Clipboard API where it works, a selected off screen textarea where it does
 * not: the page is often opened over plain http on a phone, where the async
 * clipboard is unavailable.
 */
async function copy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the older path */
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;opacity:0";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function start() {
  const bar = document.querySelector("[data-ca-bar]");
  if (!bar) return;

  /* Keep token state with the landing message: directly below the main
     heading and above its supporting copy. The same element remains ready to
     expose the address, copy action and explorer link on launch day. */
  const heading = document.querySelector(".brut-built__heading");
  if (heading) heading.insertAdjacentElement("afterend", bar);

  const value = bar.querySelector("[data-ca-text]");
  const button = bar.querySelector("[data-ca-copy]");
  const label = bar.querySelector("[data-ca-copy-text]");
  const explorer = bar.querySelector("[data-ca-explorer]");

  const address = config.tokenMint;
  const live = config.tokenLaunched && Boolean(address);
  let timer = 0;

  if (config.tokenLaunched && !address) {
    console.warn("BRUT: tokenLaunched is true but tokenMint is empty or not a public key.");
  }

  function render() {
    bar.dataset.state = live ? "live" : "soon";

    if (!live) {
      value.textContent = "Coming soon";
      value.removeAttribute("title");
      button.setAttribute("aria-label", "The token mint appears here at launch.");
      explorer.hidden = true;
      return;
    }

    value.textContent = COMPACT.matches ? shortAddress(address) : address;
    value.title = address;
    button.setAttribute("aria-label", `Copy the token mint ${address}`);

    const url = explorerAddress(address);
    explorer.hidden = !url;
    if (url) explorer.href = url;
  }

  function feedback(state, text) {
    button.dataset.copyState = state;
    label.textContent = text;
    clearTimeout(timer);
    if (state !== "idle") timer = setTimeout(() => feedback("idle", "Copy"), FEEDBACK_MS);
  }

  button.addEventListener("click", async () => {
    if (!live) {
      feedback("copied", "At launch");
      return;
    }
    feedback(...((await copy(address)) ? ["copied", "Copied"] : ["idle", "Select it"]));
  });

  render();
  COMPACT.addEventListener("change", render);
}

start();
