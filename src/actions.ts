"use server";

import type { RankParams, RankResponse, ScrapeParams, ScrapeResponse, SearchParams, SearchResponse } from "@serpcheap/sdk";

import type { CacheOptions } from "./cache.js";
import { rank, scrape, search } from "./client.js";

// Actions take only CacheOptions (serializable, safe) — never the API key.

/** Server Action: callable directly from Client Components / forms. */
export async function searchAction(params: SearchParams, cache?: CacheOptions): Promise<SearchResponse> {
  return search(params, cache);
}

/** Server Action for scraping a page. */
export async function scrapeAction(params: ScrapeParams, cache?: CacheOptions): Promise<ScrapeResponse> {
  return scrape(params, cache);
}

/** Server Action for rank tracking. */
export async function rankAction(params: RankParams, cache?: CacheOptions): Promise<RankResponse> {
  return rank(params, cache);
}
