// Copy a deployment's addresses and start block into config/contracts.js.
//
//   node tools/sync-contracts.mjs                     reads ../brut-contracts/deployments/4663.json
//   node tools/sync-contracts.mjs path/to/<chainId>.json
//
// Only marketAddress, registryAddress, deployBlock and chainId are touched; every other
// value in the config stays as it is.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] || join(root, "..", "brut-contracts", "deployments", "4663.json"));
const target = join(root, "config", "contracts.js");

const deployment = JSON.parse(readFileSync(source, "utf8"));
const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v));
if (!isAddress(deployment.ComputeMarketplace) || !isAddress(deployment.ProviderRegistry)) {
  console.error(`No contract addresses in ${source}`);
  process.exit(1);
}

let config = readFileSync(target, "utf8");
const set = (key, value) => {
  const pattern = new RegExp(`(\\n\\s*${key}: )[^,\\n]*,`);
  if (!pattern.test(config)) throw new Error(`config/contracts.js has no ${key} field`);
  config = config.replace(pattern, `$1${value},`);
};
set("chainId", Number(deployment.chainId));
set("marketAddress", JSON.stringify(deployment.ComputeMarketplace));
set("registryAddress", JSON.stringify(deployment.ProviderRegistry));
set("deployBlock", Number(deployment.deployBlock) || 0);
writeFileSync(target, config);

console.log(`config/contracts.js now points at chain ${deployment.chainId}:`);
console.log(`  ComputeMarketplace ${deployment.ComputeMarketplace}`);
console.log(`  ProviderRegistry   ${deployment.ProviderRegistry}`);
