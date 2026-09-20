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

export const config = {
  network: text(RAW.network),
  chainId: Number(RAW.chainId) || 0,
  rpcUrl: text(RAW.rpcUrl),
  explorerUrl: text(RAW.explorerUrl).replace(/\/+$/, ""),
  marketAddress: isAddress(RAW.marketAddress) ? text(RAW.marketAddress) : "",
  tokenAddress: isAddress(RAW.tokenAddress) ? text(RAW.tokenAddress) : "",
  tokenLaunched: RAW.tokenLaunched === true,
  walletConnectProjectId: text(RAW.walletConnectProjectId),
  preferWalletConnect: Boolean(RAW.preferWalletConnect),
  links: {
    docs: text(RAW.links && RAW.links.docs),
    x: text(RAW.links && RAW.links.x),
  },
  reads: Array.isArray(RAW.reads) ? RAW.reads : [],
};

/** True once there is a market contract and somewhere to read it from. */
export const isLive = Boolean(config.marketAddress && config.rpcUrl);

/** Explorer URL for an address, or "" when there is no explorer configured. */
export function explorerAddress(address) {
  if (!config.explorerUrl || !isAddress(address)) return "";
  return `${config.explorerUrl}/address/${address}`;
}

/** 0x1234…abcd, for showing an address in a tight space. */
export function shortAddress(address) {
  return isAddress(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}
