/**
 * Landing page wiring.
 *
 * No copy and no layout live here. This file only turns the configured links
 * on: an unconfigured link stays in the page, dimmed and inert, so the footer
 * never shows a dead destination.
 */
import { config, explorerAddress } from "./config.js";

const DESTINATION = {
  contract: () => explorerAddress(config.marketAddress) || explorerAddress(config.tokenAddress),
  x: () => config.links.x,
  docs: () => config.links.docs,
};

for (const link of document.querySelectorAll("[data-brut-link]")) {
  const href = (DESTINATION[link.dataset.brutLink] || (() => ""))();
  if (href) {
    link.href = href;
    link.removeAttribute("aria-disabled");
  } else {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
  }
}
