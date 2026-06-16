import type { RankParams, ScrapeParams, SearchParams } from "@serpcheap/sdk";

/** Root cache tag applied to every serp.cheap request. */
export const SERPCHEAP_TAG = "serpcheap";

/** Default ISR window in seconds (1h). Override per call with `{ revalidate }`. */
export const DEFAULT_REVALIDATE = 3600;

export type Kind = "search" | "scrape" | "rank";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined && v !== "") out[key] = canonicalize(v);
  }
  return out;
}

/** FNV-1a — a tiny, sync, edge-safe hash (no crypto import). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Canonical param shape so equivalent queries share one cache key/tag. */
function normalize(kind: Kind, params: SearchParams | ScrapeParams | RankParams): Record<string, unknown> {
  if (kind === "search") {
    const p = params as SearchParams;
    return { q: p.q, gl: p.gl ?? "us", hl: p.hl, tbs: p.tbs, page: p.page ?? 1, scrape: p.scrape };
  }
  if (kind === "rank") {
    const p = params as RankParams;
    return {
      url: p.url,
      q: p.q,
      gl: p.gl ?? "us",
      hl: p.hl,
      tbs: p.tbs,
      pages: p.pages ?? 1,
      match_type: p.match_type ?? "domain",
    };
  }
  const p = params as ScrapeParams;
  return {
    url: p.url,
    render_js: p.render_js,
    screenshot: p.screenshot,
    wait_for: p.wait_for,
    wait_ms: p.wait_ms,
    screenshot_width: p.screenshot_width,
    screenshot_height: p.screenshot_height,
  };
}

/** Exact, collision-free cache key part (canonical JSON of the normalized params). */
export function cacheKey(kind: Kind, params: SearchParams | ScrapeParams | RankParams): string {
  return JSON.stringify(canonicalize(normalize(kind, params)));
}

function tag(kind: Kind, params: SearchParams | ScrapeParams | RankParams): string {
  return `${SERPCHEAP_TAG}:${kind}:${fnv1a(cacheKey(kind, params))}`;
}

/** Deterministic cache tag for a search — same query (any key order) → same tag.
 *  Pass it to Next's `revalidateTag()` to refresh exactly this query. */
export function searchTag(params: SearchParams): string {
  return tag("search", params);
}

/** Deterministic cache tag for a scrape. */
export function scrapeTag(params: ScrapeParams): string {
  return tag("scrape", params);
}

/** Deterministic cache tag for a rank query. */
export function rankTag(params: RankParams): string {
  return tag("rank", params);
}

/** Tag set attached to a cached entry: root, kind, and the per-query tag. */
export function tagsFor(kind: Kind, params: SearchParams | ScrapeParams | RankParams): string[] {
  return [SERPCHEAP_TAG, `${SERPCHEAP_TAG}:${kind}`, tag(kind, params)];
}

/** Per-call cache controls. */
export interface CacheOptions {
  /** ISR window in seconds, or `false` to cache indefinitely. Default {@link DEFAULT_REVALIDATE}. */
  revalidate?: number | false;
  /** Extra tags merged with the automatic per-query tags. */
  tags?: string[];
  /** Set `false` to bypass the cache and always fetch fresh. Default `true`. */
  cache?: boolean;
}
