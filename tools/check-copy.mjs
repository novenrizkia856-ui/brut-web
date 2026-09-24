// Copy rules check for every string a visitor can read or hear.
//   1. No hyphen, en dash or em dash.
//   2. No sentence longer than 15 words.
// Scans index.html text nodes, SVG text, aria labels, titles, alt text and meta
// descriptions, plus user facing strings in js/ (toasts, dialog content).
// Usage: node tools/check-copy.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_WORDS = 15;
const DASHES = /[-‐‑‒–—―−]/;

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&copy;/g, "©")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const strings = [];
const add = (source, text) => {
  const clean = decode(text).replace(/\s+/g, " ").trim();
  if (clean) strings.push({ source, text: clean });
};

// ---- public HTML shells
for (const file of ["index.html", "app.html"]) {
  let html = readFileSync(join(root, file), "utf8");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  for (const m of html.matchAll(/<(?:meta)[^>]+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content="([^"]*)"/g)) {
    add(`${file} meta`, m[1]);
  }
  for (const m of html.matchAll(/<title>([\s\S]*?)<\/title>/g)) add(`${file} title`, m[1]);
  for (const m of html.matchAll(/\s(?:aria-label|alt|title|placeholder)="([^"]*)"/g)) add(`${file} attribute`, m[1]);

  const body = html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<defs>[\s\S]*?<\/defs>/g, "");

  // Split on block level tags so separate elements do not merge into one sentence.
  const textOnly = body
    .replace(/<(\/?)(p|h[1-6]|li|a|button|span|div|section|header|footer|nav|dt|dd|td|th|text|tspan|main|ul|dialog|article)\b[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ");
  for (const line of textOnly.split("\n")) add(`${file} text`, line);
}

// ---- js user facing strings
const jsDir = join(root, "js");
for (const file of readdirSync(jsDir)) {
  const src = readFileSync(join(jsDir, file), "utf8");
  for (const m of src.matchAll(/toast\("([^"]*)"\)/g)) add(`js/${file} toast`, m[1]);
  for (const m of src.matchAll(/(?:title|question): "([^"]*)"/g)) add(`js/${file} content`, m[1]);
  for (const m of src.matchAll(/\["([^"]*)", "(?:onchain|issuer|reported)"\]/g)) add(`js/${file} check`, m[1]);
  for (const m of src.matchAll(/(?:onchain|issuer|reported): "([^"]*)"/g)) add(`js/${file} label`, m[1]);
  for (const m of src.matchAll(/(?:textContent = |setState\("\w+", )"([^"]*)"/g)) add(`js/${file} ui`, m[1]);
  for (const m of src.matchAll(/setAttribute\("aria-label", "([^"]*)"/g)) add(`js/${file} aria`, m[1]);
}

// The page was adapted from a reference build for a different product. These
// words belong to that product, so any survivor is a conversion miss.
const LEFTOVERS = [
  "ainft", "trading agent", "paper market", "drawdown", "sharpe",
  "candlestick", "leaderboard", "signal seekers", "capital-preservation",
];

// The app moved from an EVM chain to Solana. These belong to the old stack,
// so any survivor in visible copy or the docs source is a migration miss.
const EVM_LEFTOVERS = /\b(robinhood|ethereum|evm|eth|ether|wei|gwei|metamask|etherscan|blockscout|solidity|erc ?20|chain ?id|walletconnect)\b/i;

for (const file of readdirSync(join(root, "content", "docs"))) {
  if (!file.endsWith(".md")) continue;
  for (const line of readFileSync(join(root, "content", "docs", file), "utf8").split("\n")) {
    if (EVM_LEFTOVERS.test(line)) strings.push({ source: `content/docs/${file}`, text: line.trim(), docs: true });
  }
}

// ---- checks
const problems = [];
for (const { source, text, docs } of strings) {
  const evm = EVM_LEFTOVERS.exec(text);
  if (evm) problems.push(`[EVM wording "${evm[1]}"] ${source}: "${text}"`);
  /* The docs keep their own style; only the EVM check applies to them. */
  if (docs) continue;
  if (DASHES.test(text)) problems.push(`[dash] ${source}: "${text}"`);
  const lower = text.toLowerCase();
  for (const term of LEFTOVERS) {
    if (lower.includes(term)) problems.push(`[reference wording "${term}"] ${source}: "${text}"`);
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    if (words.length > MAX_WORDS) {
      problems.push(`[long ${words.length} words] ${source}: "${sentence}"`);
    }
  }
}

console.log(`Checked ${strings.length} visible strings.`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Copy rules pass: no dashes, no long sentences, nothing left of the reference or the EVM stack.");
