/**
 * Job pricing and the rules that decide whether a job can be sent.
 *
 * Pure, so the same code answers the form on screen and the tests in test/.
 * Amounts are lamports as BigInt, so a preview shows exactly what a job would
 * lock, down to the last lamport.
 *
 * The limits are the market's job rules: shape, bidder and budget.
 */

export const MAX_DURATION_HOURS = 720;
export const MAX_MILESTONES = 10;
/* Lamport amounts on Solana are unsigned 64 bit integers. */
const U64_MAX = (1n << 64n) - 1n;

const whole = (value, fallback = 0) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

/** price per GPU hour × GPUs × hours, in lamports. */
export function cost(pricePerGpuHour, gpuCount, durationHours) {
  const price = BigInt(pricePerGpuHour || 0);
  return price * BigInt(Math.max(0, whole(gpuCount))) * BigInt(Math.max(0, whole(durationHours)));
}

/**
 * Why the shape of a job is invalid, or "" when the market accepts it.
 * The order is the order a person fills the form in.
 */
export function shapeProblem({ gpuCount, durationHours, milestones, workload }) {
  const count = whole(gpuCount);
  const hours = whole(durationHours);
  const parts = whole(milestones);
  if (count < 1) return "Ask for at least one GPU.";
  if (hours < 1) return "Run the job for at least one hour.";
  if (hours > MAX_DURATION_HOURS) return `A job can run at most ${MAX_DURATION_HOURS} hours.`;
  if (parts < 1 || parts > MAX_MILESTONES) return `Split payment into 1 to ${MAX_MILESTONES} milestones.`;
  if (!String(workload || "").trim()) return "Add a container image or script reference.";
  return "";
}

/**
 * Why a direct hire of this provider cannot be sent, or "".
 *
 * @param {{gpuCount:number,durationHours:number,milestones:number,workload:string,requireAttestation:boolean}} request
 * @param {{gpuId:string,gpuCount:number,pricePerGpuHour:bigint,eligible:boolean,attested:boolean,address:string}|null} provider
 * @param {string} account the connected wallet's public key, base58
 */
export function hireProblem(request, provider, account = "") {
  if (!provider) return "Select a provider before funding.";
  if (!provider.eligible) return "That provider is not taking jobs right now.";
  if (account && provider.address === account) return "You cannot hire your own listing.";
  if (whole(request.gpuCount) > provider.gpuCount) return `That provider lists ${provider.gpuCount} GPUs.`;
  if (request.requireAttestation && !provider.attested) return "That provider has no hardware attestation yet.";
  const shape = shapeProblem(request);
  if (shape) return shape;
  if (cost(provider.pricePerGpuHour, request.gpuCount, request.durationHours) > U64_MAX) return "That job is too large.";
  return "";
}

/**
 * Why an open job cannot be posted, or "".
 *
 * @param {{gpuCount:number,durationHours:number,milestones:number,workload:string,gpu:string,maxPrice:bigint,biddingHours:number}} request
 * @param {number} maxBiddingSeconds params.maxBiddingPeriod
 */
export function postProblem(request, maxBiddingSeconds) {
  if (!request.gpu) return "Choose the GPU the job needs.";
  const shape = shapeProblem(request);
  if (shape) return shape;
  if (!request.maxPrice || request.maxPrice <= 0n) return "Set the most you will pay per GPU hour.";
  const seconds = whole(request.biddingHours) * 3600;
  if (seconds < 3600) return "Keep bidding open for at least one hour.";
  if (maxBiddingSeconds && seconds > maxBiddingSeconds) {
    return `Bidding can stay open at most ${Math.floor(maxBiddingSeconds / 3600)} hours.`;
  }
  if (cost(request.maxPrice, request.gpuCount, request.durationHours) > U64_MAX) return "That job is too large.";
  return "";
}

/** Payment released per milestone, the last one taking the remainder, in lamports. */
export function tranches(funded, milestones) {
  const total = BigInt(funded);
  const parts = Math.max(1, whole(milestones, 1));
  const each = total / BigInt(parts);
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? total - each * BigInt(parts - 1) : each));
}
