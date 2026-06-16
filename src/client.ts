import "server-only";

import {
  SerpCheap,
  type ClientOptions,
  type RankParams,
  type RankResponse,
  type ScrapeParams,
  type ScrapeResponse,
  type SearchParams,
  type SearchResponse,
} from "@serpcheap/sdk";

import { cacheKey, type CacheOptions, DEFAULT_REVALIDATE, type Kind, tagsFor } from "./cache.js";

export interface NextClientOptions extends Omit<ClientOptions, "fetch"> {
  /** API key. Defaults to `process.env.SERPCHEAP_API_KEY`. */
  apiKey?: string;
}

/** Combined per-call options: cache controls + client overrides. */
export type RequestOptions = CacheOptions & NextClientOptions;

function resolveKey(apiKey?: string): string {
  const key = apiKey ?? process.env.SERPCHEAP_API_KEY;
  if (!key) {
    throw new Error(
      "serp.cheap API key is missing. Set SERPCHEAP_API_KEY (server-side) or pass { apiKey }. Get one at https://app.serp.cheap.",
    );
  }
  return key;
}

/** Build a plain SerpCheap client (no caching). */
export function createClient(options: NextClientOptions = {}): SerpCheap {
  const { apiKey, ...rest } = options;
  return new SerpCheap(resolveKey(apiKey), rest);
}

type UnstableCache = <T>(fn: () => Promise<T>, keyParts: string[], options: { revalidate?: number | false; tags?: string[] }) => () => Promise<T>;

let cacheImpl: UnstableCache | undefined;

/** @internal Test seam — inject a fake `unstable_cache`. */
export function __setUnstableCache(impl: UnstableCache | undefined): void {
  cacheImpl = impl;
}

async function resolveUnstableCache(): Promise<UnstableCache> {
  if (cacheImpl) return cacheImpl;
  // @ts-expect-error -- "next/cache" is an optional peer dependency, resolved at runtime in a Next app.
  const mod = await import("next/cache");
  return mod.unstable_cache as UnstableCache;
}

async function withCache<T>(
  kind: Kind,
  params: SearchParams | ScrapeParams | RankParams,
  opts: RequestOptions,
  run: () => Promise<T>,
): Promise<T> {
  if (opts.cache === false) return run();
  const uc = await resolveUnstableCache();
  const cached = uc(run, [kind, cacheKey(kind, params)], {
    revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
    tags: [...tagsFor(kind, params), ...(opts.tags ?? [])],
  });
  return cached();
}

function clientOptionsOf(opts: RequestOptions): NextClientOptions {
  const { revalidate, tags, cache, ...rest } = opts;
  return rest;
}

/** Run a Google search from a Server Component / Action. Cached by default;
 *  invalidate exactly this query with `revalidateTag(searchTag(params))`. */
export function search(params: SearchParams, opts: RequestOptions = {}): Promise<SearchResponse> {
  return withCache("search", params, opts, () => createClient(clientOptionsOf(opts)).search(params));
}

/** Scrape a page from a Server Component / Action. Cached by default. */
export function scrape(params: ScrapeParams, opts: RequestOptions = {}): Promise<ScrapeResponse> {
  return withCache("scrape", params, opts, () => createClient(clientOptionsOf(opts)).scrape(params));
}

/** Rank a domain/url from a Server Component / Action. Cached by default. */
export function rank(params: RankParams, opts: RequestOptions = {}): Promise<RankResponse> {
  return withCache("rank", params, opts, () => createClient(clientOptionsOf(opts)).rank(params));
}
