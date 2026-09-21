/**
 * The BRUT app.
 *
 * Four panels over the two deployed contracts:
 *   Rent     hire a listed provider, or post a job for bids, funding escrow
 *   Provide  register a listing, manage stake and availability, bid on jobs
 *   Jobs     every job with its evidence, and the actions open to you now
 *   Operate  verdicts, disputes, attestations and pause, for role holders
 *
 * All state is read from the chain through the public RPC; the wallet is only
 * needed to send. After every confirmed transaction the page reads again, so
 * what is on screen is always what the contracts hold.
 */
import { config, isLive, explorerAddress, explorerTx, shortAddress } from "./config.js";
import {
  market,
  registry,
  readProtocol,
  readProviders,
  readProvider,
  readJobs,
  readJob,
  readRoles,
  readAccount,
  readNow,
  wallets,
  signerFor,
  prepare,
  release,
  explain,
  eth,
  parseAmount,
  labelHash,
  gpuName,
  regionName,
  toBytes32,
  ZeroHash,
  getAddress,
  MARKET_ABI,
} from "./chain.js";
import { cost, hireProblem, postProblem, tranches } from "./quote.js";
import { Interface } from "../vendor/ethers-6.17.0.min.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const POLL_MS = 20000;
const MARKET_IFACE = new Interface(MARKET_ABI);

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const same = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ETH = config.currency.symbol;

/* ------------------------------------------------------------- state ----- */

const state = {
  protocol: null,
  providers: [],
  jobs: [],
  now: Math.floor(Date.now() / 1000),
  account: "",
  wallet: null,
  chainOk: true,
  roles: { verifier: false, arbitrator: false, pauser: false, admin: false, attestor: false },
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
  busy: false,
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
  if (!address || address === ZERO_ADDRESS) return "None";
  const text = esc(label || shortAddress(address));
  const url = explorerAddress(address);
  const mine = same(address, state.account) ? ' <span class="you">you</span>' : "";
  return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>${mine}` : `${text}${mine}`;
}

const shortHash = (hash) => (hash && hash !== ZeroHash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : "None");

/* ------------------------------------------------------ transactions ----- */

function note(slot, html, tone = "") {
  const el = $(`[data-tx="${slot}"]`);
  if (!el) return;
  el.hidden = !html;
  el.dataset.tone = tone;
  el.innerHTML = html;
}

/**
 * Send one transaction through the connected wallet and report each stage
 * under the control that started it. Resolves to the receipt, or null.
 */
async function send(slot, build) {
  if (!state.wallet) {
    await connect();
    if (!state.wallet) return null;
  }
  if (state.busy) return null;
  state.busy = true;
  document.body.classList.add("is-busy");
  try {
    note(slot, "Confirm in your wallet.", "wait");
    const signer = await signerFor(state.wallet.provider);
    state.chainOk = true;
    paintChain();
    const tx = await build(signer);
    const link = explorerTx(tx.hash);
    note(slot, `Sent. Waiting for the block.${link ? ` <a href="${link}" target="_blank" rel="noopener noreferrer">View</a>` : ""}`, "wait");
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("reverted");
    note(slot, `Confirmed.${link ? ` <a href="${link}" target="_blank" rel="noopener noreferrer">View transaction</a>` : ""}`, "ok");
    await refresh();
    return receipt;
  } catch (error) {
    console.warn("BRUT: transaction failed", error);
    note(slot, esc(explain(error)), "error");
    return null;
  } finally {
    state.busy = false;
    document.body.classList.remove("is-busy");
  }
}

function jobIdFrom(receipt) {
  for (const log of receipt.logs || []) {
    if (!same(log.address, config.marketAddress)) continue;
    try {
      const parsed = MARKET_IFACE.parseLog(log);
      if (parsed && (parsed.name === "JobCreated" || parsed.name === "JobPosted")) return Number(parsed.args.jobId);
    } catch {
      /* another event */
    }
  }
  return 0;
}

/* ------------------------------------------------------------ wallet ----- */

function paintWallet() {
  const label = $("[data-wallet-label]");
  label.textContent = state.account ? shortAddress(state.account) : "Connect wallet";
  $("[data-wallet-connect]").classList.toggle("btn--quiet", Boolean(state.account));
}

function paintChain() {
  $("[data-wrong-chain]").hidden = !state.account || state.chainOk;
}

function closeMenu() {
  $("[data-wallet-menu]").hidden = true;
}

function openMenu() {
  const list = wallets();
  const menu = $("[data-wallet-menu]");
  const ul = $("[data-wallet-list]");
  ul.replaceChildren(
    ...list.map((w) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wallet__option";
      button.innerHTML = `${w.info.icon ? `<img src="${esc(w.info.icon)}" width="22" height="22" alt="">` : ""}<span>${esc(w.info.name)}</span>`;
      button.addEventListener("click", () => {
        closeMenu();
        useWallet(w, true);
      });
      li.append(button);
      return li;
    }),
  );
  if (state.account) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wallet__option wallet__option--quiet";
    button.textContent = "Disconnect";
    button.addEventListener("click", () => {
      closeMenu();
      disconnect();
    });
    li.append(button);
    ul.append(li);
  }
  $("[data-wallet-none]").hidden = list.length > 0;
  menu.hidden = false;
}

async function connect() {
  const list = wallets();
  if (list.length === 1 && !state.account) return useWallet(list[0], true);
  openMenu();
}

const bound = new WeakSet();

async function useWallet(w, prompt) {
  try {
    await prepare(w);
    let accounts;
    if (w.init) {
      /* WalletConnect: a new session opens the QR modal; a restored one is used as it is. */
      accounts = w.provider.session ? w.provider.accounts : prompt ? await w.provider.enable() : [];
    } else {
      accounts = await w.provider.request({ method: prompt ? "eth_requestAccounts" : "eth_accounts" });
    }
    const account = Array.isArray(accounts) && accounts[0] ? getAddress(accounts[0]) : "";
    if (!account) return;
    state.wallet = w;
    state.account = account;
    store.set("wallet", w.info.uuid);
    if (!bound.has(w.provider) && w.provider.on) {
      bound.add(w.provider);
      const current = () => state.wallet && state.wallet.provider === w.provider;
      w.provider.on("accountsChanged", (next) => {
        if (!current()) return;
        state.account = Array.isArray(next) && next[0] ? getAddress(next[0]) : "";
        if (!state.account) state.wallet = null;
        afterAccountChange();
      });
      w.provider.on("chainChanged", (chainId) => {
        if (!current()) return;
        state.chainOk = Number(chainId) === config.chainId;
        paintChain();
      });
    }
    const chainId = await w.provider.request({ method: "eth_chainId" });
    state.chainOk = Number(chainId) === config.chainId;
    afterAccountChange();
  } catch (error) {
    if (prompt && error && error.code !== 4001) console.warn("BRUT: wallet connect failed", error);
  }
}

function disconnect() {
  release(state.wallet);
  state.wallet = null;
  state.account = "";
  store.set("wallet", "");
  afterAccountChange();
}

function afterAccountChange() {
  state.me = null;
  state.listingKey = "";
  state.jobsFilter = state.account ? "mine" : "all";
  $$("[data-jobs-filter]").forEach((c) => c.classList.toggle("is-on", c.dataset.jobsFilter === state.jobsFilter));
  paintWallet();
  paintChain();
  refresh();
}

/* ----------------------------------------------------------- refresh ----- */

let refreshing = null;
let again = false;

/**
 * Read everything again. A call that arrives mid read, after an account change
 * or a transaction, queues one more pass so it never gets stale results.
 */
function refresh() {
  if (!isLive) return Promise.resolve();
  if (refreshing) {
    again = true;
    return refreshing.then(() => (again ? refresh() : undefined));
  }
  again = false;
  refreshing = (async () => {
    try {
      const [protocol, now] = await Promise.all([readProtocol(), readNow()]);
      state.protocol = protocol;
      state.now = now;
      const [providers, jobs] = await Promise.all([
        readProviders(protocol.jobCollateral, protocol.providerCount),
        readJobs(protocol.jobCount),
      ]);
      state.providers = providers;
      state.jobs = jobs;
      if (state.picked) state.picked = providers.find((p) => same(p.address, state.picked.address)) || null;

      if (state.account) {
        const [me, roles, account] = await Promise.all([
          readProvider(state.account, protocol.jobCollateral),
          readRoles(state.account),
          readAccount(state.account),
        ]);
        state.me = me;
        state.roles = roles;
        state.claimable = account.claimable;
      } else {
        state.me = null;
        state.roles = { verifier: false, arbitrator: false, pauser: false, admin: false, attestor: false };
        state.claimable = 0n;
      }
      if (state.detailId) state.detail = await readJob(state.detailId);
      paintNetwork("live");
      paintAll();
    } catch (error) {
      console.warn("BRUT: read failed", error);
      paintNetwork("error");
    } finally {
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
  if (!isLive) {
    strip.dataset.networkState = "error";
    label.textContent = "Contracts not configured";
    detail.textContent = "";
    return;
  }
  strip.dataset.networkState = mode;
  label.textContent = mode === "error" ? "Network not answering" : config.network;
  detail.textContent = `Chain ${config.chainId}`;
}

function paintVitals() {
  const p = state.protocol;
  if (!p) return;
  $("[data-vitals]").hidden = false;
  $('[data-vital="providers"]').textContent = String(p.providerCount);
  $('[data-vital="jobs"]').textContent = String(p.jobCount);
  $('[data-vital="collateral"]').textContent = `${eth(p.jobCollateral)} ${ETH}`;
  $('[data-vital="bond"]').textContent = `${eth(p.disputeBond)} ${ETH}`;
  $("[data-paused]").hidden = !p.paused;

  const claim = $("[data-claim]");
  claim.hidden = !(state.claimable > 0n);
  $("[data-claim-amount]").textContent = `${eth(state.claimable)} ${ETH}`;

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
    <td class="rate">${eth(p.pricePerGpuHour)} ${ETH}</td>
    <td>${esc(p.region)}</td>
    <td>${hardware}</td>
    <td>${p.completedJobs}${p.failedJobs ? ` <span class="muted">${p.failedJobs} failed</span>` : ""}</td>
    <td>${eth(p.stake, 4)} ${ETH}</td>
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
    maxPrice: parseAmount(v("max")) || 0n,
    region: v("region"),
    biddingHours: Math.floor(Number(v("bidding")) || 0),
  };
}

function problem(form) {
  if (!state.protocol) return "Reading the contracts.";
  if (state.protocol.paused) return "New jobs are paused right now.";
  if (state.mode === "direct") return hireProblem(form, state.picked, state.account);
  return postProblem(form, state.protocol.maxBiddingPeriod);
}

function paintQuote() {
  const form = readForm();
  const set = (slot, html) => ($(`[data-quote="${slot}"]`).innerHTML = html);
  const hours = Math.max(0, form.gpuCount) * Math.max(0, form.durationHours);
  set("hours", String(hours));
  set("collateral", state.protocol ? `${eth(state.protocol.jobCollateral)} ${ETH}` : "0");

  let total = 0n;
  if (state.mode === "direct") {
    set("provider", state.picked ? addressLink(state.picked.address) : "None selected");
    set("rate", state.picked ? `${eth(state.picked.pricePerGpuHour)} ${ETH}` : "Select a provider");
    set("total-label", "Locked on funding");
    total = state.picked ? cost(state.picked.pricePerGpuHour, form.gpuCount, form.durationHours) : 0n;
  } else {
    set("provider", "Chosen from bids");
    set("rate", form.maxPrice ? `Up to ${eth(form.maxPrice)} ${ETH}` : "Set a maximum");
    set("total-label", "Budget locked now");
    total = cost(form.maxPrice, form.gpuCount, form.durationHours);
  }
  set("total", `${eth(total)} ${ETH}`);

  const reason = problem(form);
  const button = $("[data-fund]");
  button.disabled = Boolean(reason);
  const label = $("[data-fund-label]");
  if (reason) label.textContent = state.mode === "direct" && !state.picked ? "Select a provider first" : "Cannot fund yet";
  else label.textContent = state.mode === "direct" ? `Lock ${eth(total)} ${ETH} in escrow` : `Post job with ${eth(total)} ${ETH}`;

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
  const workloadHash = toBytes32(form.workload);
  let receipt;
  if (state.mode === "direct") {
    const p = state.picked;
    const value = cost(p.pricePerGpuHour, form.gpuCount, form.durationHours);
    receipt = await send("fund", (signer) =>
      market
        .connect(signer)
        .createJob(p.address, p.gpuId, form.gpuCount, form.durationHours, form.milestones, form.requireAttestation, workloadHash, { value }),
    );
  } else {
    const value = cost(form.maxPrice, form.gpuCount, form.durationHours);
    const region = form.region ? labelHash(form.region) : ZeroHash;
    receipt = await send("fund", (signer) =>
      market
        .connect(signer)
        .postOpenJob(
          labelHash(form.gpu),
          form.gpuCount,
          form.durationHours,
          form.maxPrice,
          region,
          form.milestones,
          form.requireAttestation,
          workloadHash,
          form.biddingHours * 3600,
          { value },
        ),
    );
  }
  if (!receipt) return;
  const id = jobIdFrom(receipt);
  if (id) {
    const refs = store.get("workloads", {});
    refs[`${config.chainId}:${id}`] = form.workload;
    store.set("workloads", refs);
    openJob(id);
  }
}

/* ------------------------------------------------------------ provide ---- */

function listingForm(prefix) {
  const v = (name) => $(`[data-${prefix}="${name}"]`).value;
  return {
    gpu: v("gpu"),
    count: Math.floor(Number(v("count")) || 0),
    price: parseAmount(v("price")),
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
    hint.textContent = `At least ${eth(p.minStake)} ${ETH} to take jobs, plus ${eth(p.jobCollateral)} ${ETH} per job at once.`;
    const stake = $('[data-reg="stake"]');
    if (!stake.value) stake.value = eth(p.minStake + p.jobCollateral, 18).replace(/,/g, "");
    paintRegister();
  }

  if (!dash.hidden) paintDashboard();
}

function paintRegister() {
  const f = listingForm("reg");
  const stake = parseAmount($('[data-reg="stake"]').value);
  let reason = listingProblem(f);
  if (!reason && stake === null && $('[data-reg="stake"]').value.trim()) reason = "Enter the stake as a number.";
  const err = $("[data-reg-error]");
  err.hidden = !reason;
  err.textContent = reason;
  $("[data-register]").disabled = Boolean(reason);
  const label = $("[data-register-label]");
  label.textContent = stake ? `Register with ${eth(stake)} ${ETH} stake` : "Register listing";
}

async function register() {
  const f = listingForm("reg");
  if (listingProblem(f)) return;
  const stake = parseAmount($('[data-reg="stake"]').value) || 0n;
  await send("register", (signer) =>
    registry
      .connect(signer)
      .register(labelHash(f.gpu), f.count, f.price, f.region ? labelHash(f.region) : ZeroHash, toBytes32(f.meta), { value: stake }),
  );
}

function whyIneligible(me, p) {
  if (!me.available) return "You are offline. Go online to take jobs and bid.";
  if (me.stake < p.minStake) return `Stake below the ${eth(p.minStake)} ${ETH} minimum. Add stake to take jobs.`;
  if (me.freeStake < p.jobCollateral) return `Free stake below one job's ${eth(p.jobCollateral)} ${ETH} collateral.`;
  return "";
}

function paintDashboard() {
  const me = state.me;
  const p = state.protocol;
  const set = (slot, html) => ($(`[data-me="${slot}"]`).innerHTML = html);
  set("title", `${esc(me.gpu)} × ${me.gpuCount}, ${eth(me.pricePerGpuHour)} ${ETH} per GPU hour`);
  set("status", me.eligible ? "Taking jobs" : me.available ? "Online, not eligible" : "Offline");
  set("hardware", me.attested ? '<span class="stamp stamp--attested">Attested</span>' : '<span class="stamp stamp--reported">Reported</span>');
  set("stake", `${eth(me.stake)} ${ETH}`);
  set("free", `${eth(me.freeStake)} ${ETH}`);
  set("locked", `${eth(me.lockedStake)} ${ETH}`);
  set("done", String(me.completedJobs));
  set("failed", String(me.failedJobs));
  set("slashed", me.slashCount ? `${eth(me.slashedTotal)} ${ETH}` : "Never");
  set("why", esc(p ? whyIneligible(me, p) : ""));
  $("[data-availability]").textContent = me.available ? "Go offline" : "Go online";

  const key = `${me.gpuId}:${me.gpuCount}:${me.pricePerGpuHour}:${me.regionId}`;
  if (key !== state.listingKey) {
    state.listingKey = key;
    const gpu = config.gpus.find((g) => labelHash(g) === me.gpuId);
    const region = config.regions.find((r) => labelHash(r) === me.regionId);
    if (gpu) $('[data-upd="gpu"]').value = gpu;
    $('[data-upd="count"]').value = String(me.gpuCount);
    $('[data-upd="price"]').value = eth(me.pricePerGpuHour, 18).replace(/,/g, "");
    $('[data-upd="region"]').value = region || "";
  }
}

async function saveListing(event) {
  event.preventDefault();
  const f = listingForm("upd");
  const reason = listingProblem(f);
  if (reason) return note("listing", esc(reason), "error");
  const meta = f.meta ? toBytes32(f.meta) : state.me.metadataHash;
  await send("listing", (signer) =>
    registry.connect(signer).updateListing(labelHash(f.gpu), f.count, f.price, f.region ? labelHash(f.region) : ZeroHash, meta),
  );
}

async function toggleAvailability() {
  if (!state.me) return;
  await send("availability", (signer) => registry.connect(signer).setAvailability(!state.me.available));
}

async function deposit() {
  const amount = parseAmount($("[data-deposit-amount]").value);
  if (!amount) return note("deposit", "Enter an amount in ETH.", "error");
  const ok = await send("deposit", (signer) => registry.connect(signer).depositStake({ value: amount }));
  if (ok) $("[data-deposit-amount]").value = "";
}

async function withdraw() {
  const amount = parseAmount($("[data-withdraw-amount]").value);
  if (!amount) return note("withdraw", "Enter an amount in ETH.", "error");
  if (state.me && amount > state.me.freeStake) return note("withdraw", `At most ${eth(state.me.freeStake)} ${ETH} is free.`, "error");
  const ok = await send("withdraw", (signer) => registry.connect(signer).withdrawStake(amount));
  if (ok) $("[data-withdraw-amount]").value = "";
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
        <td class="rate">${eth(j.pricePerGpuHour)} ${ETH}</td>
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
        <td>${j.provider === ZERO_ADDRESS ? '<span class="muted">Taking bids</span>' : addressLink(j.provider)}</td>
        <td>${eth(j.escrow)} ${ETH}</td>
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
  try {
    state.detail = await readJob(id);
    paintDetail();
  } catch (error) {
    console.warn("BRUT: job read failed", error);
    $("[data-detail-title]").textContent = `Job #${id} could not be read`;
  }
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

/** The evidence trail, rebuilt from what the contracts recorded. */
function traceOf(job) {
  const out = [];
  const add = (tone, label, title, detail, ts) => out.push({ tone, label, title, detail, ts });
  const onchain = "Verified onchain";

  if (job.viaBid) {
    add("onchain", onchain, `Posted for bids with a ${eth(job.funded)} ${ETH} budget.`, `bidding ${job.openUntil > state.now ? "closes" : "closed"} ${stamp(job.openUntil)}`, 0);
  }
  if (job.status !== "Open" && job.provider !== ZERO_ADDRESS) {
    add(
      "onchain",
      onchain,
      `Escrow of ${eth(job.funded)} ${ETH} locked for ${shortAddress(job.provider)}.`,
      `${eth(job.pricePerGpuHour)} ${ETH} per GPU hour · ${eth(job.collateral)} ${ETH} provider collateral`,
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
    add("onchain", onchain, `${job.milestonesPaid} of ${job.milestones} milestones paid.`, `${eth(paid)} ${ETH} released to the provider`, 0);
  }
  if (job.resultHash !== ZeroHash) {
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
    add("onchain", onchain, `${same(d.disputant, job.buyer) ? "Buyer" : "Provider"} disputed the verdict.`, `${d.bond > 0n ? `bond ${eth(d.bond)} ${ETH} · ` : ""}decide by ${stamp(d.resolveBy)}`, d.raisedAt);
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
 * rules in ComputeMarketplace.finalize, failExpiredJob and resolveDispute.
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

  const ref = store.get("workloads", {})[`${config.chainId}:${job.id}`];
  const rows = [
    ["Buyer", addressLink(job.buyer)],
    ["Provider", job.provider === ZERO_ADDRESS ? "Taking bids" : addressLink(job.provider)],
    ["GPU", `${esc(job.gpu)} × ${job.gpuCount}`],
    ["Region", esc(job.region)],
    ["Duration", `${job.durationHours} hours`],
    [job.status === "Open" ? "Most per GPU hour" : "Per GPU hour", `${eth(job.pricePerGpuHour)} ${ETH}`],
    ["Funded", `${eth(job.funded)} ${ETH}`],
    ["Still in escrow", `${eth(job.escrow)} ${ETH}`],
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
              `<li><span>${addressLink(b.provider)}</span><span class="rate">${eth(b.price)} ${ETH}</span><span>${eth(cost(b.price, job.gpuCount, job.durationHours))} ${ETH} total</span>${
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
            <label for="bid-price">Your price per GPU hour, in ETH</label>
            <div class="inline">
              <input id="bid-price" type="text" inputmode="decimal" autocomplete="off" data-input="bid" value="${mine ? eth(mine.price, 18).replace(/,/g, "") : ""}" placeholder="At most ${eth(job.pricePerGpuHour)}">
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
              <input id="result-ref" type="text" spellcheck="false" autocomplete="off" data-input="result" placeholder="0x hash, URL or path">
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
      parts.push(button("dispute", `Dispute with a ${eth(p.disputeBond)} ${ETH} bond`, true), text(`The window closes ${when(windowEnds)}.`));
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
            <button class="btn btn--quiet" type="button" data-act="milestone">Release ${eth(tranches(job.funded, job.milestones)[job.milestonesPaid])} ${ETH}</button>
          </div>
        </div>`
      : "";
  return `
    <div class="opform">
      <p class="label">Verifier</p>
      ${milestone}
      <div class="field">
        <label for="vd-output">Output hash</label>
        <input id="vd-output" type="text" spellcheck="false" autocomplete="off" data-input="output" value="${job.resultHash !== ZeroHash ? job.resultHash : ""}">
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
  const m = (signer) => market.connect(signer);

  switch (target.dataset.act) {
    case "accept":
      return send("action", (s) => m(s).acceptBid(id, target.dataset.provider));
    case "cancel":
      return send("action", (s) => m(s).cancelJob(id));
    case "bid": {
      const price = parseAmount(input("bid").value);
      if (!price) return note("action", "Enter your price in ETH.", "error");
      if (price > job.pricePerGpuHour) return note("action", `The buyer pays at most ${eth(job.pricePerGpuHour)} ${ETH}.`, "error");
      return send("action", (s) => m(s).placeBid(id, price));
    }
    case "withdraw-bid":
      return send("action", (s) => m(s).withdrawBid(id));
    case "start":
      return send("action", (s) => m(s).startJob(id));
    case "heartbeat":
      return send("action", (s) => m(s).heartbeat(id));
    case "result": {
      const hash = toBytes32(input("result").value);
      if (hash === ZeroHash) return note("action", "Enter the output hash or a reference to it.", "error");
      return send("action", (s) => m(s).submitResult(id, hash));
    }
    case "milestone":
      return send("action", (s) => m(s).releaseMilestone(id, toBytes32(input("milestone").value)));
    case "verdict-ok":
    case "verdict-bad": {
      const success = target.dataset.act === "verdict-ok";
      const output = toBytes32(input("output").value);
      const evidence = toBytes32(input("evidence").value);
      const attestation = toBytes32(input("attestation").value);
      if (success && output === ZeroHash) return note("action", "A valid verdict needs the output hash.", "error");
      const level = attestation !== ZeroHash ? 2 : 1;
      if (success && job.requireAttestation && level !== 2) return note("action", "This job needs an attestation reference.", "error");
      return send("action", (s) => m(s).submitVerdict(id, success, output, evidence, attestation, level));
    }
    case "dispute":
      return send("action", (s) => m(s).raiseDispute(id, { value: state.protocol.disputeBond }));
    case "resolve": {
      const pct = Number(input("share").value);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return note("action", "Enter a share from 0 to 100.", "error");
      return send("action", (s) => m(s).resolveDispute(id, Math.round(pct * 100), input("slash").checked, input("upheld").checked));
    }
    case "finalize":
      return send("action", (s) => m(s).finalize(id));
    case "expire":
      return send("action", (s) => m(s).failExpiredJob(id));
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
  out.textContent = toBytes32(value) === job.workloadHash ? "It matches the hash the buyer committed." : "It does not match this job.";
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
    state.jobs.filter((j) => j.status === "Running").sort((a, b) => Number(b.resultHash !== ZeroHash) - Number(a.resultHash !== ZeroHash)),
    (j) => (j.verdictDueBy ? `Result in, verdict due ${when(j.verdictDueBy)}` : `Running, deadline ${when(j.deadline)}`),
  );
  queue(
    "dispute",
    state.jobs.filter((j) => j.status === "Disputed"),
    (j) => `${j.gpu} × ${j.gpuCount}, ${eth(j.escrow)} ${ETH} in escrow`,
  );
}

async function attest(clear) {
  const raw = $('[data-att="provider"]').value.trim();
  let provider;
  try {
    provider = getAddress(raw);
  } catch {
    return note("attest", "Enter a valid provider address.", "error");
  }
  if (clear) return send("attest", (s) => registry.connect(s).clearHardwareAttestation(provider));
  const ref = toBytes32($('[data-att="ref"]').value);
  if (ref === ZeroHash) return note("attest", "Enter the attestation reference.", "error");
  return send("attest", (s) => registry.connect(s).attestHardware(provider, ref));
}

async function togglePause() {
  if (!state.protocol) return;
  const paused = state.protocol.paused;
  return send("pause", (s) => (paused ? market.connect(s).unpause() : market.connect(s).pause()));
}

async function claim() {
  const el = $("[data-claim-button]");
  el.disabled = true;
  await send("fund", (s) => market.connect(s).claim());
  el.disabled = false;
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
  $("[data-switch-chain]").addEventListener("click", async () => {
    if (!state.wallet) return;
    try {
      await signerFor(state.wallet.provider);
      state.chainOk = true;
      paintChain();
    } catch (error) {
      console.warn("BRUT: switch failed", error);
    }
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
    if (state.me) $("[data-withdraw-amount]").value = eth(state.me.freeStake, 18).replace(/,/g, "");
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
  footer("[data-contract-link]", config.marketAddress);
  footer("[data-registry-link]", config.registryAddress);
}

function route() {
  const hash = location.hash.slice(1);
  const job = /^job-(\d+)$/.exec(hash);
  if (job) openJob(Number(job[1]));
  else if (["rent", "provide", "jobs", "operate"].includes(hash)) showTab(hash);
}

async function reconnect() {
  const uuid = store.get("wallet", "");
  if (!uuid) return;
  /* EIP 6963 announcements arrive asynchronously; give them a moment. */
  await new Promise((resolve) => setTimeout(resolve, 150));
  const list = wallets();
  const w = list.find((x) => x.info.uuid === uuid) || (uuid === "injected" ? list.find((x) => !x.init) : null);
  if (w) await useWallet(w, false);
}

async function start() {
  wire();
  setMode("direct");
  paintWallet();
  paintNetwork(isLive ? "pending" : "error");
  route();
  await reconnect();
  await refresh();
  setInterval(() => {
    if (document.visibilityState === "visible" && !state.busy) refresh();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

start();
