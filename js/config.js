/**
 * Config loader.
 *
 * config/contracts.js is a plain script that sets window.CONTRACT_CONFIG, so
 * it is already present by the time this runs. Everything here is about
 * answering "is this configured?" without every caller repeating the checks.
 */
const RAW = (typeof window !== "undefined" && window.CONTRACT_CONFIG) || {};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(text(value));
const labels = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

export const config = {
  network: text(RAW.network),
  chainId: Number(RAW.chainId) || 0,
  rpcUrl: text(RAW.rpcUrl),
  explorerUrl: text(RAW.explorerUrl).replace(/\/+$/, ""),
  currency: {
    name: text(RAW.currency && RAW.currency.name) || "Ether",
    symbol: text(RAW.currency && RAW.currency.symbol) || "ETH",
    decimals: 18,
  },
  marketAddress: isAddress(RAW.marketAddress) ? text(RAW.marketAddress) : "",
  registryAddress: isAddress(RAW.registryAddress) ? text(RAW.registryAddress) : "",
  deployBlock: Number(RAW.deployBlock) || 0,
  tokenAddress: isAddress(RAW.tokenAddress) ? text(RAW.tokenAddress) : "",
  tokenLaunched: RAW.tokenLaunched === true,
  gpus: labels(RAW.gpus),
  regions: labels(RAW.regions),
  links: {
    docs: text(RAW.links && RAW.links.docs),
    x: text(RAW.links && RAW.links.x),
  },
};

/** True once both contracts and somewhere to read them from are configured. */
export const isLive = Boolean(config.marketAddress && config.registryAddress && config.rpcUrl && config.chainId);

/** Explorer URL for an address, or "" when there is no explorer configured. */
export function explorerAddress(address) {
  if (!config.explorerUrl || !isAddress(address)) return "";
  return `${config.explorerUrl}/address/${address}`;
}

/** Explorer URL for a transaction hash. */
export function explorerTx(hash) {
  if (!config.explorerUrl || !/^0x[0-9a-fA-F]{64}$/.test(text(hash))) return "";
  return `${config.explorerUrl}/tx/${hash}`;
}

/** 0x1234…abcd, for showing an address in a tight space. */
export function shortAddress(address) {
  return isAddress(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}
