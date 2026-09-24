/**
 * Everything that talks to Solana.
 *
 * Reads go straight to the JSON RPC in config/solana.js, so the app works
 * before any wallet connects. Wallets are found through the Wallet Standard,
 * which Phantom, Solflare and Backpack all implement.
 *
 * Execution is not live. This module never asks a wallet to sign and never
 * builds or sends a transaction: it only connects, disconnects and reads.
 * Nothing here touches the DOM.
 */
import { config } from "./config.js";
import { isPublicKey, sha256Hex } from "./codec.js";

export { sol, parseSol, formatUnits, isPublicKey } from "./codec.js";

/**
 * Whether BRUT actions may reach the chain. There is no BRUT program to call
 * yet, so every action stops at a preview. Turning this on takes a program
 * and a client for it, not a flag.
 */
export const EXECUTION_LIVE = false;

/** The all zero key, which Solana accounts use for "none". */
export const NO_KEY = "11111111111111111111111111111111";

/** The all zero digest, for an empty reference. */
export const ZERO_HASH = "0".repeat(64);

/* --------------------------------------------------------------- labels -- */

/** The digest a listing stores for a catalogue label. */
export const labelHash = (label) => sha256Hex(label);

/** "A100-80GB" reads as "A100 80GB"; the page shows no hyphens. */
export const gpuName = (label) => label.replace(/-/g, " ");

/** "asia-southeast" reads as "Asia Southeast"; "us-east" as "US East". */
export function regionName(label) {
  return label
    .split("-")
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

/**
 * A free text reference as a 32 byte digest in hex: a 64 character hex digest
 * is kept as it is, anything else is hashed. Empty stays zero.
 */
export function toDigest(text) {
  const value = String(text || "").trim();
  if (!value) return ZERO_HASH;
  const hex = value.replace(/^0x/i, "");
  if (/^[0-9a-f]{64}$/i.test(hex)) return hex.toLowerCase();
  return sha256Hex(value);
}

/* ------------------------------------------------------------- reading -- */

let rpcId = 0;

/* A request that hangs would hold every later refresh behind it. */
const RPC_TIMEOUT_MS = 10000;

async function rpc(method, params = []) {
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: (rpcId += 1), method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RPC answered ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "RPC error");
  return body.result;
}

/** The cluster's current slot, which doubles as "is the RPC answering?". */
export async function readSlot() {
  return Number(await rpc("getSlot", [{ commitment: "confirmed" }]));
}

let tokenLookupWarned = false;

/**
 * Token accounts an owner holds for the configured mint. This is an indexed
 * query that some free RPCs refuse; the token balance then stays unknown
 * rather than failing the whole read.
 */
async function readTokenAccounts(owner) {
  try {
    return await rpc("getTokenAccountsByOwner", [owner, { mint: config.tokenMint }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  } catch (error) {
    if (!tokenLookupWarned) console.warn("BRUT: this RPC does not answer token balance lookups", error);
    tokenLookupWarned = true;
    return null;
  }
}

/**
 * A wallet's SOL balance in lamports and, once a mint is configured, its
 * balance of that token summed over every token account it holds.
 */
export async function readAccount(owner) {
  const [balance, token] = await Promise.all([
    rpc("getBalance", [owner, { commitment: "confirmed" }]),
    config.tokenMint ? readTokenAccounts(owner) : null,
  ]);
  let tokenBalance = null;
  if (token) {
    let amount = 0n;
    let decimals = 0;
    for (const entry of token.value || []) {
      const info = entry.account && entry.account.data && entry.account.data.parsed && entry.account.data.parsed.info;
      if (!info || !info.tokenAmount) continue;
      amount += BigInt(info.tokenAmount.amount || 0);
      decimals = Number(info.tokenAmount.decimals) || decimals;
    }
    tokenBalance = { amount, decimals };
  }
  return { balance: BigInt(balance && balance.value !== undefined ? balance.value : 0), token: tokenBalance };
}

/* -------------------------------------------------------------- wallets -- */

/**
 * Solana wallets, found through the Wallet Standard: the page announces it is
 * ready and every installed wallet registers itself, in either order. Only
 * the connect, disconnect and change events features are ever used.
 */
const standard = new Set();

function supportsSolana(wallet) {
  return (
    wallet &&
    Array.isArray(wallet.chains) &&
    wallet.chains.some((chain) => String(chain).startsWith("solana:")) &&
    wallet.features &&
    wallet.features["standard:connect"]
  );
}

if (typeof window !== "undefined") {
  const api = Object.freeze({
    register(...wallets) {
      for (const wallet of wallets) if (supportsSolana(wallet)) standard.add(wallet);
      return () => wallets.forEach((wallet) => standard.delete(wallet));
    },
  });
  window.addEventListener("wallet-standard:register-wallet", (event) => {
    if (typeof event.detail === "function") event.detail(api);
  });
  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  } catch {
    /* an extension threw while registering; the others still count */
  }
}

const accountOf = (accounts) => {
  const first = Array.isArray(accounts) && accounts.find((a) => a && isPublicKey(a.address));
  return first ? first.address : "";
};

function fromStandard(wallet) {
  const features = wallet.features;
  return {
    id: wallet.name,
    name: wallet.name,
    icon: wallet.icon || "",
    async connect(silent) {
      if (silent && wallet.accounts && wallet.accounts.length) return accountOf(wallet.accounts);
      const result = await features["standard:connect"].connect(silent ? { silent: true } : undefined);
      return accountOf(result && result.accounts);
    },
    async disconnect() {
      if (features["standard:disconnect"]) await features["standard:disconnect"].disconnect();
    },
    onChange(callback) {
      if (!features["standard:events"]) return () => {};
      return features["standard:events"].on("change", (change) => {
        if (change && "accounts" in change) callback(accountOf(change.accounts));
      });
    },
  };
}

/** Older wallets that only inject window.solana. */
function fromInjected(provider) {
  return {
    id: "injected",
    name: provider.isPhantom ? "Phantom" : "Solana wallet",
    icon: "",
    async connect(silent) {
      const result = await provider.connect(silent ? { onlyIfTrusted: true } : undefined);
      const key = (result && result.publicKey) || provider.publicKey;
      return key ? String(key.toString()) : "";
    },
    async disconnect() {
      if (provider.disconnect) await provider.disconnect();
    },
    onChange(callback) {
      if (!provider.on) return () => {};
      const change = (key) => callback(key ? String(key.toString()) : "");
      const gone = () => callback("");
      provider.on("accountChanged", change);
      provider.on("disconnect", gone);
      return () => {
        if (provider.off) {
          provider.off("accountChanged", change);
          provider.off("disconnect", gone);
        }
      };
    },
  };
}

const adapters = new WeakMap();
let injected = null;

/** Every wallet the page can connect to right now. */
export function wallets() {
  const list = [...standard].map((wallet) => {
    if (!adapters.has(wallet)) adapters.set(wallet, fromStandard(wallet));
    return adapters.get(wallet);
  });
  const legacy = typeof window !== "undefined" && window.solana;
  if (!list.length && legacy && typeof legacy.connect === "function") {
    if (!injected || injected.provider !== legacy) injected = { provider: legacy, adapter: fromInjected(legacy) };
    list.push(injected.adapter);
  }
  return list;
}

/**
 * Wallet apps that can open this page in their own browser, for phones with
 * no extension. Each link only opens the page; it connects nothing by itself.
 */
export function walletApps() {
  if (typeof location === "undefined") return [];
  const url = encodeURIComponent(location.href);
  const ref = encodeURIComponent(location.origin);
  return [
    { name: "Open in Phantom", href: `https://phantom.app/ul/browse/${url}?ref=${ref}` },
    { name: "Open in Solflare", href: `https://solflare.com/ul/v1/browse/${url}?ref=${ref}` },
  ];
}

/* --------------------------------------------------------------- errors -- */

/** A readable sentence for a wallet or RPC error. */
export function explain(error) {
  if (!error) return "Something went wrong.";
  const code = error.code;
  const message = String(error.message || "");
  if (code === 4001 || /reject|declin|cancel/i.test(message)) return "You declined the request in your wallet.";
  if (/fetch|network|RPC/i.test(message)) return "The Solana network did not answer. Try again.";
  return "The wallet could not connect. Try again.";
}
