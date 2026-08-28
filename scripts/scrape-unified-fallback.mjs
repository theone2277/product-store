import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent } from "undici";
import {
  getAninekoStream,
  getAnidapStream,
  getXanimeStream,
  getAnizoneStream,
  getAnichanStream,
} from "../src/lib/multi-stream-extractors.ts";
import { getAnikotoStream } from "./stream-extractors/anikoto.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT_DIR, "backend", "cache");
const PROXY_FILE = path.join(ROOT_DIR, "src", "data", "working_proxies_pool.json");
const QUEUE_FILE = path.join(CACHE_DIR, "cloud_harvest_queue.json");
const UNIFIED_FILE = path.join(ROOT_DIR, "backend", "unified_anime_catalog.json");

const args = process.argv.slice(2);
let shardArg = 0;
let totalShards = 16;
let concurrency = 16;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--shard" && args[i + 1] !== undefined) {
    shardArg = parseInt(args[i + 1], 10);
  }
  if (args[i] === "--total-shards" && args[i + 1] !== undefined) {
    totalShards = parseInt(args[i + 1], 10);
  }
  if (args[i] === "--concurrency" && args[i + 1] !== undefined) {
    concurrency = parseInt(args[i + 1], 10);
  }
}

const SHARD_OUTPUT = path.join(CACHE_DIR, `scraped_streams_shard_${shardArg}.json`);
const SHARD_DEAD = path.join(CACHE_DIR, `unrecoverable_shard_${shardArg}.json`);

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let proxyList = [];
if (fs.existsSync(PROXY_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(PROXY_FILE, "utf8"));
    proxyList = raw.map(p => p.url || `http://${p.ip_address}:${p.port}`);
  } catch (_) {}
}

console.log(`[Shard ${shardArg}/${totalShards}] 🌐 Loaded ${proxyList.length} verified proxies.`);

class RateLimitedProxy {
  constructor(url) {
    this.url = url;
    this.agent = new ProxyAgent(url);
    this.requestTimestamps = [];
    this.failures = 0;
    this.quarantinedUntil = 0;
  }

  isAvailable() {
    const now = Date.now();
    if (this.quarantinedUntil > now) return false;
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 120000);
    return this.requestTimestamps.length < 50;
  }

  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  quarantine(ms = 60000) {
    this.failures++;
    this.quarantinedUntil = Date.now() + ms;
  }
}

const proxies = proxyList.map(url => new RateLimitedProxy(url));
let proxyIdx = shardArg * 50;

async function getAvailableProxy() {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    for (let i = 0; i < proxies.length; i++) {
      const p = proxies[(proxyIdx + i) % proxies.length];
      if (p.isAvailable()) {
        proxyIdx = (proxyIdx + i + 1) % proxies.length;
        p.recordRequest();
        return p;
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

const unified = JSON.parse(fs.readFileSync(UNIFIED_FILE, "utf8"));
const animeMetadata = new Map();
for (const a of unified) {
  const slug = a.slug || `anime-${a.id}`;
  animeMetadata.set(slug.toLowerCase(), a);
  if (a.providers?.anikoto?.id) {
    animeMetadata.set(a.providers.anikoto.id.toLowerCase(), a);
  }
  if (a.providers?.anikoto?.sourceSlug) {
    animeMetadata.set(a.providers.anikoto.sourceSlug.toLowerCase(), a);
  }
}

const fullQueue = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")) : [];
const myQueue = fullQueue.filter((_, idx) => idx % totalShards === shardArg);

console.log("================================================================");
console.log(`🚀 RUNNING CLOUD HARVESTER SHARD ${shardArg}/${totalShards}`);
console.log(`📋 Total Partition Queue: ${myQueue.length.toLocaleString()} tasks`);
console.log(`📡 Concurrency: ${concurrency} | Proxy Pool: ${proxies.length} proxies`);
console.log("================================================================\n");

const animeDeadProviders = new Map();

function withTimeout(promise, ms = 1500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMED_OUT")), ms))
  ]);
}

async function probeAllProviders(task) {
  const anilistId = task.aniId || task.malId;
  const cleanSlug = task.slug.replace(/-ak\d+$/, "").replace(/^ak\d+-?/, "");
  const isDub = task.type === "dub";

  if (!animeDeadProviders.has(task.slug)) {
    animeDeadProviders.set(task.slug, new Set());
  }
  const deadSet = animeDeadProviders.get(task.slug);

  const animeInfo = animeMetadata.get(task.slug.toLowerCase()) || animeMetadata.get(cleanSlug.toLowerCase());
  const anikotoSourceSlug = animeInfo?.providers?.anikoto?.sourceSlug;

  const candidateProviders = [];

  if (!deadSet.has("anikoto_direct") && anikotoSourceSlug) {
    candidateProviders.push({
      name: "anikoto_direct",
      fn: () => withTimeout(getAnikotoStream(`https://anikoto.net/watch/${anikotoSourceSlug}/ep-${task.ep}`, task.ep), 2500)
    });
  }

  if (!deadSet.has("anineko") && cleanSlug) {
    candidateProviders.push({
      name: "anineko",
      fn: () => withTimeout(getAninekoStream(cleanSlug, task.ep), 1500)
    });
  }

  if (!deadSet.has("anidap") && anilistId) {
    candidateProviders.push({
      name: "anidap",
      fn: () => withTimeout(getAnidapStream(anilistId, task.ep, { dub: isDub }), 1500)
    });
  }

  if (!deadSet.has("xanime") && cleanSlug) {
    candidateProviders.push({
      name: "xanime",
      fn: () => withTimeout(getXanimeStream(cleanSlug, task.ep, task.ep), 1500)
    });
  }

  if (!deadSet.has("anizone") && (anilistId || cleanSlug)) {
    candidateProviders.push({
      name: "anizone",
      fn: () => withTimeout(getAnizoneStream(anilistId || cleanSlug, task.ep), 1500)
    });
  }

  if (!deadSet.has("anichan") && anilistId) {
    candidateProviders.push({
      name: "anichan",
      fn: () => withTimeout(getAnichanStream(anilistId, task.ep, { dub: isDub }), 1500)
    });
  }

  for (const p of candidateProviders) {
    try {
      const result = await p.fn();
      if (result && (result.url || result.m3u8)) {
        return {
          provider: p.name,
          m3u8: result.url || result.m3u8,
          vtt: result.vtt || null,
          headers: result.headers || null
        };
      }
    } catch (err) {
      if (task.ep <= 2) {
        deadSet.add(p.name);
      }
    }
  }

  return null;
}

let shardDb = {};
let shardDead = new Set();
let processed = 0;
let succeeded = 0;

async function worker() {
  while (myQueue.length > 0) {
    const task = myQueue.shift();
    if (!task) break;

    const t0 = performance.now();
    const key = `${task.slug}_${task.ep}_${task.type || 'sub'}`;

    try {
      const result = await probeAllProviders(task);
      const t1 = performance.now();
      processed++;

      if (result?.m3u8) {
        succeeded++;
        shardDb[key] = {
          m3u8: result.m3u8,
          vtt: result.vtt,
          provider: result.provider,
          headers: result.headers,
          scrapedAt: Math.floor(Date.now() / 1000)
        };
        console.log(`[${processed}/${myQueue.length + processed}] ✅ [${result.provider.toUpperCase()}] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep} (${(t1 - t0).toFixed(0)}ms)`);
      } else {
        shardDead.add(key);
        console.log(`[${processed}/${myQueue.length + processed}] ❌ [MISSING] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep}`);
      }
    } catch (err) {
      processed++;
      shardDead.add(key);
      console.log(`[${processed}/${myQueue.length + processed}] ❌ [ERROR] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep}`);
    }

    if (processed % 20 === 0) {
      fs.writeFileSync(SHARD_OUTPUT, JSON.stringify(shardDb, null, 2));
      fs.writeFileSync(SHARD_DEAD, JSON.stringify(Array.from(shardDead), null, 2));
    }

    await new Promise(r => setTimeout(r, 20));
  }
}

const workers = Array.from({ length: concurrency }, () => worker());
await Promise.all(workers);

fs.writeFileSync(SHARD_OUTPUT, JSON.stringify(shardDb, null, 2));
fs.writeFileSync(SHARD_DEAD, JSON.stringify(Array.from(shardDead), null, 2));

console.log("\n================================================================");
console.log(`🎉 SHARD ${shardArg} COMPLETE!`);
console.log(`• Processed: ${processed.toLocaleString()}`);
console.log(`• Recovered: ${succeeded.toLocaleString()}`);
console.log(`• Saved To:  ${SHARD_OUTPUT}`);
console.log("================================================================\n");
