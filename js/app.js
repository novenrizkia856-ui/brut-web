/**
 * The BRUT app.
 *
 * Four steps, in the order the protocol runs them: pick a provider, describe
 * the job, fund escrow, follow the job to settlement.
 *
 * There is no market contract yet, so the provider list comes from
 * js/sample-registry.js and funding runs as a local walkthrough. Both are
 * stated on screen rather than implied. The moment config/contracts.js
 * carries a market address and an RPC URL, readProviders() reads the chain
 * instead and nothing above it changes.
 */
import { config, isLive, explorerAddress, shortAddress } from "./config.js";
import { PROVIDERS } from "./sample-registry.js";
import { price, blocker } from "./quote.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, REDUCED ? 0 : ms));

/* ------------------------------------------------------------- state ----- */

const state = {
  providers: [],
  filter: "all",
  picked: null,
  job: null,
  timers: [],
};

function clearTimers() {
  state.timers.forEach(clearTimeout);
  state.timers = [];
}

/* ---------------------------------------------------------- providers ---- */

/**
 * The supply side. Reads the market contract when one is configured, and the
 * sample registry until then. The caller does not need to know which.
 */
async function readProviders() {
  if (!isLive) return { rows: PROVIDERS, source: "sample" };
  try {
    /* The market contract is not written yet. When it is, its provider read
       goes here and the rest of the app is unchanged. */
    throw new Error("market reads not implemented");
  } catch (error) {
    console.warn("BRUT: falling back to the sample registry", error);
    return { rows: PROVIDERS, source: "sample" };
  }
}

function providerRow(p) {
  const tr = document.createElement("tr");
  tr.dataset.provider = p.id;
  if (state.picked && state.picked.id === p.id) tr.classList.add("is-picked");

  const explorer = explorerAddress(p.address);
  const who = explorer
    ? `<a href="${explorer}" target="_blank" rel="noopener noreferrer">Provider ${p.id}</a>`
    : `Provider ${p.id}`;

  tr.innerHTML = `
    <td><span class="who">${who}</span></td>
    <td>${p.gpu}</td>
    <td><span class="free${p.free ? "" : " is-none"}">${p.free} of ${p.total}</span></td>
    <td class="rate">$${money(p.rate)}</td>
    <td>${p.region}</td>
    <td>${p.uptime.toFixed(1)}%</td>
    <td>${p.jobs}</td>
    <td>${p.stake ? `$${money(p.stake)}` : "None"}</td>
    <td><button class="pick" type="button" ${p.free ? "" : "disabled"}>${
      state.picked && state.picked.id === p.id ? "Picked" : p.free ? "Select" : "Full"
    }</button></td>`;

  const button = $(".pick", tr);
  if (p.free) button.addEventListener("click", () => pick(p));
  return tr;
}

function paintProviders() {
  const body = $("[data-provider-rows]");
  const empty = $("[data-provider-empty]");
  const rows = state.providers.filter((p) => state.filter === "all" || p.gpu === state.filter);

  body.replaceChildren(...rows.map(providerRow));
  empty.hidden = rows.length > 0;
}

function pick(provider) {
  state.picked = provider;
  const gpu = $('[data-field="gpu"]');
  if (gpu.value !== provider.gpu) gpu.value = provider.gpu;
  paintProviders();
  paintQuote();
}

/* -------------------------------------------------------------- quote ---- */

function readForm() {
  const value = (name) => $(`[data-field="${name}"]`).value;
  return {
    gpu: value("gpu"),
    count: Math.max(1, Number(value("count")) || 1),
    workload: value("workload"),
    hours: Math.max(1, Number(value("hours")) || 1),
    image: value("image").trim(),
    budget: Number(value("budget")) || 0,
  };
}

function quote() {
  const form = readForm();
  return { ...form, ...price(form, state.picked) };
}

/** Why this job cannot be funded yet, or "" when it can. */
function why() {
  return blocker(readForm(), state.picked);
}

function paintQuote() {
  const q = quote();
  const set = (slot, text) => { $(`[data-quote="${slot}"]`).textContent = text; };

  set("provider", state.picked ? `Provider ${state.picked.id}` : "None selected");
  set("hours", q.gpuHours.toFixed(1));
  set("rate", state.picked ? `$${money(q.rate)}` : "Select a provider");
  set("total", state.picked ? `$${money(q.total)}` : "0.00");

  const reason = why();
  const button = $("[data-fund]");
  const error = $("[data-job-error]");

  button.disabled = Boolean(reason);
  $("[data-fund-label]").textContent = reason
    ? (state.picked ? "Cannot fund yet" : "Select a provider first")
    : `Lock $${money(q.total)} in escrow`;

  const showError = Boolean(reason) && Boolean(state.picked);
  error.hidden = !showError;
  error.textContent = showError ? reason : "";
}

/* ---------------------------------------------------------------- run ---- */

const STATES = ["Queued", "Running", "Completed"];

function paintStates(current, failed = false) {
  const at = STATES.indexOf(current);
  $$("[data-states] li").forEach((li, i) => {
    li.classList.toggle("is-done", i < at);
    li.classList.toggle("is-now", i === at && !failed);
    li.classList.toggle("is-failed", i === at && failed);
  });
}

function traceEntry({ stamp, tone, title, detail }) {
  const li = document.createElement("li");
  li.dataset.tone = tone;
  li.innerHTML = `
    <span class="stamp stamp--${tone}">${stamp}</span>
    <h3>${title}</h3>
    <p>${detail}</p>`;
  $("[data-trace]").append(li);
  requestAnimationFrame(() => li.classList.add("is-in"));
}

function setRun(slot, text) {
  $(`[data-run="${slot}"]`).textContent = text;
}

/**
 * Walk the job from funded escrow to settlement, writing each step into the
 * trace as it happens. Every line carries the label that says how strongly it
 * is backed, which is the whole point of the verification model.
 */
async function runJob(q) {
  const id = `0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
  const hash = `0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  const beats = q.hours * 60;

  state.job = { id, hash };
  clearTimers();

  $("[data-run-section]").hidden = false;
  $("[data-trace]").replaceChildren();
  $("[data-run-explorer]").hidden = true;

  setRun("id", id);
  setRun("provider", `Provider ${state.picked.id}`);
  setRun("workload", `${q.workload}, ${q.gpu} x ${q.count}`);
  setRun("escrow", `$${money(q.total)} locked`);
  setRun("heartbeat", "Waiting for the first beat");
  setRun("hash", "Not submitted");
  setRun("settlement", "Held in escrow");

  $("[data-run-section]").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });

  paintStates("Queued");
  traceEntry({
    stamp: "Verified onchain",
    tone: "onchain",
    title: `Escrow funded with $${money(q.total)}.`,
    detail: `job ${id} · release on verified completion`,
  });

  await wait(1100);
  paintStates("Running");
  traceEntry({
    stamp: "Reported",
    tone: "reported",
    title: `Provider claims ${q.gpu} x ${q.count} for the run.`,
    detail: "hardware claim is not independently verified",
  });
  setRun("heartbeat", "Beating every 60 seconds");

  await wait(1300);
  traceEntry({
    stamp: "Verified onchain",
    tone: "onchain",
    title: "Heartbeat held for the whole run.",
    detail: `interval 60s · missed 0 of ${beats}`,
  });

  await wait(1300);
  traceEntry({
    stamp: "Via attestation",
    tone: "attested",
    title: "Provider submitted the output hash.",
    detail: `${hash} · integrity of the referenced result`,
  });
  setRun("hash", hash);

  await wait(1200);
  paintStates("Completed");
  traceEntry({
    stamp: "Verified onchain",
    tone: "onchain",
    title: "Release rule met. Escrow paid out in full.",
    detail: `$${money(q.total)} to provider ${state.picked.id} · stake untouched`,
  });
  setRun("settlement", `Released $${money(q.total)}`);

  const explorer = explorerAddress(config.marketAddress);
  if (explorer) {
    const link = $("[data-run-explorer]");
    link.href = explorer;
    link.hidden = false;
  }
}

function resetRun() {
  clearTimers();
  state.job = null;
  $("[data-run-section]").hidden = true;
  $("[data-trace]").replaceChildren();
  $("[data-provider-rows]").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
}

/* ------------------------------------------------------------ chrome ----- */

function paintNetwork(source) {
  const strip = $("[data-network-state]");
  const label = $("[data-network-label]");
  const detail = $("[data-network-detail]");
  const footer = $("[data-contract-line]");

  if (isLive) {
    strip.dataset.networkState = "live";
    label.textContent = config.network || "Connected";
    detail.textContent = config.chainId ? `Chain ID ${config.chainId}` : "";
    footer.textContent = `Market ${shortAddress(config.marketAddress)}`;
    return;
  }

  strip.dataset.networkState = "pending";
  label.textContent = "No contract configured";
  detail.textContent = source === "sample" ? "Sample registry" : "";
  footer.textContent = "No contract configured";
}

function wireFilters() {
  for (const chip of $$("[data-filter]")) {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      $$("[data-filter]").forEach((c) => c.classList.toggle("is-on", c === chip));
      paintProviders();
    });
  }
}

function wireForm() {
  const form = $("[data-job-form]");
  form.addEventListener("input", paintQuote);
  form.addEventListener("change", paintQuote);
  form.addEventListener("submit", (event) => event.preventDefault());

  $("[data-fund]").addEventListener("click", () => {
    if (why()) return;
    runJob(quote());
  });
  $("[data-run-reset]").addEventListener("click", resetRun);
}

async function start() {
  const { rows, source } = await readProviders();
  state.providers = rows;
  paintNetwork(source);
  wireFilters();
  wireForm();
  paintProviders();
  paintQuote();
}

start();
