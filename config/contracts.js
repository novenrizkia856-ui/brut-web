/**
 * BRUT contract configuration.
 *
 * A plain script, deliberately outside the bundle, so a deployment can be
 * pointed at contracts by editing this one file on the deployed site.
 *
 * Every field is optional. While a field is empty the page keeps its static
 * copy, so an undeployed contract never shows a broken value.
 */
window.CONTRACT_CONFIG = {
  /* Human readable chain name, shown wherever the network is named. */
  network: "",

  /* EIP 155 chain id. Used for wallet prompts and sanity checks. */
  chainId: 0,

  /* Public JSON RPC endpoint. Required before any live read runs. */
  rpcUrl: "",

  /* Block explorer root, no trailing slash. */
  explorerUrl: "",

  /**
   * BrutMarket: provider registry, job records, escrow and settlement.
   * Nothing is deployed yet, so this stays empty and the app runs on the
   * sample registry in js/sample-registry.js.
   */
  marketAddress: "",

  /**
   * BRUT token. The token is separate from the protocol contracts above, and
   * this is the only address the contract bar at the top of the page shows.
   */
  tokenAddress: "",

  /**
   * What actually reveals the address. Leave it false to fill in and review
   * tokenAddress ahead of time while the bar still reads "Coming soon", then
   * flip it to true at launch. One word, no rebuild.
   */
  tokenLaunched: false,

  /**
   * WalletConnect v2 project id, from cloud.reown.com.
   *
   * A public client identifier, not a secret: it ships in any dapp frontend.
   * Empty, and Connect falls back to an injected wallet only; with no injected
   * wallet either, the button does not render.
   */
  walletConnectProjectId: "",

  /* Force the WalletConnect QR flow even when a browser wallet is present. */
  preferWalletConnect: false,

  /* Optional outbound links. An empty value leaves the link inert. */
  links: {
    docs: "docs.html",
    x: "",
  },

  /**
   * Live numbers pulled from the deployed market contract.
   *
   * Each entry binds one view function to one element carrying a matching
   * data-brut-read attribute:
   *
   *   slot      the data-brut-read value in the page
   *   signature the solidity view function, exactly as declared
   *   returns   "uint256" | "bool" | "address" | "string"
   *   decimals  optional, divides a uint before it is shown
   *   template  optional, "{value}" is replaced with the formatted result
   *
   * A read that is missing, misconfigured or reverting is logged and skipped,
   * and the static copy stays on screen.
   */
  reads: [],
};
