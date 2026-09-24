/**
 * Encodings the app needs for Solana, without a library.
 *
 * Pure, so the page and the tests in test/ share the same code:
 *   base58   public keys and mint addresses, 32 bytes each
 *   sha256   the digest a listing or job would commit to instead of plain text
 *   units    lamports and token base units as BigInt, formatted and parsed
 */

/* --------------------------------------------------------------- base58 -- */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Bytes of a base58 string, or null when it is not base58. */
export function base58Decode(text) {
  const value = String(text || "");
  if (!value) return null;
  const bytes = [];
  for (const char of value) {
    const digit = INDEX.get(char);
    if (digit === undefined) return null;
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  /* Each leading "1" is a leading zero byte. */
  for (let i = 0; i < value.length && value[i] === "1"; i += 1) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

/** True for a 32 byte base58 key: a wallet, a program id or a token mint. */
export function isPublicKey(text) {
  const value = String(text || "").trim();
  if (value.length < 32 || value.length > 44) return false;
  const bytes = base58Decode(value);
  return Boolean(bytes && bytes.length === 32);
}

/* --------------------------------------------------------------- sha256 -- */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 of a UTF-8 string, as 64 lowercase hex characters. */
export function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const length = data.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(data);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded.length - 4, (length << 3) >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/* ---------------------------------------------------------------- units -- */

export const SOL_DECIMALS = 9;

/**
 * A base unit amount as a decimal string with at most `digits` decimals,
 * trailing zeros trimmed and thousands grouped. A positive amount too small
 * to show reads as "<0.000001" rather than "0".
 */
export function formatUnits(amount, decimals, digits = 6) {
  const value = BigInt(amount || 0);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = decimals ? (value % scale).toString().padStart(decimals, "0") : "";
  const cut = fraction.slice(0, digits).replace(/0+$/, "");
  if (whole === 0n && !cut && value > 0n) return `<0.${"0".repeat(Math.max(0, digits - 1))}1`;
  return whole.toLocaleString("en-US") + (cut ? `.${cut}` : "");
}

/** Lamports as SOL. */
export const sol = (lamports, digits = 6) => formatUnits(lamports, SOL_DECIMALS, digits);

/** A typed SOL amount in lamports, or null when it is not a valid amount. */
export function parseSol(text) {
  const value = String(text || "").trim().replace(/\.$/, "");
  if (!/^\d*\.?\d+$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > SOL_DECIMALS) return null;
  return BigInt(whole || "0") * 10n ** BigInt(SOL_DECIMALS) + BigInt(fraction.padEnd(SOL_DECIMALS, "0") || "0");
}
