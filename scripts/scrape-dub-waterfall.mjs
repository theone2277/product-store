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
const QUEUE_FILE = path.join(CACHE_DIR, "dub_harvest_queue.json");
const UNIFIED_FILE = path.join(ROOT_DIR, "backend", "unified_anime_catalog.json");

// Parse args for matrix execution
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

const SHARD_OUTPUT = path.join(CACHE_DIR, `scraped_dubs_shard_${shardArg}.json`);
const SHARD_DEAD = path.join(CACHE_DIR, `unrecoverable_dubs_shard_${shardArg}.json`);

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 1. Load Proxies with Token Bucket (max 50 reqs / 120s per IP)
let proxyList = [];
if (fs.existsSync(PROXY_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(PROXY_FILE, "utf8"));
    proxyList = raw.map(p => p.url || `http://${p.ip_address}:${p.port}`);
  } catch (_) {}
}

console.log(`[Dub Shard ${shardArg}/${totalShards}] 🌐 Loaded ${proxyList.length} verified proxies.`);

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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

// 2. Build Fast Lookup Maps
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

// 3. Partition Queue for this Shard
const fullQueue = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")) : [];
const myQueue = fullQueue.filter((_, idx) => idx % totalShards === shardArg);

console.log("================================================================");
console.log(`🎙️ RUNNING CLOUD DUB HARVESTER SHARD ${shardArg}/${totalShards}`);
console.log(`📋 Total Partition Queue: ${myQueue.length.toLocaleString()} dub tasks`);
console.log(`📡 Concurrency: ${concurrency} | Proxy Pool: ${proxies.length} proxies`);
console.log("================================================================\n");

const animeDeadProviders = new Map();

function withTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMED_OUT")), ms))
  ]);
}

// Megaplay Direct Stream Extractor
async function fetchMegaplayEmbed(streamUrl, proxy) {
  const fetchOpts = {
    headers: {
      "User-Agent": UA,
      "Referer": "https://anikoto.net/",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(3500)
  };
  if (proxy?.agent) fetchOpts.dispatcher = proxy.agent;

  const res = await fetch(streamUrl, fetchOpts);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const html = await res.text();

  const fileIdMatch = html.match(/File\s+(\d+)\s+-\s+MegaPlay/i) || html.match(/\/file\/(\d+)/i) || html.match(/file_id\s*=\s*["']?(\d+)/i);
  if (!fileIdMatch) throw new Error("NO_FILE_ID");

  const fileId = fileIdMatch[1];
  const m3u8 = `https://cdn.kryntal.top/anime/${fileId}/master.m3u8`;

  // Extract subtitles if present
  let vtt = null;
  const vttMatch = html.match(/https?:\/\/[^\s"']+\.vtt/i);
  if (vttMatch) vtt = vttMatch[0];

  return { m3u8, vtt, provider: "megaplay" };
}

async function probeDubWaterfall(task, proxy) {
  const anilistId = task.aniId || task.malId;
  const malId = task.malId;
  const cleanSlug = task.slug.replace(/-ak\d+$/, "").replace(/^ak\d+-?/, "");

  if (!animeDeadProviders.has(task.slug)) {
    animeDeadProviders.set(task.slug, new Set());
  }
  const deadSet = animeDeadProviders.get(task.slug);

  const animeInfo = animeMetadata.get(task.slug.toLowerCase()) || animeMetadata.get(cleanSlug.toLowerCase());
  const akId = task.akId || animeInfo?.providers?.anikoto?.sourceId;
  const anikotoSourceSlug = animeInfo?.providers?.anikoto?.sourceSlug;

  // ─── TIER 1: MEGAPLAY DUB CASCADE (MAL -> ANILIST -> ANIKOTO DIRECT) ───
  if (!deadSet.has("megaplay")) {
    const megaplayUrls = [];
    if (malId) megaplayUrls.push(`https://megaplay.buzz/stream/mal/${malId}/${task.ep}/dub?autostart=true`);
    if (anilistId) megaplayUrls.push(`https://megaplay.buzz/stream/ani/${anilistId}/${task.ep}/dub?autostart=true`);
    if (akId) megaplayUrls.push(`https://megaplay.buzz/stream/s-2/${akId}/dub?autostart=true`);

    for (const url of megaplayUrls) {
      try {
        const result = await fetchMegaplayEmbed(url, proxy);
        if (result?.m3u8) return result;
      } catch (_) {}
    }

    if (task.ep <= 2) deadSet.add("megaplay");
  }

  // ─── TIER 2: ANIDAP DUB ───
  if (!deadSet.has("anidap") && anilistId) {
    try {
      const res = await withTimeout(getAnidapStream(anilistId, task.ep, { dub: true }), 1500);
      if (res?.url || res?.m3u8) {
        return {
          provider: "anidap",
          m3u8: res.url || res.m3u8,
          vtt: res.vtt || null,
          headers: res.headers || null
        };
      }
    } catch (_) {
      if (task.ep <= 2) deadSet.add("anidap");
    }
  }

  // ─── TIER 3: ANICHAN DUB ───
  if (!deadSet.has("anichan") && anilistId) {
    try {
      const res = await withTimeout(getAnichanStream(anilistId, task.ep, { dub: true }), 1500);
      if (res?.url || res?.m3u8) {
        return {
          provider: "anichan",
          m3u8: res.url || res.m3u8,
          vtt: res.vtt || null,
          headers: res.headers || null
        };
      }
    } catch (_) {
      if (task.ep <= 2) deadSet.add("anichan");
    }
  }

  // ─── TIER 4: XANIME DUB ───
  if (!deadSet.has("xanime") && cleanSlug) {
    try {
      const res = await withTimeout(getXanimeStream(cleanSlug, task.ep, task.ep), 1500);
      if (res?.url || res?.m3u8) {
        return {
          provider: "xanime",
          m3u8: res.url || res.m3u8,
          vtt: res.vtt || null,
          headers: res.headers || null
        };
      }
    } catch (_) {
      if (task.ep <= 2) deadSet.add("xanime");
    }
  }

  // ─── TIER 5: ANINEKO DUB ───
  if (!deadSet.has("anineko") && cleanSlug) {
    try {
      const res = await withTimeout(getAninekoStream(cleanSlug, task.ep), 1500);
      if (res?.url || res?.m3u8) {
        return {
          provider: "anineko",
          m3u8: res.url || res.m3u8,
          vtt: res.vtt || null,
          headers: res.headers || null
        };
      }
    } catch (_) {
      if (task.ep <= 2) deadSet.add("anineko");
    }
  }

  // ─── TIER 6: ANIKOTO DIRECT (AKIRAX) ───
  if (!deadSet.has("anikoto_direct") && anikotoSourceSlug) {
    try {
      const res = await withTimeout(getAnikotoStream(`https://anikoto.net/watch/${anikotoSourceSlug}/ep-${task.ep}`, task.ep), 2500);
      if (res?.url || res?.m3u8) {
        return {
          provider: "anikoto_direct",
          m3u8: res.url || res.m3u8,
          vtt: res.vtt || null,
          headers: res.headers || null
        };
      }
    } catch (_) {
      if (task.ep <= 2) deadSet.add("anikoto_direct");
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

    const proxy = await getAvailableProxy();
    const t0 = performance.now();
    const key = `${task.slug}_${task.ep}_dub`;

    try {
      const result = await probeDubWaterfall(task, proxy);
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
        console.log(`[${processed}/${myQueue.length + processed}] ✅ [DUB - ${result.provider.toUpperCase()}] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep} (${(t1 - t0).toFixed(0)}ms)`);
      } else {
        shardDead.add(key);
        console.log(`[${processed}/${myQueue.length + processed}] ❌ [DUB MISSING] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep}`);
      }
    } catch (err) {
      processed++;
      shardDead.add(key);
      console.log(`[${processed}/${myQueue.length + processed}] ❌ [DUB ERROR] ${task.title?.slice(0, 25) || task.slug} Ep ${task.ep}`);
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
console.log(`🎉 DUB SHARD ${shardArg} COMPLETE!`);
console.log(`• Processed: ${processed.toLocaleString()}`);
console.log(`• Recovered: ${succeeded.toLocaleString()}`);
console.log(`• Saved To:  ${SHARD_OUTPUT}`);
console.log("================================================================\n");
