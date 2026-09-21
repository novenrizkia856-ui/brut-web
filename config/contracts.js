/**
 * BRUT contract configuration.
 *
 * A plain script, deliberately outside any bundle, so the deployed site can be
 * pointed at contracts by editing this one file. The values below come from
 * brut-contracts/deployments/<chainId>.json after a deploy.
 */
window.CONTRACT_CONFIG = {
  /* Human readable chain name, shown wherever the network is named. */
  network: "Robinhood Chain",

  /* EIP 155 chain id. Wallets are asked to switch to it before any write. */
  chainId: 4663,

  /* Public JSON RPC endpoint, used for every read. */
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",

  /* Block explorer root, no trailing slash. */
  explorerUrl: "https://robinhoodchain.blockscout.com",

  /* Native currency, as a wallet should display it when adding the chain. */
  currency: { name: "Ether", symbol: "ETH", decimals: 18 },

  /* ComputeMarketplace: jobs, bids, escrow, verdicts, disputes, settlement. */
  marketAddress: "",

  /* ProviderRegistry: listings, stake, collateral, hardware attestation. */
  registryAddress: "",

  /* Block the contracts were deployed in. */
  deployBlock: 0,

  /**
   * BRUT token. The token is separate from the protocol contracts above, and
   * this is the only address the contract bar at the top of the page shows.
   */
  tokenAddress: "",

  /**
   * What actually reveals the token address. Leave it false to fill in and
   * review tokenAddress ahead of time while the bar still reads "Coming soon",
   * then flip it to true at launch.
   */
  tokenLaunched: false,

  /**
   * GPU models and regions a listing can name. Onchain they are stored as
   * keccak256 of the label, so these lists are how the app turns hashes back
   * into names. Adding a label here is safe; renaming one orphans its listings.
   */
  gpus: ["A100-80GB", "A100-40GB", "H100-80GB", "H200-141GB", "B200", "L40S", "RTX-4090", "RTX-5090"],
  regions: ["us-east", "us-west", "eu-west", "eu-central", "eu-north", "asia-east", "asia-southeast", "oceania"],

  /* Optional outbound links. An empty value leaves the link inert. */
  links: {
    docs: "docs.html",
    x: "",
  },
};
