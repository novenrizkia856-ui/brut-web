/**
 * Solana encodings: base58 keys, SHA-256 digests and lamport amounts.
 * Run with `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { base58Decode, isPublicKey, sha256Hex, formatUnits, sol, parseSol } from "../js/codec.js";

/* Well known program ids, public and stable. */
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

test("base58 decodes leading ones as zero bytes", () => {
  assert.deepEqual([...base58Decode(SYSTEM_PROGRAM)], new Array(32).fill(0));
  assert.deepEqual([...base58Decode("1112")], [0, 0, 0, 1]);
});

test("base58 matches a known key", () => {
  const bytes = base58Decode(TOKEN_PROGRAM);
  assert.equal(bytes.length, 32);
  assert.equal(Buffer.from(bytes).toString("hex"), "06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9");
});

test("public keys are exactly 32 bytes of base58", () => {
  assert.ok(isPublicKey(SYSTEM_PROGRAM));
  assert.ok(isPublicKey(TOKEN_PROGRAM));
  assert.ok(!isPublicKey(""));
  assert.ok(!isPublicKey("0x9A3f27c1B4e0d8A7F5c26E1b0D34a9C8e7F10b25"));
  assert.ok(!isPublicKey(`${TOKEN_PROGRAM}1`));
  assert.ok(!isPublicKey(TOKEN_PROGRAM.replace("k", "l")));
});

test("sha256 agrees with node:crypto", () => {
  for (const text of ["", "abc", "A100-80GB", "ghcr.io/team/trainer:v3", "é".repeat(100), "x".repeat(1000)]) {
    assert.equal(sha256Hex(text), createHash("sha256").update(text, "utf8").digest("hex"), text.slice(0, 20));
  }
});

test("lamports format as SOL", () => {
  assert.equal(sol(0n), "0");
  assert.equal(sol(1_500_000_000n), "1.5");
  assert.equal(sol(1_234_567_890_000_000_000n), "1,234,567,890");
  assert.equal(sol(1n), "<0.000001");
  assert.equal(sol(1n, 9), "0.000000001");
  assert.equal(formatUnits(12345n, 2, 2), "123.45");
});

test("typed SOL parses to lamports, or null", () => {
  assert.equal(parseSol("1"), 1_000_000_000n);
  assert.equal(parseSol("0.002"), 2_000_000n);
  assert.equal(parseSol(".5"), 500_000_000n);
  assert.equal(parseSol("2."), 2_000_000_000n);
  assert.equal(parseSol("0.000000001"), 1n);
  assert.equal(parseSol("0.0000000001"), null);
  assert.equal(parseSol("abc"), null);
  assert.equal(parseSol("-1"), null);
  assert.equal(parseSol(""), null);
});
