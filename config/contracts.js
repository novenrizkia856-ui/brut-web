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
  marketAddress: "0xB2e3769E99a011f9e9D55AB72936B0760625157a",

  /* ProviderRegistry: listings, stake, collateral, hardware attestation. */
  registryAddress: "0x3139A2c1F791fb9A507e0E6c0b06815A99734536",

  /* Block the contracts were deployed in. */
  deployBlock: 68641745,

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

  /**
   * WalletConnect project id, from cloud.reown.com. A public client id, not a
   * secret. It adds a WalletConnect option, so phone wallets can connect by QR.
   * The site's domain must be allowed for this id in the Reown dashboard.
   */
  walletConnectProjectId: "ff24e7c4e7d10744e3ccd080e4307cad",

  /* Optional outbound links. An empty value leaves the link inert. */
  links: {
    docs: "docs.html",
    x: "",
  },
};
