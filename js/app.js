/**
 * The BRUT app.
 *
 * Four panels over the BRUT market on Solana:
 *   Rent     hire a listed provider, or post a job for bids, funding escrow
 *   Provide  register a listing, manage stake and availability, bid on jobs
 *   Jobs     every job with its evidence, and the actions open to you now
 *   Operate  verdicts, disputes, attestations and pause, for role holders
 *
 * Solana wallets connect for real, and the wallet's SOL and token balances
 * are read from the RPC. Execution is not live: no BRUT program is deployed,
 * so there are no listings or jobs to read, and every action runs its checks
 * and shows what it would do without asking the wallet to sign anything.
 */
import { config, explorerAddress, shortAddress } from "./config.js";
import {
  EXECUTION_LIVE,
  NO_KEY,
  ZERO_HASH,
  readSlot,
  readAccount,
  wallets,
  walletApps,
  sol,
  parseSol,
  formatUnits,
  isPublicKey,
  labelHash,
  gpuName,
  regionName,
  toDigest,
} from "./chain.js";
import { cost, hireProblem, postProblem, tranches } from "./quote.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const POLL_MS = 20000;
const FEEDBACK_MS = 1800;

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/* Base58 keys are case sensitive, so two keys match only exactly. */
const same = (a, b) => Boolean(a && b) && a === b;
const SOL = "SOL";

/**
 * The market as the chain holds it today. No BRUT program is deployed, so
 * nothing is listed, no job exists and no parameter is set yet. Values the
 * program will decide read as null and show as "At launch".
 */
const MARKET_NOT_LIVE = Object.freeze({
  live: false,
  providerCount: 0,
  jobCount: 0,
  paused: false,
  jobCollateral: null,
  disputeBond: null,
  minStake: null,
  maxBiddingPeriod: 0,
});
const AT_LAUNCH = "At launch";
const NO_ROLES = Object.freeze({ verifier: false, arbitrator: false, pauser: false, admin: false, attestor: false });

/** A lamport amount with its unit, or "At launch" when the program sets it. */
const solOr = (lamports) => (lamports === null || lamports === undefined ? AT_LAUNCH : `${sol(lamports)} ${SOL}`);

/* ------------------------------------------------------------- state ----- */

const state = {
  protocol: null,
  providers: [],
  jobs: [],
  now: Math.floor(Date.now() / 1000),
  slot: 0,
  account: "",
  wallet: null,
  balance: null,
  token: null,
  roles: NO_ROLES,
  me: null,
  claimable: 0n,
  tab: "rent",
  mode: "direct",
  gpuFilter: "all",
  jobsFilter: "mine",
  picked: null,
  detailId: 0,
  detail: null,
  listingKey: "",
};

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`brut:${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`brut:${key}`, JSON.stringify(value));
    } catch {
      /* private mode: nothing to remember, nothing breaks */
    }
  },
};

/* -------------------------------------------------------------- time ----- */

function span(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return `${m}m`;
  return `${s}s`;
}

function when(ts) {
  if (!ts) return "";
  const delta = ts - state.now;
  return delta >= 0 ? `in ${span(delta)}` : `${span(-delta)} ago`;
}

function stamp(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------------ links ------ */

function addressLink(address, label) {
  if (!address || address === NO_KEY) return "None";
  const text = esc(label || shortAddress(address));
  const url = explorerAddress(address);
  const mine = same(address, state.account) ? ' <span class="you">you</span>' : "";
  return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>${mine}` : `${text}${mine}`;
}

const shortHash = (hash) => (hash && hash !== ZERO_HASH ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "None");

/* ------------------------------------------------------------ actions ---- */

function note(slot, html, tone = "") {
  const el = $(`[data-tx="${slot}"]`);
  if (!el) return;
  el.hidden = !html;
  el.dataset.tone = tone;
  el.innerHTML = html;
}

const NOT_LIVE = "Solana execution is not live yet, so nothing was signed or sent.";

/**
 * Where a transaction used to be sent. Every check before this point still
 * runs, and the control that started it shows what it would do. With
 * EXECUTION_LIVE false there is nothing to send to: no wallet signature is
 * requested and no transaction is built or broadcast. Always resolves null,
 * so no caller moves on as if something had happened onchain.
 */
async function send(slot, preview) {
  if (!state.account) {
    await connect();
    if (!state.account) return null;
  }
  if (!EXECUTION_LIVE) note(slot, `${esc(preview)}. ${NOT_LIVE}`, "wait");
  return null;
}

/* ------------------------------------------------------------ wallet ----- */

function paintWallet() {
  const label = $("[data-wallet-label]");
  label.textContent = state.account ? shortAddress(state.account) : "Connect wallet";
  $("[data-wallet-connect]").classList.toggle("btn--quiet", Boolean(state.account));
}

function closeMenu() {
  $("[data-wallet-menu]").hidden = true;
}

function option(html, onClick, quiet = false) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `wallet__option${quiet ? " wallet__option--quiet" : ""}`;
  button.innerHTML = html;
  button.addEventListener("click", onClick);
  li.append(button);
  return li;
}

function linkOption(label, href) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "wallet__option";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  li.append(a);
  return li;
}

function paintBalance() {
  const el = $("[data-wallet-balance]");
  if (!state.account || state.balance === null) {
    el.hidden = true;
    return;
  }
  const parts = [`${sol(state.balance, 4)} ${SOL}`];
  if (state.token) parts.push(`${formatUnits(state.token.amount, state.token.decimals, 4)} ${config.tokenSymbol}`);
  el.textContent = `Balance ${parts.join(", ")}`;
  el.hidden = false;
}

function openMenu() {
  const ul = $("[data-wallet-list]");
  const address = $("[data-wallet-address]");
  $("[data-wallet-title]").textContent = state.account ? "Connected wallet" : "Choose a wallet";
  address.hidden = !state.account;
  address.textContent = state.account;
  paintBalance();

  if (state.account) {
    const copy = option("Copy address", async (event) => {
      const button = event.currentTarget;
      button.textContent = (await copyText(state.account)) ? "Copied" : "Select it above";
      setTimeout(() => (button.textContent = "Copy address"), FEEDBACK_MS);
    });
    const url = explorerAddress(state.account);
    const leave = option(
      "Disconnect",
      () => {
        closeMenu();
        disconnect();
      },
      true,
    );
    ul.replaceChildren(copy, ...(url ? [linkOption("View on Solana Explorer", url)] : []), leave);
    $("[data-wallet-none]").hidden = true;
  } else {
    const list = wallets();
    ul.replaceChildren(
      ...list.map((w) =>
        option(`${w.icon ? `<img src="${esc(w.icon)}" width="22" height="22" alt="">` : ""}<span>${esc(w.name)}</span>`, () => {
          closeMenu();
          useWallet(w, true);
        }),
      ),
      ...(list.length ? [] : walletApps().map((app) => linkOption(app.name, app.href))),
    );
    $("[data-wallet-none]").hidden = list.length > 0;
  }
  $("[data-wallet-menu]").hidden = false;
}

async function connect() {
  const list = wallets();
  if (list.length === 1 && !state.account) return useWallet(list[0], true);
  openMenu();
}

/**
 * Clipboard API where it works, a selected off screen textarea where it does
 * not, as on a phone opening the page over plain http.
 */
async function copyText(text) {
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

let unwatch = () => {};

/** Connect a wallet. With `prompt` false it only restores a trusted one. */
async function useWallet(w, prompt) {
  try {
    const account = await w.connect(!prompt);
    if (!isPublicKey(account)) return;
    unwatch();
    state.wallet = w;
    state.account = account;
    store.set("wallet", w.id);
    unwatch = w.onChange((next) => {
      if (state.wallet !== w || next === state.account) return;
      state.account = isPublicKey(next) ? next : "";
      if (!state.account) state.wallet = null;
      afterAccountChange();
    });
    afterAccountChange();
  } catch (error) {
    if (prompt) console.warn("BRUT: wallet connect failed", error);
  }
}

function disconnect() {
  const w = state.wallet;
  unwatch();
  unwatch = () => {};
  state.wallet = null;
  state.account = "";
  store.set("wallet", "");
  afterAccountChange();
  if (w) w.disconnect().catch(() => {});
}

function afterAccountChange() {
  state.me = null;
  state.balance = null;
  state.token = null;
  state.listingKey = "";
  state.jobsFilter = state.account ? "mine" : "all";
  $$("[data-jobs-filter]").forEach((c) => c.classList.toggle("is-on", c.dataset.jobsFilter === state.jobsFilter));
  paintWallet();
  settle();
  paintAll();
  refresh();
}

/* ----------------------------------------------------------- refresh ----- */

let refreshing = null;
let again = false;

/** A connected wallet before any listing exists: not registered. */
function unregistered(address) {
  return { address, registered: false, available: false, eligible: false, attested: false };
}

/**
 * The market side of the state. It needs no network: with no BRUT program
 * there is nothing listed, and a connected wallet is simply not registered.
 */
function settle() {
  state.protocol = MARKET_NOT_LIVE;
  state.now = Math.floor(Date.now() / 1000);
  state.providers = [];
  state.jobs = [];
  state.picked = null;
  state.roles = NO_ROLES;
  state.claimable = 0n;
  state.me = state.account ? unregistered(state.account) : null;
}

/**
 * Read everything again. A call that arrives mid read, after an account
 * change, queues one more pass so it never gets stale results.
 *
 * With no BRUT program deployed the only reads are the slot and, for a
 * connected wallet, its SOL and token balances: two or three light calls.
 */
function refresh() {
  if (refreshing) {
    again = true;
    return refreshing.then(() => (again ? refresh() : undefined));
  }
  again = false;
  refreshing = (async () => {
    settle();
    paintAll();
    try {
      const account = state.account;
      const [slot, holdings] = await Promise.all([readSlot(), account ? readAccount(account) : null]);
      state.slot = slot;
      if (holdings && account === state.account) {
        state.balance = holdings.balance;
        state.token = holdings.token;
      }
      paintNetwork("live");
    } catch (error) {
      console.warn("BRUT: read failed", error);
      paintNetwork("error");
    } finally {
      paintBalance();
      refreshing = null;
    }
  })();
  return refreshing;
}

function paintAll() {
  paintVitals();
  paintProviders();
  paintQuote();
  paintProvide();
  paintBoard();
  paintJobs();
  paintDetail();
  paintOperate();
}

/* ----------------------------------------------------------- chrome ------ */

function paintNetwork(mode) {
  const strip = $("[data-network-state]");
  const label = $("[data-network-label]");
  const detail = $("[data-network-detail]");
  if (!config.rpcUrl) {
    strip.dataset.networkState = "error";
    label.textContent = "Solana RPC not configured";
    detail.textContent = "";
    return;
  }
  strip.dataset.networkState = mode;
  label.textContent = mode === "error" ? "Solana not answering" : "Solana";
  detail.textContent = state.slot ? `${config.networkName} · slot ${state.slot.toLocaleString("en-US")}` : config.networkName;
}

function paintVitals() {
  const p = state.protocol;
  if (!p) return;
  $("[data-vitals]").hidden = false;
  $('[data-vital="providers"]').textContent = String(p.providerCount);
  $('[data-vital="jobs"]').textContent = String(p.jobCount);
  $('[data-vital="collateral"]').textContent = solOr(p.jobCollateral);
  $('[data-vital="bond"]').textContent = solOr(p.disputeBond);
  $("[data-paused]").hidden = !p.paused;
  $("[data-not-live]").hidden = EXECUTION_LIVE;

  const claim = $("[data-claim]");
  claim.hidden = !(state.claimable > 0n);
  $("[data-claim-amount]").textContent = `${sol(state.claimable)} ${SOL}`;

  const opTab = $('[data-tab="operate"]');
  const anyRole = Object.values(state.roles).some(Boolean);
  opTab.hidden = !anyRole;
  if (!anyRole && state.tab === "operate") showTab("rent");
}

function showTab(name) {
  state.tab = name;
  $$("[data-tab]").forEach((tab) => {
    const on = tab.dataset.tab === name;
    tab.classList.toggle("is-on", on);
    tab.setAttribute("aria-selected", String(on));
  });
  $$("[data-panel]").forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
  if (location.hash !== `#${name}` && !(name === "jobs" && state.detailId)) history.replaceState(null, "", `#${name}`);
}

function fillSelect(select, labels, { any = false, format = (x) => x } = {}) {
  const current = select.value;
  select.replaceChildren();
  if (any) select.append(new Option("Any region", ""));
  for (const label of labels) select.append(new Option(format(label), label));
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

/* --------------------------------------------------------------- rent ---- */

function paintFilters() {
  const holder = $("[data-gpu-filters]");
  const gpus = [...new Set(state.providers.map((p) => p.gpu))].sort();
  if (state.gpuFilter !== "all" && !gpus.includes(state.gpuFilter)) state.gpuFilter = "all";
  holder.replaceChildren(
    ...["all", ...gpus].map((gpu) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip${state.gpuFilter === gpu ? " is-on" : ""}`;
      chip.textContent = gpu === "all" ? "All" : gpu;
      chip.addEventListener("click", () => {
        state.gpuFilter = gpu;
        paintProviders();
      });
      return chip;
    }),
  );
}

function providerRow(p) {
  const tr = document.createElement("tr");
  const picked = state.picked && same(state.picked.address, p.address);
  if (picked) tr.classList.add("is-picked");
  const hardware = p.attested
    ? '<span class="stamp stamp--attested">Attested</span>'
    : '<span class="stamp stamp--reported">Reported</span>';
  const status = p.eligible ? "" : ` <span class="muted">${p.available ? "Low stake" : "Offline"}</span>`;
  tr.innerHTML = `
    <td><span class="who">${addressLink(p.address)}</span></td>
    <td>${esc(p.gpu)}</td>
    <td><span class="free${p.eligible ? "" : " is-none"}">${p.gpuCount}</span>${status}</td>
    <td class="rate">${sol(p.pricePerGpuHour)} ${SOL}</td>
    <td>${esc(p.region)}</td>
    <td>${hardware}</td>
    <td>${p.completedJobs}${p.failedJobs ? ` <span class="muted">${p.failedJobs} failed</span>` : ""}</td>
    <td>${sol(p.stake, 4)} ${SOL}</td>
    <td><button class="pick" type="button" ${p.eligible ? "" : "disabled"}>${picked ? "Picked" : p.eligible ? "Select" : "Unavailable"}</button></td>`;
  if (p.eligible) $(".pick", tr).addEventListener("click", () => pick(p));
  return tr;
}

function paintProviders() {
  paintFilters();
  const rows = state.providers
    .filter((p) => state.gpuFilter === "all" || p.gpu === state.gpuFilter)
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (a.pricePerGpuHour < b.pricePerGpuHour ? -1 : 1));
  $("[data-provider-rows]").replaceChildren(...rows.map(providerRow));
  const empty = $("[data-provider-empty]");
  empty.hidden = rows.length > 0;
  empty.textContent = state.providers.length
    ? "No provider matches that GPU."
    : "No provider is listed yet. List your GPUs on the Provide tab.";
}

function pick(provider) {
  state.picked = provider;
  if (state.mode !== "direct") setMode("direct");
  syncGpuToPick();
  paintProviders();
  paintQuote();
}

function syncGpuToPick() {
  const select = $('[data-field="gpu"]');
  if (state.mode !== "direct") {
    select.disabled = false;
    return;
  }
  select.disabled = true;
  if (!state.picked) return;
  const label = config.gpus.find((g) => labelHash(g) === state.picked.gpuId);
  if (label) select.value = label;
}

function setMode(mode) {
  state.mode = mode;
  $$("[data-mode]").forEach((chip) => chip.classList.toggle("is-on", chip.dataset.mode === mode));
  $$("[data-bids-only]").forEach((el) => (el.hidden = mode !== "bids"));
  syncGpuToPick();
  paintQuote();
}

function readForm() {
  const v = (name) => $(`[data-field="${name}"]`).value;
  return {
    gpu: v("gpu"),
    gpuCount: Math.floor(Number(v("count")) || 0),
    durationHours: Math.floor(Number(v("hours")) || 0),
    milestones: Math.floor(Number(v("milestones")) || 0),
    workload: v("workload").trim(),
    requireAttestation: $('[data-field="attest"]').checked,
    maxPrice: parseSol(v("max")) || 0n,
    region: v("region"),
    biddingHours: Math.floor(Number(v("bidding")) || 0),
  };
}

function problem(form) {
  if (!state.protocol) return "Reading Solana.";
  if (state.protocol.paused) return "New jobs are paused right now.";
  if (state.mode === "direct") return hireProblem(form, state.picked, state.account);
  return postProblem(form, state.protocol.maxBiddingPeriod);
}

function paintQuote() {
  const form = readForm();
  const set = (slot, html) => ($(`[data-quote="${slot}"]`).innerHTML = html);
  const hours = Math.max(0, form.gpuCount) * Math.max(0, form.durationHours);
  set("hours", String(hours));
  set("collateral", state.protocol ? solOr(state.protocol.jobCollateral) : "0");

  let total = 0n;
  if (state.mode === "direct") {
    set("provider", state.picked ? addressLink(state.picked.address) : "None selected");
    set("rate", state.picked ? `${sol(state.picked.pricePerGpuHour)} ${SOL}` : "Select a provider");
    set("total-label", "Locked on funding");
    total = state.picked ? cost(state.picked.pricePerGpuHour, form.gpuCount, form.durationHours) : 0n;
  } else {
    set("provider", "Chosen from bids");
    set("rate", form.maxPrice ? `Up to ${sol(form.maxPrice)} ${SOL}` : "Set a maximum");
    set("total-label", "Budget locked now");
    total = cost(form.maxPrice, form.gpuCount, form.durationHours);
  }
  set("total", `${sol(total)} ${SOL}`);

  const reason = problem(form);
  const button = $("[data-fund]");
  button.disabled = Boolean(reason);
  const label = $("[data-fund-label]");
  if (reason) label.textContent = state.mode === "direct" && !state.picked ? "Select a provider first" : "Cannot fund yet";
  else label.textContent = state.mode === "direct" ? `Lock ${sol(total)} ${SOL} in escrow` : `Post job with ${sol(total)} ${SOL}`;

  $("[data-escrow-rule]").textContent =
    state.mode === "direct"
      ? "Escrow pays out after a verified result and the dispute window."
      : "Unused budget returns the moment you accept a bid.";

  const error = $("[data-job-error]");
  const show = Boolean(reason) && (state.mode === "bids" || Boolean(state.picked));
  error.hidden = !show;
  error.textContent = show ? reason : "";
}

async function fund() {
  const form = readForm();
  if (problem(form)) return;
  if (state.mode === "direct") {
    const p = state.picked;
    const value = cost(p.pricePerGpuHour, form.gpuCount, form.durationHours);
    await send("fund", `Preview: lock ${sol(value)} ${SOL} in escrow for ${shortAddress(p.address)}`);
  } else {
    const value = cost(form.maxPrice, form.gpuCount, form.durationHours);
    await send("fund", `Preview: post a job for ${form.gpuCount} × ${gpuName(form.gpu)} with a ${sol(value)} ${SOL} budget`);
  }
}

/* ------------------------------------------------------------ provide ---- */

function listingForm(prefix) {
  const v = (name) => $(`[data-${prefix}="${name}"]`).value;
  return {
    gpu: v("gpu"),
    count: Math.floor(Number(v("count")) || 0),
    price: parseSol(v("price")),
    region: v("region"),
    meta: v("meta").trim(),
  };
}

function listingProblem(f) {
  if (!f.gpu) return "Choose a GPU model.";
  if (f.count < 1) return "List at least one GPU.";
  if (!f.price || f.price <= 0n) return "Set a price per GPU hour.";
  return "";
}

function paintProvide() {
  const gate = $("[data-provide-gate]");
  const reg = $("[data-provide-register]");
  const dash = $("[data-provide-dashboard]");
  gate.hidden = Boolean(state.account);
  reg.hidden = !state.account || !state.me || state.me.registered;
  dash.hidden = !state.account || !state.me || !state.me.registered;
  const p = state.protocol;

  if (!reg.hidden && p) {
    const hint = $("[data-reg-stake-hint]");
    const stake = $('[data-reg="stake"]');
    if (p.minStake === null || p.jobCollateral === null) {
      hint.textContent = "The minimum stake is set when Solana execution goes live.";
    } else {
      hint.textContent = `At least ${sol(p.minStake)} ${SOL} to take jobs, plus ${sol(p.jobCollateral)} ${SOL} per job at once.`;
      if (!stake.value) stake.value = sol(p.minStake + p.jobCollateral, 9).replace(/,/g, "");
    }
    paintRegister();
  }

  if (!dash.hidden) paintDashboard();
}

function paintRegister() {
  const f = listingForm("reg");
  const stake = parseSol($('[data-reg="stake"]').value);
  let reason = listingProblem(f);
  if (!reason && stake === null && $('[data-reg="stake"]').value.trim()) reason = "Enter the stake as a number.";
  const err = $("[data-reg-error]");
  err.hidden = !reason;
  err.textContent = reason;
  $("[data-register]").disabled = Boolean(reason);
  const label = $("[data-register-label]");
  label.textContent = stake ? `Register with ${sol(stake)} ${SOL} stake` : "Register listing";
}

async function register() {
  const f = listingForm("reg");
  if (listingProblem(f)) return;
  const stake = parseSol($('[data-reg="stake"]').value) || 0n;
  await send("register", `Preview: list ${f.count} × ${gpuName(f.gpu)} with ${sol(stake)} ${SOL} stake`);
}

function whyIneligible(me, p) {
  if (!me.available) return "You are offline. Go online to take jobs and bid.";
  if (p.minStake === null || p.jobCollateral === null) return "";
  if (me.stake < p.minStake) return `Stake below the ${sol(p.minStake)} ${SOL} minimum. Add stake to take jobs.`;
  if (me.freeStake < p.jobCollateral) return `Free stake below one job's ${sol(p.jobCollateral)} ${SOL} collateral.`;
  return "";
}

function paintDashboard() {
  const me = state.me;
  const p = state.protocol;
  const set = (slot, html) => ($(`[data-me="${slot}"]`).innerHTML = html);
  set("title", `${esc(me.gpu)} × ${me.gpuCount}, ${sol(me.pricePerGpuHour)} ${SOL} per GPU hour`);
  set("status", me.eligible ? "Taking jobs" : me.available ? "Online, not eligible" : "Offline");
  set("hardware", me.attested ? '<span class="stamp stamp--attested">Attested</span>' : '<span class="stamp stamp--reported">Reported</span>');
  set("stake", `${sol(me.stake)} ${SOL}`);
  set("free", `${sol(me.freeStake)} ${SOL}`);
  set("locked", `${sol(me.lockedStake)} ${SOL}`);
  set("done", String(me.completedJobs));
  set("failed", String(me.failedJobs));
  set("slashed", me.slashCount ? `${sol(me.slashedTotal)} ${SOL}` : "Never");
  set("why", esc(p ? whyIneligible(me, p) : ""));
  $("[data-availability]").textContent = me.available ? "Go offline" : "Go online";

  const key = `${me.gpuId}:${me.gpuCount}:${me.pricePerGpuHour}:${me.regionId}`;
  if (key !== state.listingKey) {
    state.listingKey = key;
    const gpu = config.gpus.find((g) => labelHash(g) === me.gpuId);
    const region = config.regions.find((r) => labelHash(r) === me.regionId);
    if (gpu) $('[data-upd="gpu"]').value = gpu;
    $('[data-upd="count"]').value = String(me.gpuCount);
    $('[data-upd="price"]').value = sol(me.pricePerGpuHour, 9).replace(/,/g, "");
    $('[data-upd="region"]').value = region || "";
  }
}

async function saveListing(event) {
  event.preventDefault();
  const f = listingForm("upd");
  const reason = listingProblem(f);
  if (reason) return note("listing", esc(reason), "error");
  await send("listing", `Preview: update to ${f.count} × ${gpuName(f.gpu)} at ${sol(f.price)} ${SOL} per GPU hour`);
}

async function toggleAvailability() {
  if (!state.me) return;
  await send("availability", state.me.available ? "Preview: take the listing offline" : "Preview: put the listing online");
}

async function deposit() {
  const amount = parseSol($("[data-deposit-amount]").value);
  if (!amount) return note("deposit", "Enter an amount in SOL.", "error");
  await send("deposit", `Preview: add ${sol(amount)} ${SOL} of stake`);
}

async function withdraw() {
  const amount = parseSol($("[data-withdraw-amount]").value);
  if (!amount) return note("withdraw", "Enter an amount in SOL.", "error");
  if (state.me && amount > state.me.freeStake) return note("withdraw", `At most ${sol(state.me.freeStake)} ${SOL} is free.`, "error");
  await send("withdraw", `Preview: withdraw ${sol(amount)} ${SOL} of free stake`);
}

function paintBoard() {
  const open = state.jobs.filter((j) => j.status === "Open" && j.openUntil > state.now);
  $("[data-board-rows]").replaceChildren(
    ...open.map((j) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">#${j.id}</td>
        <td>${esc(j.gpu)}</td>
        <td>${j.gpuCount}</td>
        <td>${j.durationHours}</td>
        <td class="rate">${sol(j.pricePerGpuHour)} ${SOL}</td>
        <td>${esc(j.region)}</td>
        <td>${when(j.openUntil)}</td>
        <td>${j.requireAttestation ? '<span class="stamp stamp--attested">Attested only</span>' : "Any"}</td>
        <td><button class="pick" type="button">Bid</button></td>`;
      $(".pick", tr).addEventListener("click", () => openJob(j.id));
      return tr;
    }),
  );
  $("[data-board-empty]").hidden = open.length > 0;
}

/* --------------------------------------------------------------- jobs ---- */

function roleIn(job) {
  const roles = [];
  if (same(job.buyer, state.account)) roles.push("Buyer");
  if (same(job.provider, state.account)) roles.push("Provider");
  return roles.join(", ");
}

const STATUS_TONE = {
  Open: "wait",
  Queued: "wait",
  Running: "live",
  Verified: "live",
  Disputed: "warn",
  Completed: "ok",
  Failed: "bad",
  Cancelled: "mute",
};

function statusPill(job) {
  const late = job.expired || (job.statusCode && isLate(job));
  return `<span class="status" data-tone="${STATUS_TONE[job.status] || "mute"}">${esc(job.status)}${late ? " · expired" : ""}</span>`;
}

function isLate(job) {
  if (job.status === "Queued") return state.now > job.createdAt + job.timeout;
  if (job.status === "Running") {
    if (job.verdictDueBy) return state.now > job.verdictDueBy;
    return state.now > job.deadline || state.now > job.lastHeartbeat + job.timeout;
  }
  return false;
}

function paintJobs() {
  const mine = state.jobsFilter === "mine";
  const rows = state.jobs.filter((j) => !mine || same(j.buyer, state.account) || same(j.provider, state.account));
  $("[data-job-rows]").replaceChildren(
    ...rows.map((j) => {
      const tr = document.createElement("tr");
      if (j.id === state.detailId) tr.classList.add("is-picked");
      tr.innerHTML = `
        <td class="mono">#${j.id}</td>
        <td>${statusPill(j)}</td>
        <td>${esc(j.gpu)} × ${j.gpuCount}</td>
        <td>${addressLink(j.buyer)}</td>
        <td>${j.provider === NO_KEY ? '<span class="muted">Taking bids</span>' : addressLink(j.provider)}</td>
        <td>${sol(j.escrow)} ${SOL}</td>
        <td>${roleIn(j) || '<span class="muted">None</span>'}</td>
        <td><button class="pick" type="button">Open</button></td>`;
      $(".pick", tr).addEventListener("click", () => openJob(j.id));
      return tr;
    }),
  );
  const empty = $("[data-jobs-empty]");
  empty.hidden = rows.length > 0;
  empty.textContent = mine && !state.account ? "Connect a wallet to see your jobs." : mine ? "You have no jobs yet." : "No job has been created yet.";
}

async function openJob(id) {
  state.detailId = id;
  state.detail = null;
  showTab("jobs");
  history.replaceState(null, "", `#job-${id}`);
  $("[data-detail]").hidden = false;
  $("[data-detail-title]").textContent = `Job #${id}`;
  $("[data-trace]").replaceChildren();
  $("[data-actions]").replaceChildren();
  note("action", "");
  $("[data-verify-result]").textContent = "";
  paintJobs();
  $("[data-detail]").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  state.detail =state.jobs.find((j) => j.id === id) || null;
  if (state.detail) paintDetail();
  else $("[data-detail-title]").textContent = `Job #${id} was not found on Solana`;
}

function closeJob() {
  state.detailId = 0;
  state.detail = null;
  $("[data-detail]").hidden = true;
  history.replaceState(null, "", "#jobs");
  paintJobs();
}

function paintStates(job) {
  const steps = [];
  if (job.viaBid) steps.push("Open");
  steps.push("Queued", "Running", "Verified");
  if (job.dispute.raisedAt) steps.push("Disputed");
  const terminal = ["Completed", "Failed", "Cancelled"].includes(job.status);
  steps.push(terminal ? job.status : "Settled");
  const at = steps.indexOf(job.status);
  $("[data-states]").replaceChildren(
    ...steps.map((name, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${esc(name)}</span>`;
      if (i < at) li.classList.add("is-done");
      if (i === at) li.classList.add(job.status === "Failed" ? "is-failed" : "is-now");
      return li;
    }),
  );
}

/** The evidence trail, rebuilt from what the program recorded. */
function traceOf(job) {
  const out = [];
  const add = (tone, label, title, detail, ts) => out.push({ tone, label, title, detail, ts });
  const onchain = "Verified onchain";

  if (job.viaBid) {
    add("onchain", onchain, `Posted for bids with a ${sol(job.funded)} ${SOL} budget.`, `bidding ${job.openUntil > state.now ? "closes" : "closed"} ${stamp(job.openUntil)}`, 0);
  }
  if (job.status !== "Open" && job.provider !== NO_KEY) {
    add(
      "onchain",
      onchain,
      `Escrow of ${sol(job.funded)} ${SOL} locked for ${shortAddress(job.provider)}.`,
      `${sol(job.pricePerGpuHour)} ${SOL} per GPU hour · ${sol(job.collateral)} ${SOL} provider collateral`,
      job.createdAt,
    );
  }
  if (job.startedAt) {
    add("reported", "Reported", `Provider started ${job.gpuCount} × ${job.gpu}.`, `deadline ${stamp(job.deadline)} · hardware as claimed`, job.startedAt);
  }
  if (job.heartbeats) {
    add("onchain", onchain, `${job.heartbeats} heartbeat${job.heartbeats === 1 ? "" : "s"} recorded.`, `last ${stamp(job.lastHeartbeat)}`, job.lastHeartbeat);
  }
  if (job.milestonesPaid) {
    const paid = tranches(job.funded, job.milestones).slice(0, job.milestonesPaid).reduce((a, b) => a + b, 0n);
    add("onchain", onchain, `${job.milestonesPaid} of ${job.milestones} milestones paid.`, `${sol(paid)} ${SOL} released to the provider`, 0);
  }
  if (job.resultHash !== ZERO_HASH) {
    add("reported", "Reported", "Provider submitted its output hash.", `${shortHash(job.resultHash)} · verdict due ${stamp(job.verdictDueBy)}`, 0);
  }
  const v = job.verification;
  if (v.verdictAt) {
    const attested = v.level === "Attested";
    add(
      attested ? "attested" : "reported",
      attested ? "Via attestation" : "Reported",
      v.success ? "Verifier found the result valid." : "Verifier found the result invalid.",
      `output ${shortHash(v.outputHash)} · ${attested ? `attestation ${shortHash(v.attestationHash)}` : "not attested"}`,
      v.verdictAt,
    );
  }
  const d = job.dispute;
  if (d.raisedAt) {
    add("onchain", onchain, `${same(d.disputant, job.buyer) ? "Buyer" : "Provider"} disputed the verdict.`, `${d.bond > 0n ? `bond ${sol(d.bond)} ${SOL} · ` : ""}decide by ${stamp(d.resolveBy)}`, d.raisedAt);
    if (d.resolved) {
      add(
        "onchain",
        onchain,
        d.upheld ? "Arbitrator upheld the dispute." : "Dispute closed without upholding it.",
        `provider share ${(d.providerShareBps / 100).toFixed(2).replace(/\.00$/, "")}%`,
        0,
      );
    }
  }
  const split = d.resolved && d.providerShareBps > 0 && d.providerShareBps < 10000;
  if (job.status === "Completed") {
    add("onchain", onchain, split ? "Settled as the arbitrator split it." : "Settled to the provider.", "escrow paid out, collateral returned", 0);
  }
  if (job.status === "Failed") {
    const slashed = providerSlashed(job);
    add(
      "onchain",
      onchain,
      split ? "Settled as the arbitrator split it." : "Settled to the buyer.",
      slashed === null
        ? "escrow and collateral settled as the dispute decided"
        : slashed
          ? "escrow refunded, provider collateral slashed to the buyer"
          : "escrow refunded, no penalty to the provider",
      0,
    );
  }
  if (job.status === "Cancelled") add("onchain", onchain, "Cancelled before it started.", "full refund to the buyer", 0);
  return out;
}

/**
 * Whether a failed job took the provider's collateral, following the fault
 * rules for settling, expiring and resolving a dispute over a job.
 */
function providerSlashed(job) {
  /* A decided dispute may or may not slash; the record does not say which. */
  if (job.dispute.raisedAt) return null;
  if (job.verification.verdictAt) return !job.verification.success;
  if (job.verdictDueBy) return false;
  if (job.startedAt) return true;
  return job.viaBid;
}

function paintDetail() {
  const job = state.detail;
  if (!job || job.id !== state.detailId) return;
  $("[data-detail-title]").innerHTML = `Job #${job.id} ${statusPill(job)}`;
  paintStates(job);

  $("[data-trace]").replaceChildren(
    ...traceOf(job).map((e) => {
      const li = document.createElement("li");
      li.dataset.tone = e.tone;
      li.className = "is-in";
      li.innerHTML = `<span class="stamp stamp--${e.tone}">${esc(e.label)}</span><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p>`;
      return li;
    }),
  );

  const ref = store.get("workloads", {})[`${config.network}:${job.id}`];
  const rows = [
    ["Buyer", addressLink(job.buyer)],
    ["Provider", job.provider === NO_KEY ? "Taking bids" : addressLink(job.provider)],
    ["GPU", `${esc(job.gpu)} × ${job.gpuCount}`],
    ["Region", esc(job.region)],
    ["Duration", `${job.durationHours} hours`],
    [job.status === "Open" ? "Most per GPU hour" : "Per GPU hour", `${sol(job.pricePerGpuHour)} ${SOL}`],
    ["Funded", `${sol(job.funded)} ${SOL}`],
    ["Still in escrow", `${sol(job.escrow)} ${SOL}`],
    ["Milestones", `${job.milestonesPaid} of ${job.milestones} paid`],
    ["Attestation", job.requireAttestation ? "Required" : "Not required"],
    ["Workload hash", `<span class="mono">${shortHash(job.workloadHash)}</span>`],
  ];
  if (ref) rows.push(["Workload", `<span class="mono">${esc(ref)}</span>`]);
  if (job.status === "Queued") rows.push(["Must start", when(job.createdAt + job.timeout)]);
  if (job.status === "Running" && !job.verdictDueBy) {
    rows.push(["Next heartbeat", when(job.lastHeartbeat + job.timeout)]);
    rows.push(["Deadline", when(job.deadline)]);
  }
  if (job.status === "Running" && job.verdictDueBy) rows.push(["Verdict due", when(job.verdictDueBy)]);
  if (job.status === "Verified") rows.push(["Dispute window ends", when(job.verification.verdictAt + job.disputeWindow)]);
  if (job.status === "Disputed") rows.push(["Arbitration ends", when(job.dispute.resolveBy)]);
  $("[data-receipt]").innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("");

  paintActions(job);
}

/* ------------------------------------------------------------ actions ---- */

function paintActions(job) {
  const me = state.account;
  const isBuyer = same(job.buyer, me);
  const isProvider = same(job.provider, me);
  const p = state.protocol;
  if (!p) return; /* repainted once the protocol parameters arrive */
  const parts = [];
  const button = (act, label, quiet = false) => `<button class="btn${quiet ? " btn--quiet" : ""}" type="button" data-act="${act}">${esc(label)}</button>`;
  const text = (t) => `<p class="hint">${esc(t)}</p>`;

  if (!me) parts.push(text("Connect a wallet to act on this job."));

  if (job.status === "Open") {
    if (job.bids.length) {
      parts.push(
        `<ul class="bids">${job.bids
          .map(
            (b) =>
              `<li><span>${addressLink(b.provider)}</span><span class="rate">${sol(b.price)} ${SOL}</span><span>${sol(cost(b.price, job.gpuCount, job.durationHours))} ${SOL} total</span>${
                isBuyer ? `<button class="pick" type="button" data-act="accept" data-provider="${b.provider}">Accept</button>` : ""
              }</li>`,
          )
          .join("")}</ul>`,
      );
    } else {
      parts.push(text(job.openUntil > state.now ? `No bids yet. Bidding closes ${when(job.openUntil)}.` : "Bidding closed with no bids."));
    }
    if (isBuyer) parts.push(button("cancel", "Cancel and refund", true));
    if (me && !isBuyer && job.openUntil > state.now) {
      const mine = job.bids.find((b) => same(b.provider, me));
      if (state.me && state.me.registered) {
        parts.push(`
          <div class="field">
            <label for="bid-price">Your price per GPU hour, in SOL</label>
            <div class="inline">
              <input id="bid-price" type="text" inputmode="decimal" autocomplete="off" data-input="bid" value="${mine ? sol(mine.price, 9).replace(/,/g, "") : ""}" placeholder="At most ${sol(job.pricePerGpuHour)}">
              <button class="btn" type="button" data-act="bid">${mine ? "Change bid" : "Place bid"}</button>
            </div>
          </div>`);
        if (mine) parts.push(button("withdraw-bid", "Withdraw bid", true));
      } else {
        parts.push(text("Register a listing on the Provide tab to bid."));
      }
    }
  }

  if (job.status === "Queued") {
    if (isProvider && !job.expired) parts.push(button("start", "Start job"), text(`Start ${when(job.createdAt + job.timeout)} or the job expires.`));
    if (isBuyer) parts.push(button("cancel", "Cancel and refund", true));
  }

  if (job.status === "Running") {
    if (isProvider && !job.expired) {
      if (!job.verdictDueBy) {
        parts.push(button("heartbeat", "Send heartbeat"), text(`Next one due ${when(job.lastHeartbeat + job.timeout)}.`));
        parts.push(`
          <div class="field">
            <label for="result-ref">Output hash or result reference</label>
            <div class="inline">
              <input id="result-ref" type="text" spellcheck="false" autocomplete="off" data-input="result" placeholder="Hash, URL or path">
              <button class="btn" type="button" data-act="result">Submit result</button>
            </div>
          </div>`);
      } else {
        parts.push(text(`Result in. The verifier has until ${stamp(job.verdictDueBy)}.`));
      }
    }
    if (state.roles.verifier) parts.push(verifierForm(job));
  }

  if (job.status === "Verified") {
    const v = job.verification;
    const windowEnds = v.verdictAt + job.disputeWindow;
    const disputant = v.success ? job.buyer : job.provider;
    if (same(disputant, me) && state.now <= windowEnds) {
      const bond = p.disputeBond === null ? "Raise a dispute" : `Dispute with a ${sol(p.disputeBond)} ${SOL} bond`;
      parts.push(button("dispute", bond, true), text(`The window closes ${when(windowEnds)}.`));
    }
    if (!job.finalizable) parts.push(text(`Anyone can settle it ${when(windowEnds)}.`));
  }

  if (job.status === "Disputed") {
    if (state.roles.arbitrator) parts.push(arbitratorForm(job));
    if (!job.finalizable) parts.push(text(`If undecided, the verdict stands ${when(job.dispute.resolveBy)}.`));
  }

  if (job.finalizable) parts.push(button("finalize", "Settle now"));
  if (job.expired) parts.push(button("expire", "Fail expired job and refund"), text("Anyone can call this once the job ran out of time."));

  if (["Completed", "Failed", "Cancelled"].includes(job.status)) parts.push(text("This job is settled. Nothing is left in escrow."));

  $("[data-actions]").innerHTML = parts.join("");
  $("[data-actions-card]").hidden = parts.length === 0;
}

function verifierForm(job) {
  const milestone =
    job.milestonesPaid + 1 < job.milestones
      ? `<div class="field">
          <label for="ms-evidence">Milestone evidence</label>
          <div class="inline">
            <input id="ms-evidence" type="text" spellcheck="false" autocomplete="off" data-input="milestone" placeholder="Report URL or hash">
            <button class="btn btn--quiet" type="button" data-act="milestone">Release ${sol(tranches(job.funded, job.milestones)[job.milestonesPaid])} ${SOL}</button>
          </div>
        </div>`
      : "";
  return `
    <div class="opform">
      <p class="label">Verifier</p>
      ${milestone}
      <div class="field">
        <label for="vd-output">Output hash</label>
        <input id="vd-output" type="text" spellcheck="false" autocomplete="off" data-input="output" value="${job.resultHash !== ZERO_HASH ? job.resultHash : ""}">
      </div>
      <div class="field">
        <label for="vd-evidence">Evidence reference</label>
        <input id="vd-evidence" type="text" spellcheck="false" autocomplete="off" data-input="evidence" placeholder="Report URL or hash">
      </div>
      <div class="field">
        <label for="vd-attest">Attestation reference</label>
        <input id="vd-attest" type="text" spellcheck="false" autocomplete="off" data-input="attestation" placeholder="Needed for an attested verdict">
      </div>
      <div class="inline">
        <button class="btn" type="button" data-act="verdict-ok">Valid</button>
        <button class="btn btn--quiet" type="button" data-act="verdict-bad">Invalid</button>
      </div>
    </div>`;
}

function arbitratorForm(job) {
  const d = job.dispute;
  return `
    <div class="opform">
      <p class="label">Arbitrator</p>
      <p class="hint">${same(d.disputant, job.buyer) ? "The buyer" : "The provider"} disputes a ${job.verification.success ? "valid" : "invalid"} verdict.</p>
      <div class="field">
        <label for="ar-share">Provider share of the remaining escrow, in percent</label>
        <input id="ar-share" type="number" min="0" max="100" step="1" value="${job.verification.success ? 100 : 0}" data-input="share">
      </div>
      <label class="check"><input type="checkbox" data-input="slash"><span>Slash the provider's collateral to the buyer</span></label>
      <label class="check"><input type="checkbox" data-input="upheld"><span>Uphold the dispute and return the bond</span></label>
      <button class="btn" type="button" data-act="resolve">Resolve dispute</button>
    </div>`;
}

async function act(event) {
  const target = event.target.closest("[data-act]");
  if (!target) return;
  const job = state.detail;
  if (!job) return;
  const id = job.id;
  const input = (name) => $(`[data-input="${name}"]`);
  const preview = (what) => send("action", `Preview: ${what} for job #${id}`);

  switch (target.dataset.act) {
    case "accept":
      return preview(`accept the bid from ${shortAddress(target.dataset.provider)}`);
    case "cancel":
      return preview("cancel and refund");
    case "bid": {
      const price = parseSol(input("bid").value);
      if (!price) return note("action", "Enter your price in SOL.", "error");
      if (price > job.pricePerGpuHour) return note("action", `The buyer pays at most ${sol(job.pricePerGpuHour)} ${SOL}.`, "error");
      return preview(`bid ${sol(price)} ${SOL} per GPU hour`);
    }
    case "withdraw-bid":
      return preview("withdraw your bid");
    case "start":
      return preview("start the run");
    case "heartbeat":
      return preview("record a heartbeat");
    case "result": {
      const hash = toDigest(input("result").value);
      if (hash === ZERO_HASH) return note("action", "Enter the output hash or a reference to it.", "error");
      return preview(`submit output ${shortHash(hash)}`);
    }
    case "milestone":
      return preview("release the next milestone");
    case "verdict-ok":
    case "verdict-bad": {
      const success = target.dataset.act === "verdict-ok";
      const output = toDigest(input("output").value);
      const attestation = toDigest(input("attestation").value);
      if (success && output === ZERO_HASH) return note("action", "A valid verdict needs the output hash.", "error");
      const attested = attestation !== ZERO_HASH;
      if (success && job.requireAttestation && !attested) return note("action", "This job needs an attestation reference.", "error");
      return preview(`record ${success ? "a valid" : "an invalid"}${attested ? " attested" : ""} verdict`);
    }
    case "dispute":
      return preview("raise a dispute");
    case "resolve": {
      const pct = Number(input("share").value);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return note("action", "Enter a share from 0 to 100.", "error");
      return preview(`resolve with a ${pct}% provider share`);
    }
    case "finalize":
      return preview("settle");
    case "expire":
      return preview("fail the expired run and refund");
    default:
      return undefined;
  }
}

function verifyWorkload() {
  const job = state.detail;
  const out = $("[data-verify-result]");
  if (!job) return;
  const value = $("[data-verify-input]").value.trim();
  if (!value) {
    out.textContent = "Paste a reference to check it.";
    return;
  }
  out.textContent = toDigest(value) === job.workloadHash ? "It matches the hash the buyer committed." : "It does not match this job.";
}

/* ------------------------------------------------------------ operate ---- */

function paintOperate() {
  const r = state.roles;
  const held = [
    r.admin && "admin",
    r.verifier && "verifier",
    r.arbitrator && "arbitrator",
    r.attestor && "attestor",
    r.pauser && "pauser",
  ].filter(Boolean);
  $("[data-roles]").textContent = held.length ? `This wallet holds: ${held.join(", ")}.` : "";
  $('[data-op="verifier"]').hidden = !r.verifier;
  $('[data-op="arbitrator"]').hidden = !r.arbitrator;
  $('[data-op="attestor"]').hidden = !r.attestor;
  $('[data-op="pauser"]').hidden = !r.pauser;
  if (state.protocol) $("[data-pause]").textContent = state.protocol.paused ? "Resume new jobs" : "Pause new jobs";

  const queue = (slot, jobs, describe) => {
    const ul = $(`[data-queue="${slot}"]`);
    ul.replaceChildren(
      ...jobs.map((j) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="mono">#${j.id}</span><span>${esc(describe(j))}</span><button class="pick" type="button">Open</button>`;
        $(".pick", li).addEventListener("click", () => openJob(j.id));
        return li;
      }),
    );
    if (!jobs.length) ul.innerHTML = '<li class="muted">Nothing waiting.</li>';
  };
  queue(
    "verdict",
    state.jobs.filter((j) => j.status === "Running").sort((a, b) => Number(b.resultHash !== ZERO_HASH) - Number(a.resultHash !== ZERO_HASH)),
    (j) => (j.verdictDueBy ? `Result in, verdict due ${when(j.verdictDueBy)}` : `Running, deadline ${when(j.deadline)}`),
  );
  queue(
    "dispute",
    state.jobs.filter((j) => j.status === "Disputed"),
    (j) => `${j.gpu} × ${j.gpuCount}, ${sol(j.escrow)} ${SOL} in escrow`,
  );
}

async function attest(clear) {
  const provider = $('[data-att="provider"]').value.trim();
  if (!isPublicKey(provider)) return note("attest", "Enter a valid provider public key.", "error");
  if (clear) return send("attest", `Preview: clear the attestation of ${shortAddress(provider)}`);
  const ref = toDigest($('[data-att="ref"]').value);
  if (ref === ZERO_HASH) return note("attest", "Enter the attestation reference.", "error");
  return send("attest", `Preview: attest the hardware of ${shortAddress(provider)}`);
}

async function togglePause() {
  if (!state.protocol) return;
  return send("pause", state.protocol.paused ? "Preview: resume new jobs" : "Preview: pause new jobs");
}

async function claim() {
  await send("fund", `Preview: claim ${sol(state.claimable)} ${SOL}`);
}

/* -------------------------------------------------------------- wire ----- */

function wire() {
  fillSelect($('[data-field="gpu"]'), config.gpus, { format: gpuName });
  fillSelect($('[data-field="region"]'), config.regions, { any: true, format: regionName });
  for (const prefix of ["reg", "upd"]) {
    fillSelect($(`[data-${prefix}="gpu"]`), config.gpus, { format: gpuName });
    fillSelect($(`[data-${prefix}="region"]`), config.regions, { any: true, format: regionName });
  }

  $("[data-wallet-connect]").addEventListener("click", (e) => {
    e.stopPropagation();
    if ($("[data-wallet-menu]").hidden) (state.account ? openMenu() : connect());
    else closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-wallet]")) closeMenu();
  });
  $("[data-connect-inline]").addEventListener("click", (e) => {
    e.stopPropagation();
    connect();
  });
  $("[data-claim-button]").addEventListener("click", claim);

  $$("[data-tab]").forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
  $$("[data-mode]").forEach((chip) => chip.addEventListener("click", () => setMode(chip.dataset.mode)));

  const form = $("[data-job-form]");
  form.addEventListener("input", paintQuote);
  form.addEventListener("change", paintQuote);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("[data-fund]").addEventListener("click", fund);

  const regForm = $("[data-register-form]");
  regForm.addEventListener("input", paintRegister);
  regForm.addEventListener("change", paintRegister);
  regForm.addEventListener("submit", (e) => e.preventDefault());
  $("[data-register]").addEventListener("click", register);

  $("[data-listing-form]").addEventListener("submit", saveListing);
  $("[data-availability]").addEventListener("click", toggleAvailability);
  $("[data-deposit]").addEventListener("click", deposit);
  $("[data-withdraw]").addEventListener("click", withdraw);
  $("[data-withdraw-max]").addEventListener("click", () => {
    if (state.me) $("[data-withdraw-amount]").value = sol(state.me.freeStake, 9).replace(/,/g, "");
  });

  $$("[data-jobs-filter]").forEach((chip) =>
    chip.addEventListener("click", () => {
      state.jobsFilter = chip.dataset.jobsFilter;
      $$("[data-jobs-filter]").forEach((c) => c.classList.toggle("is-on", c === chip));
      paintJobs();
    }),
  );
  $("[data-detail-close]").addEventListener("click", closeJob);
  $("[data-actions]").addEventListener("click", act);
  $("[data-verify]").addEventListener("click", verifyWorkload);

  $("[data-attest]").addEventListener("click", () => attest(false));
  $("[data-attest-clear]").addEventListener("click", () => attest(true));
  $("[data-pause]").addEventListener("click", togglePause);

  const footer = (sel, address) => {
    const link = $(sel);
    const url = explorerAddress(address);
    if (url) link.href = url;
    else link.hidden = true;
  };
  footer("[data-program-link]", config.programId);
  footer("[data-treasury-link]", config.treasuryAddress);
}

function route() {
  const hash = location.hash.slice(1);
  const job = /^job-(\d+)$/.exec(hash);
  if (job) openJob(Number(job[1]));
  else if (["rent", "provide", "jobs", "operate"].includes(hash)) showTab(hash);
}

async function reconnect() {
  const id = store.get("wallet", "");
  if (!id) return;
  /* Wallet Standard registrations can arrive after the page; give them a moment. */
  await new Promise((resolve) => setTimeout(resolve, 150));
  const w = wallets().find((x) => x.id === id);
  if (w) await useWallet(w, false);
}

async function start() {
  wire();
  setMode("direct");
  paintWallet();
  paintNetwork(config.rpcUrl ? "pending" : "error");
  route();
  await reconnect();
  await refresh();
  setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

start();
