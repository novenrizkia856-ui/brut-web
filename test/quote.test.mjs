/**
 * Pricing and sending rules.
 *
 * These decide the exact amount a job locks and whether the button works,
 * so they must agree with the market's rules to the lamport.
 * Run with `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { cost, shapeProblem, hireProblem, postProblem, tranches } from "../js/quote.js";

const LAMPORTS = 10n ** 9n; // one SOL
/* A placeholder key for the tests, not a real account. */
const PROVIDER = {
  address: "Provider1111111111111111111111111111111111",
  gpuId: "a100",
  gpuCount: 8,
  pricePerGpuHour: LAMPORTS / 1000n, // 0.001 SOL
  eligible: true,
  attested: false,
};

const request = (over = {}) => ({
  gpuCount: 4,
  durationHours: 6,
  milestones: 1,
  workload: "ghcr.io/example/trainer:v3",
  requireAttestation: false,
  ...over,
});

test("cost is price times GPUs times hours, in lamports", () => {
  assert.equal(cost(PROVIDER.pricePerGpuHour, 4, 6), 24_000_000n);
});

test("cost floors fractional input the way uint32 arguments would", () => {
  assert.equal(cost(10n, 2.9, 3.2), 60n);
});

test("a complete direct hire is sendable", () => {
  assert.equal(hireProblem(request(), PROVIDER), "");
});

test("no provider blocks first, whatever else is wrong", () => {
  assert.equal(hireProblem(request({ workload: "" }), null), "Select a provider before funding.");
});

test("an ineligible provider blocks", () => {
  assert.match(hireProblem(request(), { ...PROVIDER, eligible: false }), /not taking jobs/);
});

test("hiring your own listing blocks", () => {
  assert.match(hireProblem(request(), PROVIDER, PROVIDER.address), /your own listing/);
});

test("base58 keys are case sensitive, so a differently cased key is someone else", () => {
  assert.equal(hireProblem(request(), PROVIDER, PROVIDER.address.toLowerCase()), "");
});

test("asking for more GPUs than listed blocks", () => {
  assert.equal(hireProblem(request({ gpuCount: 9 }), PROVIDER), "That provider lists 8 GPUs.");
});

test("requiring attestation from an unattested provider blocks", () => {
  assert.match(hireProblem(request({ requireAttestation: true }), PROVIDER), /attestation/);
  assert.equal(hireProblem(request({ requireAttestation: true }), { ...PROVIDER, attested: true }), "");
});

test("shape limits match the market rules", () => {
  assert.match(shapeProblem(request({ gpuCount: 0 })), /at least one GPU/);
  assert.match(shapeProblem(request({ durationHours: 0 })), /at least one hour/);
  assert.equal(shapeProblem(request({ durationHours: 720 })), "");
  assert.match(shapeProblem(request({ durationHours: 721 })), /720 hours/);
  assert.match(shapeProblem(request({ milestones: 0 })), /milestones/);
  assert.equal(shapeProblem(request({ milestones: 10 })), "");
  assert.match(shapeProblem(request({ milestones: 11 })), /milestones/);
  assert.match(shapeProblem(request({ workload: "   " })), /container image/);
});

const post = (over = {}) => ({ ...request(), gpu: "A100-80GB", maxPrice: 5n * LAMPORTS, biddingHours: 24, ...over });

test("a complete open job is postable", () => {
  assert.equal(postProblem(post(), 2 * 86400), "");
});

test("an open job needs a GPU and a price", () => {
  assert.match(postProblem(post({ gpu: "" }), 86400), /GPU/);
  assert.match(postProblem(post({ maxPrice: 0n }), 86400), /per GPU hour/);
});

test("bidding period is bounded by the market's maximum", () => {
  assert.match(postProblem(post({ biddingHours: 0 }), 86400), /at least one hour/);
  assert.equal(postProblem(post({ biddingHours: 24 }), 86400), "");
  assert.match(postProblem(post({ biddingHours: 25 }), 86400), /at most 24 hours/);
});

test("milestone tranches sum to the funded escrow exactly", () => {
  const parts = tranches(1000n, 3);
  assert.deepEqual(parts, [333n, 333n, 334n]);
  assert.equal(parts.reduce((a, b) => a + b, 0n), 1000n);
  assert.deepEqual(tranches(1000n, 1), [1000n]);
});

test("a job whose cost overflows a u64 of lamports is too large", () => {
  const huge = { ...PROVIDER, gpuCount: 1024, pricePerGpuHour: 1n << 60n };
  assert.equal(hireProblem(request({ gpuCount: 1024, durationHours: 720 }), huge), "That job is too large.");
});
