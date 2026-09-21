/**
 * Token contract bar.
 *
 * The BRUT token is separate from the protocol contracts, so this bar shows
 * only `tokenAddress` and never the market address.
 *
 * `tokenLaunched` is what reveals it, not the presence of an address. That
 * way the address can be filled in and reviewed ahead of time while the bar
 * still reads "Coming soon", and launch is a one word edit on the deployed
 * site.
 */
import { config } from "./config.js";

const FEEDBACK_MS = 1800;
const COMPACT = matchMedia("(max-width: 767px)");

const short = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

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

  /* The pre-launch token note belongs to the brand as a subheading, not as a
     third fixed navigation row. Keep the same element for launch day so the
     address, copy action and explorer link still switch on from config. */
  const header = document.querySelector(".brut-hero__header");
  const brand = header && header.querySelector(".brut-hero__brand");
  if (header && brand && !header.querySelector(".brut-hero__identity")) {
    const identity = document.createElement("div");
    identity.className = "brut-hero__identity";
    header.insertBefore(identity, brand);
    identity.append(brand, bar);
  }

  const value = bar.querySelector("[data-ca-text]");
  const button = bar.querySelector("[data-ca-copy]");
  const label = bar.querySelector("[data-ca-copy-text]");
  const explorer = bar.querySelector("[data-ca-explorer]");

  const address = config.tokenAddress;
  const live = config.tokenLaunched && Boolean(address);
  let timer = 0;

  if (config.tokenLaunched && !address) {
    console.warn("BRUT: tokenLaunched is true but tokenAddress is empty or malformed.");
  }

  function render() {
    bar.dataset.state = live ? "live" : "soon";

    if (!live) {
      value.textContent = "Coming soon";
      value.removeAttribute("title");
      button.setAttribute("aria-label", "The token address appears here at launch.");
      explorer.hidden = true;
      return;
    }

    value.textContent = COMPACT.matches ? short(address) : address;
    value.title = address;
    button.setAttribute("aria-label", `Copy the token address ${address}`);

    const url = config.explorerUrl ? `${config.explorerUrl}/address/${address}` : "";
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
