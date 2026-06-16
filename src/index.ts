export {
  createClient,
  search,
  scrape,
  rank,
  type NextClientOptions,
  type RequestOptions,
} from "./client.js";
export {
  searchTag,
  scrapeTag,
  rankTag,
  SERPCHEAP_TAG,
  DEFAULT_REVALIDATE,
  type CacheOptions,
} from "./cache.js";
export { VERSION } from "./version.js";

export { SerpCheapError } from "@serpcheap/sdk";
export type {
  SearchParams,
  SearchResponse,
  ScrapeParams,
  ScrapeResponse,
  RankParams,
  RankResponse,
  OrganicResult,
  KnowledgeGraph,
  Country,
  Tbs,
} from "@serpcheap/sdk";
