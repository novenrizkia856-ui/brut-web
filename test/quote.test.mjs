/**
 * Pricing and funding rules.
 *
 * These decide how much escrow locks and whether the Fund button works, so
 * they are the part of the app worth pinning down. Run with `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { price, blocker } from "../js/quote.js";

const PROVIDER = { id: "4821", gpu: "A100", free: 8, rate: 1.85 };

const request = (over = {}) => ({
  gpu: "A100",
  count: 4,
  hours: 6,
  image: "ghcr.io/example/trainer:v3",
  budget: 60,
  ...over,
});

test("price multiplies GPUs by hours by rate", () => {
  const q = price(request(), PROVIDER);
  assert.equal(q.gpuHours, 24);
  assert.equal(q.rate, 1.85);
  assert.equal(q.total, 44.4);
});

test("price rounds to the cent it displays", () => {
  const q = price(request({ count: 3, hours: 7 }), { ...PROVIDER, rate: 0.333 });
  assert.equal(q.gpuHours, 21);
  assert.equal(q.total, 6.99);
});

test("price still reports GPU hours with no provider picked", () => {
  const q = price(request(), null);
  assert.equal(q.gpuHours, 24);
  assert.equal(q.rate, 0);
  assert.equal(q.total, 0);
});

test("price floors junk input at one rather than zero or NaN", () => {
  const q = price(request({ count: 0, hours: "abc" }), PROVIDER);
  assert.equal(q.count, 1);
  assert.equal(q.hours, 1);
  assert.equal(q.gpuHours, 1);
});

test("a complete request against a free provider funds", () => {
  assert.equal(blocker(request(), PROVIDER), "");
});

test("no provider blocks first, whatever else is wrong", () => {
  assert.equal(blocker(request({ image: "" }), null), "Select a provider before funding.");
});

test("a provider that does not offer the GPU blocks", () => {
  assert.match(blocker(request({ gpu: "H100" }), PROVIDER), /does not offer that GPU/);
});

test("asking for more GPUs than are free blocks", () => {
  assert.equal(blocker(request({ count: 9 }), PROVIDER), "Provider 4821 has 8 free.");
});

test("a missing workload reference blocks", () => {
  assert.match(blocker(request({ image: "   " }), PROVIDER), /container image or script/);
});

test("a total over the budget blocks and names the total", () => {
  assert.equal(
    blocker(request({ budget: 40 }), PROVIDER),
    "The job costs $44.40, over your limit."
  );
});

test("a total exactly on the budget is allowed", () => {
  assert.equal(blocker(request({ budget: 44.4 }), PROVIDER), "");
});

test("a provider with nothing free blocks even for one GPU", () => {
  const full = { ...PROVIDER, free: 0 };
  assert.equal(blocker(request({ count: 1 }), full), "Provider 4821 has 0 free.");
});
