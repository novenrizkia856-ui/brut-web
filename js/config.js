/**
 * Config loader.
 *
 * config/solana.js is a plain script that sets window.SOLANA_CONFIG, so it is
 * already present by the time this runs. Everything here is about answering
 * "is this configured?" without every caller repeating the checks.
 */
import { isPublicKey } from "./codec.js";

const RAW = (typeof window !== "undefined" && window.SOLANA_CONFIG) || {};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const key = (value) => (isPublicKey(value) ? text(value) : "");
const labels = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

/* Clusters the explorer and the network strip know how to name. */
const CLUSTERS = {
  "mainnet-beta": "Mainnet beta",
  devnet: "Devnet",
  testnet: "Testnet",
};

const network = CLUSTERS[text(RAW.network)] ? text(RAW.network) : "mainnet-beta";

export const config = {
  network,
  networkName: CLUSTERS[network],
  rpcUrl: text(RAW.rpcUrl),
  explorerUrl: text(RAW.explorerUrl).replace(/\/+$/, ""),
  programId: key(RAW.programId),
  tokenMint: key(RAW.tokenMint),
  tokenLaunched: RAW.tokenLaunched === true,
  tokenSymbol: text(RAW.tokenSymbol) || "BRUT",
  treasuryAddress: key(RAW.treasuryAddress),
  gpus: labels(RAW.gpus),
  regions: labels(RAW.regions),
  links: {
    docs: text(RAW.links && RAW.links.docs),
    x: text(RAW.links && RAW.links.x),
  },
};

/* Mainnet is the explorer's default; every other cluster is named per link. */
const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;

/** Solana Explorer URL for an account, program or mint, or "". */
export function explorerAddress(address) {
  if (!config.explorerUrl || !isPublicKey(address)) return "";
  return `${config.explorerUrl}/address/${address}${cluster}`;
}

/** ABCD…WXYZ, for showing a public key in a tight space. */
export function shortAddress(address) {
  return isPublicKey(address) ? `${address.slice(0, 4)}…${address.slice(-4)}` : "";
}
