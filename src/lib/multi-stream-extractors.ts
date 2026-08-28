export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface StreamResult {
  url: string;
  headers?: Record<string, string>;
  source: "anidap" | "xanime" | "anizone" | "anichan" | "anineko" | "megaplay";
  quality?: string;
  vtt?: string | null;
}

/**
 * 1. AniDap (anidap.lol)
 */
export async function getAnidapStream(
  anilistId: string | number,
  ep: number,
  opts: { dub?: boolean; providerId?: string } = {}
): Promise<StreamResult> {
  const category = opts.dub ? "dub" : "sub";
  const providerId = opts.providerId ?? "kiwi";

  const page = await fetch(`https://anidap.lol/watch?id=${anilistId}&ep=${ep}`, {
    headers: { "User-Agent": UA },
  });
  if (!page.ok) throw new Error(`anidap watch page HTTP ${page.status}`);
  const clean = (await page.text()).replace(/\\"/g, '"');
  const m = clean.match(new RegExp(`"id","([^"]+)","anilistId",\\s*${anilistId}`));
  if (!m) throw new Error(`anidap: slug not found for anilistId ${anilistId}`);
  const slug = m[1];

  const api = await fetch(
    `https://chad.anidap.lol/rest/api/sources?id=${slug}&epNum=${ep}&type=${category}&providerId=${providerId}`,
    { headers: { "User-Agent": UA, Origin: "https://anidap.lol" } }
  );
  if (!api.ok) throw new Error(`anidap sources API HTTP ${api.status}`);
  const json: any = await api.json();
  const src: any = json?.sources?.[0];
  if (!src?.url) throw new Error("anidap: no sources returned");
  const origin = json?.headers?.Origin ?? "https://animex.one";

  return { url: src.url, headers: { Origin: origin }, source: "anidap", quality: src.quality };
}

/**
 * 2. XAnime (xanime.me)
 */
export async function getXanimeStream(
  titleId: string | number,
  epId: string | number,
  ep: number
): Promise<StreamResult> {
  const url = `https://xanime.me/title/${titleId}/${epId}-episode-${ep}`;
  const page = await fetch(url, { headers: { "User-Agent": UA } });
  if (!page.ok) throw new Error(`xanime watch page HTTP ${page.status}`);
  const html = await page.text();
  const m = html.match(/https?:\/\/[^\s"'\\]+?\.m3u8[^\s"'\\]*/);
  if (!m) throw new Error("xanime: no m3u8 in HTML");
  return { url: m[0], source: "xanime" };
}

/**
 * 3. AniZone (anizone.to)
 */
export async function getAnizoneStream(animeId: string, ep: number): Promise<StreamResult> {
  const url = `https://anizone.to/anime/${animeId}/${ep}`;
  const page = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://anizone.to/" } });
  if (!page.ok) throw new Error(`anizone episode page HTTP ${page.status}`);
  const html = await page.text();
  const m = html.match(/https:[^\s"']*?master\.m3u8/);
  if (!m) throw new Error("anizone: no m3u8 in HTML");
  return { url: m[0].replace(/\\/g, ""), source: "anizone", headers: { Referer: "https://anizone.to/" } };
}

/**
 * 4. AniChan (anichan.net)
 */
export async function getAnichanStream(
  anilistId: string | number,
  ep: number,
  opts: { dub?: boolean } = {}
): Promise<StreamResult> {
  const category = opts.dub ? "dub" : "sub";
  const api = await fetch(
    `https://anichan.net/api/watch/servers?anilistId=${anilistId}&ep=${ep}&category=${category}`,
    { headers: { "User-Agent": UA } }
  );
  if (!api.ok) throw new Error(`anichan servers API HTTP ${api.status}`);
  const json: any = await api.json();
  const servers: any[] = json.servers ?? [];
  const entry =
    servers.find((s) => s.host === "anichan" || s.label?.includes("AniChan")) ??
    servers.find((s) => s.type === "hls" && s.stream);
  if (!entry?.stream) throw new Error("anichan: no hls stream in servers list");
  const url = entry.stream.startsWith("http") ? entry.stream : "https://anichan.net" + entry.stream;
  return { url, source: "anichan" };
}

/**
 * 5. AniNeko (anineko.to)
 */
export async function getAninekoStream(
  slug: string,
  ep: number
): Promise<StreamResult> {
  const url = `https://anineko.to/watch/${slug}/ep-${ep}`;
  const page = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://anineko.to/" } });
  if (!page.ok) throw new Error(`anineko watch page HTTP ${page.status}`);
  const html = await page.text();
  const embeds = [...html.matchAll(/data-video="([^"]+)"/g)].map((m) => m[1]);
  if (!embeds.length) throw new Error("anineko: no data-video embeds in page");

  for (const e of embeds) {
    const r = await fetch(e, { headers: { "User-Agent": UA, Referer: "https://anineko.to/" } });
    if (!r.ok) continue;
    const eh = await r.text();
    const found = [...eh.matchAll(/https?:\/\/[^"'\s)\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s)\\]*)?/gi)].map((x) => x[0]);
    const m3u8 = found.filter((u) => /\.m3u8/i.test(u));
    if (m3u8.length) {
      const master = m3u8.find((u) => /master\.m3u8/i.test(u)) ?? m3u8[0];
      return { url: master, source: "anineko", headers: { Referer: "https://anineko.to/" } };
    }
  }
  throw new Error("anineko: no m3u8 resolved from embeds");
}
