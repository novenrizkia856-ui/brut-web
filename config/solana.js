/**
 * BRUT Solana configuration.
 *
 * A plain script, deliberately outside any bundle, so the deployed site can be
 * pointed at a network, a token mint or a program by editing this one file.
 * `npm run config` rewrites it from environment variables, see .env.example.
 *
 * Leave any address empty until it really exists. Nothing here is a secret:
 * every value ends up in the visitor's browser.
 */
window.SOLANA_CONFIG = {
  /* Solana cluster: "mainnet-beta", "devnet" or "testnet". */
  network: "mainnet-beta",

  /**
   * JSON RPC endpoint for every read. It must allow browser requests: the
   * Solana Foundation endpoint, api.mainnet-beta.solana.com, refuses them.
   * PublicNode is free and allows them, but is rate limited and does not
   * answer token balance lookups; use a dedicated provider for production.
   */
  rpcUrl: "https://solana-rpc.publicnode.com",

  /* Solana Explorer root, no trailing slash. The cluster is added per link. */
  explorerUrl: "https://explorer.solana.com",

  /**
   * BRUT program id. Empty: no BRUT program is deployed, so the app reads
   * no listings or jobs and previews every action without sending it.
   */
  programId: "",

  /**
   * BRUT SPL token mint. Separate from the program, and the only address the
   * token line on the landing page shows.
   */
  tokenMint: "",

  /**
   * What actually reveals the token mint. Leave it false to fill in and
   * review tokenMint ahead of time while the line still reads "Coming soon",
   * then flip it to true at launch.
   */
  tokenLaunched: false,

  /* Label for the token wherever a balance is shown. */
  tokenSymbol: "BRUT",

  /* Protocol treasury, linked from the app footer once set. */
  treasuryAddress: "",

  /**
   * GPU models and regions a listing can name. A listing commits to the
   * SHA-256 of the label, so these lists turn digests back into names. Adding
   * a label is safe; renaming one orphans its listings.
   */
  gpus: ["A100-80GB", "A100-40GB", "H100-80GB", "H200-141GB", "B200", "L40S", "RTX-4090", "RTX-5090"],
  regions: ["us-east", "us-west", "eu-west", "eu-central", "eu-north", "asia-east", "asia-southeast", "oceania"],

  /* Optional outbound links. An empty value leaves the link inert. */
  links: {
    docs: "docs.html",
    x: "",
  },
};
