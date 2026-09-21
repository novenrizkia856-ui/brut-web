/**
 * Everything that talks to the chain.
 *
 * Reads go through the public RPC in config/contracts.js, so the app works
 * before any wallet connects. Writes go through the connected wallet, after
 * making sure it is on the configured chain. Nothing here touches the DOM.
 */
import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  formatEther,
  getAddress,
  id as keccakText,
  isHexString,
  parseEther,
  ZeroHash,
} from "../vendor/ethers-6.17.0.min.js";
import { config, isLive } from "./config.js";

export { formatEther, parseEther, ZeroHash, getAddress };

/* ------------------------------------------------------------------ ABIs -- */

const PROVIDER_TUPLE =
  "tuple(bool registered, bool available, bytes32 gpuId, uint32 gpuCount, uint128 pricePerGpuHour, bytes32 region, bytes32 metadataHash, bytes32 hardwareAttestation, uint256 stake, uint256 lockedStake, uint64 registeredAt, uint64 completedJobs, uint64 failedJobs, uint32 activeJobs, uint32 slashCount, uint256 slashedTotal)";

const JOB_TUPLE =
  "tuple(address buyer, address provider, bytes32 gpuType, bytes32 region, bytes32 workloadHash, uint32 gpuCount, uint32 durationHours, uint8 milestones, uint8 milestonesPaid, bool requireAttestation, bool viaBid, uint8 status, uint128 pricePerGpuHour, uint128 funded, uint128 escrow, uint128 collateral, uint64 timeout, uint64 disputeWindow, uint64 createdAt, uint64 openUntil, uint64 startedAt, uint64 deadline, uint64 lastHeartbeat, uint32 heartbeats, uint64 verificationTimeout, uint64 verdictDueBy, bytes32 resultHash)";

const ROLES = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
];

export const REGISTRY_ABI = [
  ...ROLES,
  "function ATTESTOR_ROLE() view returns (bytes32)",
  "function minStake() view returns (uint256)",
  "function providerCount() view returns (uint256)",
  "function getProviders(uint256 offset, uint256 limit) view returns (address[])",
  `function getProvider(address provider) view returns (${PROVIDER_TUPLE})`,
  "function freeStake(address provider) view returns (uint256)",
  "function isEligible(address provider, uint256 collateral) view returns (bool)",
  "function register(bytes32 gpuId, uint32 gpuCount, uint128 pricePerGpuHour, bytes32 region, bytes32 metadataHash) payable",
  "function updateListing(bytes32 gpuId, uint32 gpuCount, uint128 pricePerGpuHour, bytes32 region, bytes32 metadataHash)",
  "function setAvailability(bool available)",
  "function depositStake() payable",
  "function withdrawStake(uint256 amount)",
  "function attestHardware(address provider, bytes32 attestation)",
  "function clearHardwareAttestation(address provider)",
  "error NotRegistered()",
  "error AlreadyRegistered()",
  "error InvalidListing()",
  "error ZeroAmount()",
  "error ZeroAddress()",
  "error InsufficientFreeStake()",
  "error NotMarketplace()",
  "error MarketplaceAlreadySet()",
  "error TransferFailed()",
];

export const MARKET_ABI = [
  ...ROLES,
  "function VERIFIER_ROLE() view returns (bytes32)",
  "function ARBITRATOR_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function params() view returns (uint64 jobTimeout, uint64 disputeWindow, uint64 arbitrationTimeout, uint64 maxBiddingPeriod, uint64 verificationTimeout, uint128 jobCollateral, uint128 disputeBond)",
  "function paused() view returns (bool)",
  "function nextJobId() view returns (uint256)",
  "function claimable(address) view returns (uint256)",
  "function bidPrice(uint256 jobId, address provider) view returns (uint128)",
  `function getJob(uint256 jobId) view returns (${JOB_TUPLE})`,
  "function getVerification(uint256 jobId) view returns (tuple(bool success, uint8 level, uint64 verdictAt, bytes32 outputHash, bytes32 evidenceHash, bytes32 attestationHash))",
  "function getDispute(uint256 jobId) view returns (tuple(address disputant, uint128 bond, uint64 raisedAt, uint64 resolveBy, bool resolved, bool upheld, uint16 providerShareBps))",
  "function getBuyerStats(address buyer) view returns (tuple(uint64 jobsCreated, uint64 jobsCompleted, uint64 jobsFailed, uint64 jobsCancelled, uint32 disputesRaised, uint32 disputesUpheld))",
  "function bidCount(uint256 jobId) view returns (uint256)",
  "function getBids(uint256 jobId, uint256 offset, uint256 limit) view returns (address[] providers, uint128[] prices)",
  "function isExpired(uint256 jobId) view returns (bool)",
  "function isFinalizable(uint256 jobId) view returns (bool)",
  "function createJob(address provider, bytes32 gpuType, uint32 gpuCount, uint32 durationHours, uint8 milestones, bool requireAttestation, bytes32 workloadHash) payable returns (uint256)",
  "function postOpenJob(bytes32 gpuType, uint32 gpuCount, uint32 durationHours, uint128 maxPricePerGpuHour, bytes32 region, uint8 milestones, bool requireAttestation, bytes32 workloadHash, uint64 biddingPeriod) payable returns (uint256)",
  "function acceptBid(uint256 jobId, address provider)",
  "function cancelJob(uint256 jobId)",
  "function raiseDispute(uint256 jobId) payable",
  "function placeBid(uint256 jobId, uint128 pricePerGpuHour)",
  "function withdrawBid(uint256 jobId)",
  "function startJob(uint256 jobId)",
  "function heartbeat(uint256 jobId)",
  "function submitResult(uint256 jobId, bytes32 resultHash)",
  "function releaseMilestone(uint256 jobId, bytes32 evidenceHash)",
  "function submitVerdict(uint256 jobId, bool success, bytes32 outputHash, bytes32 evidenceHash, bytes32 attestationHash, uint8 level)",
  "function resolveDispute(uint256 jobId, uint16 providerShareBps, bool slash, bool upheld)",
  "function finalize(uint256 jobId)",
  "function failExpiredJob(uint256 jobId)",
  "function claim()",
  "function pause()",
  "function unpause()",
  "event JobCreated(uint256 indexed jobId, address indexed buyer, address indexed provider, uint32 gpuCount, uint32 durationHours, uint256 escrow, bytes32 workloadHash)",
  "event JobPosted(uint256 indexed jobId, address indexed buyer, bytes32 gpuType, uint32 gpuCount, uint32 durationHours, uint128 maxPricePerGpuHour, uint64 openUntil)",
  "error ZeroAddress()",
  "error InvalidParams()",
  "error ProviderNotEligible()",
  "error InvalidJob()",
  "error WrongPayment()",
  "error UnknownJob()",
  "error WrongStatus()",
  "error NotBuyer()",
  "error NotProvider()",
  "error NotDisputant()",
  "error BiddingClosed()",
  "error NoBid()",
  "error AttestationRequired()",
  "error NotExpired()",
  "error NotFinalizable()",
  "error WindowClosed()",
  "error NothingToClaim()",
  "error TransferFailed()",
  "error UnexpectedValue()",
  "error EnforcedPause()",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
];

export const STATUS = ["None", "Open", "Queued", "Running", "Verified", "Disputed", "Completed", "Failed", "Cancelled"];
export const LEVEL = ["None", "Reported", "Attested"];

/* --------------------------------------------------------------- labels -- */

/** bytes32 for a catalogue label, as the contracts store it. */
export const labelHash = (label) => keccakText(label);

const GPU_BY_HASH = new Map(config.gpus.map((label) => [labelHash(label), label]));
const REGION_BY_HASH = new Map(config.regions.map((label) => [labelHash(label), label]));

/** "A100-80GB" reads as "A100 80GB"; the page shows no hyphens. */
export const gpuName = (label) => label.replace(/-/g, " ");

/** "asia-southeast" reads as "Asia Southeast"; "us-east" as "US East". */
export function regionName(label) {
  return label
    .split("-")
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

export function gpuFromHash(hash) {
  if (GPU_BY_HASH.has(hash)) return gpuName(GPU_BY_HASH.get(hash));
  return hash && hash !== ZeroHash ? `GPU ${hash.slice(0, 8)}` : "None";
}

export function regionFromHash(hash) {
  if (!hash || hash === ZeroHash) return "Any region";
  if (REGION_BY_HASH.has(hash)) return regionName(REGION_BY_HASH.get(hash));
  return `Region ${hash.slice(0, 8)}`;
}

/**
 * A free text reference as bytes32: a 0x hash of 32 bytes is kept as it is,
 * anything else is hashed. Empty stays zero.
 */
export function toBytes32(text) {
  const value = String(text || "").trim();
  if (!value) return ZeroHash;
  if (isHexString(value, 32)) return value.toLowerCase();
  return keccakText(value);
}

/* ------------------------------------------------------------- reading -- */

export const reader = isLive
  ? new JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true, batchMaxCount: 50 })
  : null;

export const market = isLive ? new Contract(config.marketAddress, MARKET_ABI, reader) : null;
export const registry = isLive ? new Contract(config.registryAddress, REGISTRY_ABI, reader) : null;

const MARKET_IFACE = new Interface(MARKET_ABI);
const REGISTRY_IFACE = new Interface(REGISTRY_ABI);

const num = (v) => Number(v);

function shapeProvider(address, p, eligible) {
  return {
    address,
    registered: p.registered,
    available: p.available,
    gpuId: p.gpuId,
    gpu: gpuFromHash(p.gpuId),
    gpuCount: num(p.gpuCount),
    pricePerGpuHour: p.pricePerGpuHour,
    regionId: p.region,
    region: regionFromHash(p.region),
    metadataHash: p.metadataHash,
    attestation: p.hardwareAttestation,
    attested: p.hardwareAttestation !== ZeroHash,
    stake: p.stake,
    lockedStake: p.lockedStake,
    freeStake: p.stake - p.lockedStake,
    registeredAt: num(p.registeredAt),
    completedJobs: num(p.completedJobs),
    failedJobs: num(p.failedJobs),
    activeJobs: num(p.activeJobs),
    slashCount: num(p.slashCount),
    slashedTotal: p.slashedTotal,
    eligible,
  };
}

function shapeJob(id, j) {
  return {
    id,
    buyer: j.buyer,
    provider: j.provider,
    gpuType: j.gpuType,
    gpu: gpuFromHash(j.gpuType),
    regionId: j.region,
    region: regionFromHash(j.region),
    workloadHash: j.workloadHash,
    gpuCount: num(j.gpuCount),
    durationHours: num(j.durationHours),
    milestones: num(j.milestones),
    milestonesPaid: num(j.milestonesPaid),
    requireAttestation: j.requireAttestation,
    viaBid: j.viaBid,
    statusCode: num(j.status),
    status: STATUS[num(j.status)] || "None",
    pricePerGpuHour: j.pricePerGpuHour,
    funded: j.funded,
    escrow: j.escrow,
    collateral: j.collateral,
    timeout: num(j.timeout),
    disputeWindow: num(j.disputeWindow),
    createdAt: num(j.createdAt),
    openUntil: num(j.openUntil),
    startedAt: num(j.startedAt),
    deadline: num(j.deadline),
    lastHeartbeat: num(j.lastHeartbeat),
    heartbeats: num(j.heartbeats),
    verificationTimeout: num(j.verificationTimeout),
    verdictDueBy: num(j.verdictDueBy),
    resultHash: j.resultHash,
  };
}

/** Parameters that apply to new jobs, plus the registry's minimum stake. */
export async function readProtocol() {
  const [p, minStake, paused, nextJobId, providerCount] = await Promise.all([
    market.params(),
    registry.minStake(),
    market.paused(),
    market.nextJobId(),
    registry.providerCount(),
  ]);
  return {
    jobTimeout: num(p.jobTimeout),
    disputeWindow: num(p.disputeWindow),
    arbitrationTimeout: num(p.arbitrationTimeout),
    maxBiddingPeriod: num(p.maxBiddingPeriod),
    verificationTimeout: num(p.verificationTimeout),
    jobCollateral: p.jobCollateral,
    disputeBond: p.disputeBond,
    minStake,
    paused,
    jobCount: num(nextJobId) - 1,
    providerCount: num(providerCount),
  };
}

/** Every registered provider, with eligibility for one more job. */
export async function readProviders(collateral, total) {
  const PAGE = 100;
  const addresses = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    addresses.push(...(await registry.getProviders(offset, PAGE)));
  }
  return Promise.all(
    addresses.map(async (address) => {
      const [p, eligible] = await Promise.all([registry.getProvider(address), registry.isEligible(address, collateral)]);
      return shapeProvider(address, p, eligible);
    }),
  );
}

export async function readProvider(address, collateral) {
  const [p, eligible] = await Promise.all([registry.getProvider(address), registry.isEligible(address, collateral)]);
  return shapeProvider(address, p, eligible);
}

/** The newest `limit` jobs, newest first. */
export async function readJobs(jobCount, limit = 200) {
  const ids = [];
  for (let id = jobCount; id >= 1 && ids.length < limit; id -= 1) ids.push(id);
  const rows = await Promise.all(ids.map((id) => market.getJob(id)));
  return rows.map((row, i) => shapeJob(ids[i], row));
}

/** One job with its verdict, dispute, bids and time flags. */
export async function readJob(id) {
  const [j, v, d, expired, finalizable, bids] = await Promise.all([
    market.getJob(id),
    market.getVerification(id),
    market.getDispute(id),
    market.isExpired(id),
    market.isFinalizable(id),
    readBids(id),
  ]);
  const job = shapeJob(id, j);
  job.verification = {
    success: v.success,
    level: LEVEL[num(v.level)] || "None",
    levelCode: num(v.level),
    verdictAt: num(v.verdictAt),
    outputHash: v.outputHash,
    evidenceHash: v.evidenceHash,
    attestationHash: v.attestationHash,
  };
  job.dispute = {
    disputant: d.disputant,
    bond: d.bond,
    raisedAt: num(d.raisedAt),
    resolveBy: num(d.resolveBy),
    resolved: d.resolved,
    upheld: d.upheld,
    providerShareBps: num(d.providerShareBps),
  };
  job.expired = expired;
  job.finalizable = finalizable;
  job.bids = bids;
  return job;
}

async function readBids(id) {
  const count = num(await market.bidCount(id));
  const out = [];
  for (let offset = 0; offset < count; offset += 100) {
    const [providers, prices] = await market.getBids(id, offset, 100);
    providers.forEach((provider, i) => {
      if (prices[i] > 0n) out.push({ provider, price: prices[i] });
    });
  }
  return out.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
}

/** Which operator roles an account holds. */
export async function readRoles(account) {
  const [verifier, arbitrator, pauser, admin, attestor] = await Promise.all([
    market.VERIFIER_ROLE(),
    market.ARBITRATOR_ROLE(),
    market.PAUSER_ROLE(),
    market.DEFAULT_ADMIN_ROLE(),
    registry.ATTESTOR_ROLE(),
  ]);
  const [isVerifier, isArbitrator, isPauser, isAdmin, isAttestor] = await Promise.all([
    market.hasRole(verifier, account),
    market.hasRole(arbitrator, account),
    market.hasRole(pauser, account),
    market.hasRole(admin, account),
    registry.hasRole(attestor, account),
  ]);
  return { verifier: isVerifier, arbitrator: isArbitrator, pauser: isPauser, admin: isAdmin, attestor: isAttestor };
}

export async function readAccount(account) {
  const [balance, claimable] = await Promise.all([reader.getBalance(account), market.claimable(account)]);
  return { balance, claimable };
}

/** Chain time, which is what every deadline is measured against. */
export async function readNow() {
  const block = await reader.getBlock("latest");
  return block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
}

/* -------------------------------------------------------------- wallets -- */

/**
 * Browser wallets, found through EIP 6963 announcements with window.ethereum
 * as the fallback. Several extensions can coexist, so the page lists them.
 */
const found = new Map();

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const { info, provider } = event.detail || {};
    if (info && provider && !found.has(info.uuid)) found.set(info.uuid, { info, provider });
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

let injected = null;

const WC_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%233B99FC'/%3E%3Cpath d='M12.3 15.6c4.3-4.2 11.2-4.2 15.4 0l.5.5c.2.2.2.6 0 .8l-1.8 1.7c-.1.1-.3.1-.4 0l-.7-.7c-3-2.9-7.8-2.9-10.8 0l-.8.7c-.1.1-.3.1-.4 0l-1.8-1.7c-.2-.2-.2-.6 0-.8l.8-.5Zm19 3.5 1.6 1.6c.2.2.2.6 0 .8l-7.2 7c-.2.2-.6.2-.8 0l-5.1-5c-.1-.1-.1-.1-.2 0l-5.1 5c-.2.2-.6.2-.8 0l-7.2-7c-.2-.2-.2-.6 0-.8l1.6-1.6c.2-.2.6-.2.8 0l5.1 5c.1.1.1.1.2 0l5.1-5c.2-.2.6-.2.8 0l5.1 5c.1.1.1.1.2 0l5.1-5c.2-.2.6-.2.8 0Z' fill='%23fff'/%3E%3C/svg%3E";

/**
 * WalletConnect, for phone wallets and anyone without a browser extension.
 * The library is large, so it loads only when this option is picked, or when a
 * previous WalletConnect session is being restored.
 */
const walletConnect = config.walletConnectProjectId
  ? {
      info: { uuid: "walletconnect", name: "WalletConnect", icon: WC_ICON },
      provider: null,
      async init() {
        if (this.provider) return this.provider;
        const { EthereumProvider } = await import("../vendor/walletconnect-2.25.0.min.js");
        const origin = typeof location !== "undefined" ? location.origin : "";
        this.provider = await EthereumProvider.init({
          projectId: config.walletConnectProjectId,
          optionalChains: [config.chainId],
          rpcMap: { [config.chainId]: config.rpcUrl },
          showQrModal: true,
          qrModalOptions: { themeMode: "light", themeVariables: { "--wcm-accent-color": "#76b900", "--wcm-z-index": "1000" } },
          metadata: {
            name: "BRUT",
            description: "Rent GPU compute. Escrow and settlement run onchain.",
            url: origin,
            icons: [`${origin}/assets/brand/mark.svg`],
          },
        });
        return this.provider;
      },
    }
  : null;

export function wallets() {
  const list = [...found.values()];
  if (!list.length && typeof window !== "undefined" && window.ethereum) {
    /* One object per provider, so the page can recognise the same wallet again. */
    if (!injected || injected.provider !== window.ethereum) {
      injected = { info: { uuid: "injected", name: "Browser wallet", icon: "" }, provider: window.ethereum };
    }
    list.push(injected);
  }
  if (walletConnect) list.push(walletConnect);
  return list;
}

/** Ready the wallet's EIP 1193 provider, loading WalletConnect if it is the one. */
export async function prepare(wallet) {
  if (wallet.init) await wallet.init();
  return wallet.provider;
}

/** End the session where the wallet supports it; WalletConnect does. */
export async function release(wallet) {
  if (wallet && wallet.provider && typeof wallet.provider.disconnect === "function") {
    try {
      await wallet.provider.disconnect();
    } catch {
      /* already gone */
    }
  }
}

const hexChain = () => `0x${config.chainId.toString(16)}`;

/** Ask the wallet to move to the configured chain, adding it if unknown. */
export async function ensureChain(eip1193) {
  const current = await eip1193.request({ method: "eth_chainId" });
  if (Number(current) === config.chainId) return;
  try {
    await eip1193.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChain() }] });
  } catch (error) {
    if (error && (error.code === 4902 || (error.data && error.data.originalError && error.data.originalError.code === 4902))) {
      await eip1193.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChain(),
            chainName: config.network,
            nativeCurrency: config.currency,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : [],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

/** A signer on the configured chain, from the chosen wallet. */
export async function signerFor(eip1193) {
  await ensureChain(eip1193);
  const browser = new BrowserProvider(eip1193, "any");
  return browser.getSigner();
}

/* --------------------------------------------------------------- errors -- */

const MESSAGES = {
  NotRegistered: "Register as a provider first.",
  AlreadyRegistered: "This wallet is already registered.",
  InvalidListing: "The listing needs a GPU, a count and a price.",
  ZeroAmount: "Enter an amount above zero.",
  InsufficientFreeStake: "Not enough free stake for that.",
  ProviderNotEligible: "That provider cannot take this job.",
  InvalidJob: "The contract rejected those job details.",
  WrongPayment: "The price changed. Refresh and try again.",
  UnknownJob: "No job has that number.",
  WrongStatus: "The job has moved on. Refresh to see it.",
  NotBuyer: "Only the buyer can do that.",
  NotProvider: "Only the assigned provider can do that.",
  NotDisputant: "Only the side the verdict went against can dispute.",
  BiddingClosed: "Bidding on this job has closed.",
  NoBid: "There is no active bid from that provider.",
  AttestationRequired: "This job needs attested hardware.",
  NotExpired: "The job has not expired yet.",
  NotFinalizable: "The dispute window is still open.",
  WindowClosed: "The dispute window has closed.",
  NothingToClaim: "There is nothing to claim.",
  TransferFailed: "The transfer failed.",
  EnforcedPause: "New jobs and bids are paused right now.",
  AccessControlUnauthorizedAccount: "This wallet does not hold the role for that.",
};

/** A readable sentence for any wallet, RPC or contract error. */
export function explain(error) {
  if (!error) return "Something went wrong.";
  if (error.code === "ACTION_REJECTED" || error.code === 4001 || (error.info && error.info.error && error.info.error.code === 4001)) {
    return "You declined the request in your wallet.";
  }
  const data = findRevertData(error);
  if (data) {
    for (const iface of [MARKET_IFACE, REGISTRY_IFACE]) {
      try {
        const parsed = iface.parseError(data);
        if (parsed && MESSAGES[parsed.name]) return MESSAGES[parsed.name];
      } catch {
        /* not this contract's error */
      }
    }
  }
  if (error.code === "INSUFFICIENT_FUNDS") return "The wallet does not hold enough ETH for this.";
  if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT") return "The network did not answer. Try again.";
  const message = String(error.shortMessage || error.message || "");
  if (/insufficient funds/i.test(message)) return "The wallet does not hold enough ETH for this.";
  return "The transaction could not be sent. Try again.";
}

function findRevertData(error) {
  const seen = new Set();
  const stack = [error];
  while (stack.length) {
    const e = stack.pop();
    if (!e || typeof e !== "object" || seen.has(e)) continue;
    seen.add(e);
    if (typeof e.data === "string" && e.data.startsWith("0x") && e.data.length >= 10) return e.data;
    for (const key of ["error", "info", "data", "cause", "revert"]) if (e[key]) stack.push(e[key]);
  }
  return "";
}

/* ------------------------------------------------------------- display -- */

/** ETH with at most `digits` decimals, trailing zeros trimmed. */
export function eth(wei, digits = 6) {
  const text = formatEther(wei || 0n);
  const [whole, fraction = ""] = text.split(".");
  const cut = fraction.slice(0, digits).replace(/0+$/, "");
  const shown = cut ? `${whole}.${cut}` : whole;
  if (shown === "0" && wei > 0n) return `<0.${"0".repeat(digits - 1)}1`;
  return Number(whole).toLocaleString("en-US") + (cut ? `.${cut}` : "");
}

/** Parse a user typed ETH amount, or null when it is not a valid amount. */
export function parseAmount(text) {
  const value = String(text || "").trim();
  if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) return null;
  try {
    return parseEther(value.endsWith(".") ? value.slice(0, -1) : value);
  } catch {
    return null;
  }
}
