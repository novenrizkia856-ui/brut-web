// Write environment variables into config/solana.js.
//
//   node tools/write-config.mjs            reads the process environment
//   node tools/write-config.mjs .env       reads a dotenv file first
//
// The site has no bundler, so the browser cannot read environment variables.
// This copies them into the one plain config script instead. Only variables
// that are set are written; every other value in the file stays as it is.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicKey } from "../js/codec.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "config", "solana.js");

const env = { ...process.env };
const file = process.argv[2] && resolve(process.argv[2]);
if (file) {
  if (!existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

/* Environment variable, config field, and what a valid value looks like. */
const FIELDS = [
  ["SOLANA_NETWORK", "network", (v) => ["mainnet-beta", "devnet", "testnet"].includes(v)],
  ["SOLANA_RPC_URL", "rpcUrl", (v) => /^https?:\/\//.test(v)],
  ["EXPLORER_BASE_URL", "explorerUrl", (v) => /^https?:\/\//.test(v)],
  ["BRUT_PROGRAM_ID", "programId", (v) => v === "" || isPublicKey(v)],
  ["BRUT_TOKEN_MINT", "tokenMint", (v) => v === "" || isPublicKey(v)],
  ["TREASURY_ADDRESS", "treasuryAddress", (v) => v === "" || isPublicKey(v)],
];

let config = readFileSync(target, "utf8");
const changed = [];
for (const [name, field, valid] of FIELDS) {
  if (!(name in env)) continue;
  const value = String(env[name]).trim();
  if (!valid(value)) {
    console.error(`${name} is not a valid ${field}: "${value}"`);
    process.exit(1);
  }
  const pattern = new RegExp(`(\\n\\s*${field}: )[^,\\n]*,`);
  if (!pattern.test(config)) throw new Error(`config/solana.js has no ${field} field`);
  config = config.replace(pattern, `$1${JSON.stringify(value)},`);
  changed.push(`  ${field} = ${value || "(empty)"}`);
}
writeFileSync(target, config);

console.log(changed.length ? `config/solana.js updated:\n${changed.join("\n")}` : "No Solana variables set; config/solana.js unchanged.");
