// Shared types + constants for the standalone (Bun) stream extractors.
// Every extractor returns a StreamResult: the master.m3u8 URL plus any
// headers a client/proxy must send when fetching the playlist + segments.

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface StreamResult {
  /** master.m3u8 (or a chosen variant) URL */
  url: string;
  /** headers a client/proxy must send to fetch the playlist + segments */
  headers?: Record<string, string>;
  /** human-readable source label */
  source?: string;
  /** quality label if a variant was selected */
  quality?: string;
}
