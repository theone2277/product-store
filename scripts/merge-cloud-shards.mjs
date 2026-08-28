import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT_DIR, "backend", "cache");
const MASTER_OUTPUT = path.join(CACHE_DIR, "ALL_SHARDS_RECOVERED_MASTER.json");
const DEAD_OUTPUT = path.join(CACHE_DIR, "ALL_SHARDS_DEAD_MASTER.json");

const masterRecovered = {};
const masterDead = new Set();

const files = fs.readdirSync(CACHE_DIR);
let recoveredFiles = 0;
let deadFiles = 0;

for (const file of files) {
  if (file.startsWith("scraped_streams_shard_") && file.endsWith(".json")) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
      Object.assign(masterRecovered, data);
      recoveredFiles++;
    } catch (_) {}
  }
  if (file.startsWith("unrecoverable_shard_") && file.endsWith(".json")) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
      const arr = Array.isArray(data) ? data : Object.keys(data);
      for (const k of arr) masterDead.add(k);
      deadFiles++;
    } catch (_) {}
  }
}

fs.writeFileSync(MASTER_OUTPUT, JSON.stringify(masterRecovered, null, 2));
fs.writeFileSync(DEAD_OUTPUT, JSON.stringify(Array.from(masterDead), null, 2));

console.log("================================================================");
console.log(`🎉 ALL CLOUD SHARDS MERGED SUCCESSFULLY!`);
console.log(`• Shard Files Merged:    ${recoveredFiles}`);
console.log(`• Total Recovered Streams: ${Object.keys(masterRecovered).length.toLocaleString()}`);
console.log(`• Total Dead Verified:     ${masterDead.size.toLocaleString()}`);
console.log(`• Master File:             ${MASTER_OUTPUT}`);
console.log("================================================================\n");
