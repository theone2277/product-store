import { UA, StreamResult } from "./types.ts";

/**
 * AniKoto (anikoto.net) — OPEN, no Cloudflare token needed (verified 2026-08-28).
 *
 * Qwik / Cloudflare Pages app. The stream itself is served by the
 * "megaplay / vidtube / akirax" cluster (rebranded from anichan.net).
 *
 * Chain (from a watch URL -> master.m3u8), all plain User-Agent requests:
 *   1. GET watch page                 -> anime id  (data-id on .watch)
 *   2. ajax/episode/list/<animeId>    -> ep-N <a data-ids="...">   (this IS the `servers` param)
 *   3. ajax/server/list?servers=<ids> -> <span data-link-id="..."> per server
 *   4. ajax/server?get=<linkId>       -> {url:"https://vidtube.site/stream/<id>/sub"}
 *   5. GET vidtube player page        -> data-id on the player element
 *   6. vidtube.site/stream/getSourcesNew?id=<id>&type=sub
 *                                       -> {sources:{file:".../master.m3u8"}}
 *
 * The episode number is read from the URL itself (.../ep-33 -> 33), exactly
 * like the site uses it to land on the right episode.
 *
 * IMPORTANT: the final CDN (akirax.buzz / shiora.site) requires
 *   Referer: https://vidtube.site/
 * but NO cf_clearance / cookie / decryption. Segments are MPEG-TS misnamed
 * as `.jpg` (e.g. .../1080p/0000.jpg) — use them directly in ffmpeg/VLC.
 *
 * INPUT: watch URL (ep read from URL). Output: StreamResult { url, headers }.
 */
async function json(url: string, ref: string): Promise<any> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: ref,
    },
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { status: r.status, raw: t }; }
}

function epFromUrl(url: string): number {
  const m = url.match(/ep-(\d+)/i);
  return m ? Number(m[1]) : 1;
}

export async function getAnikotoStream(
  watchUrl: string,
  ep?: number
): Promise<StreamResult> {
  ep = ep ?? epFromUrl(watchUrl);

  // 1. anime id
  const watchHtml = await (await fetch(watchUrl, { headers: { "User-Agent": UA } })).text();
  const animeId = (watchHtml.match(/data-id="([^"]+)"/) || [])[1];
  if (!animeId) throw new Error("anikoto: anime id not found on watch page");

  // 2. episode list -> data-ids for the episode (this is the `servers` param)
  const epJson: any = await json(`https://anikoto.net/ajax/episode/list/${animeId}`, watchUrl);
  const epHtml = epJson.result as string;
  const chunk = (epHtml.split(/<li /i) as string[]).find((x) =>
    new RegExp(`data-num=["']?${ep}["']?`, "i").test(x)
  ) || "";
  const servers = (chunk.match(/data-ids=["']([^"']+)["']/) || [])[1];
  if (!servers) throw new Error(`anikoto: data-ids not found for ep ${ep}`);

  // 3. server list -> data-link-id(s)
  const srvJson: any = await json(
    `https://anikoto.net/ajax/server/list?servers=${encodeURIComponent(servers)}`,
    watchUrl
  );
  const srvHtml = srvJson.result as string;
  const linkIds = [...srvHtml.matchAll(/data-link-id=["']([^"']+)["']/g)].map((x) => x[1]);
  if (!linkIds.length) throw new Error("anikoto: no server link-ids returned");

  // 4-6. try each server until one yields a master.m3u8
  for (const linkId of linkIds) {
    const srv2: any = await json(
      `https://anikoto.net/ajax/server?get=${encodeURIComponent(linkId)}`,
      watchUrl
    );
    const vidUrl: string = srv2?.result?.url || srv2?.url || "";
    if (!vidUrl) continue;
    const vtHtml = await (await fetch(vidUrl, { headers: { "User-Agent": UA } })).text();
    const vtId = (vtHtml.match(/data-id=["']([^"']+)["']/) || [])[1];
    if (!vtId) continue;
    const src: any = await json(
      `https://vidtube.site/stream/getSourcesNew?id=${encodeURIComponent(vtId)}&type=sub`,
      vidUrl
    );
    const m3u8: string =
      src?.sources?.file || src?.url || (Array.isArray(src?.sources) ? src.sources[0]?.file : "");
    if (!m3u8) continue;
    return {
      url: m3u8,
      headers: { Referer: "https://vidtube.site/", "User-Agent": UA },
      source: "anikoto",
    };
  }
  throw new Error("anikoto: no server produced a master.m3u8");
}

// CLI demo: bun anikoto.ts <watch_url>   (ep is read from the URL)
if (import.meta.main) {
  const url = Bun.argv.slice(2).find((a) => a.startsWith("http"));
  if (!url) {
    console.error("Usage: bun anikoto.ts <watch_url>   (ep is read from .../ep-N)");
    process.exit(1);
  }
  try {
    const res = await getAnikotoStream(url);
    console.log("\n=== MASTER M3U8 ===\n" + res.url);
    console.log("\nHeaders needed to fetch it:\n" + JSON.stringify(res.headers, null, 2));
  } catch (e) {
    console.error("FAILED:", (e as Error).message);
    process.exit(1);
  }
}
