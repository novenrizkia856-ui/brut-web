/**
 * Pricing and sending rules.
 *
 * These decide the exact value a wallet is asked to send and whether the
 * button works, so they must agree with ComputeMarketplace to the wei.
 * Run with `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { cost, shapeProblem, hireProblem, postProblem, tranches } from "../js/quote.js";

const GWEI = 10n ** 9n;
const PROVIDER = {
  address: "0x9A3f27c1B4e0d8A7F5c26E1b0D34a9C8e7F10b25",
  gpuId: "0x01",
  gpuCount: 8,
  pricePerGpuHour: 1_000_000n * GWEI, // 0.001 ETH
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

test("cost is price times GPUs times hours, in wei", () => {
  assert.equal(cost(PROVIDER.pricePerGpuHour, 4, 6), 24_000_000n * GWEI);
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

test("hiring your own listing blocks, whatever the address case", () => {
  assert.match(hireProblem(request(), PROVIDER, PROVIDER.address.toLowerCase()), /your own listing/);
});

test("asking for more GPUs than listed blocks", () => {
  assert.equal(hireProblem(request({ gpuCount: 9 }), PROVIDER), "That provider lists 8 GPUs.");
});

test("requiring attestation from an unattested provider blocks", () => {
  assert.match(hireProblem(request({ requireAttestation: true }), PROVIDER), /attestation/);
  assert.equal(hireProblem(request({ requireAttestation: true }), { ...PROVIDER, attested: true }), "");
});

test("shape limits match the contract", () => {
  assert.match(shapeProblem(request({ gpuCount: 0 })), /at least one GPU/);
  assert.match(shapeProblem(request({ durationHours: 0 })), /at least one hour/);
  assert.equal(shapeProblem(request({ durationHours: 720 })), "");
  assert.match(shapeProblem(request({ durationHours: 721 })), /720 hours/);
  assert.match(shapeProblem(request({ milestones: 0 })), /milestones/);
  assert.equal(shapeProblem(request({ milestones: 10 })), "");
  assert.match(shapeProblem(request({ milestones: 11 })), /milestones/);
  assert.match(shapeProblem(request({ workload: "   " })), /container image/);
});

const post = (over = {}) => ({ ...request(), gpu: "A100-80GB", maxPrice: 5n * GWEI, biddingHours: 24, ...over });

test("a complete open job is postable", () => {
  assert.equal(postProblem(post(), 2 * 86400), "");
});

test("an open job needs a GPU and a price", () => {
  assert.match(postProblem(post({ gpu: "" }), 86400), /GPU/);
  assert.match(postProblem(post({ maxPrice: 0n }), 86400), /per GPU hour/);
});

test("bidding period is bounded by the contract's maximum", () => {
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
