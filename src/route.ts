import "server-only";

import { SerpCheapError, type RankParams, type ScrapeParams, type SearchParams } from "@serpcheap/sdk";

import { rank, type RequestOptions, scrape, search } from "./client.js";

export type RouteOptions = RequestOptions;

/** Route handlers proxy fresh by default — caching a response shared across
 *  callers (which includes your account's credit balance) is opt-in. Passing
 *  any of `cache: true` / `revalidate` / `tags` enables it. */
function routeOptionsOf(o: RouteOptions): RequestOptions {
  const optedIn = o.cache === true || o.revalidate !== undefined || o.tags !== undefined;
  return optedIn ? o : { ...o, cache: false };
}

function errorResponse(err: unknown): Response {
  if (err instanceof SerpCheapError) {
    return Response.json({ error: err.code, message: err.message }, { status: err.status ?? 502 });
  }
  return Response.json({ error: "internal", message: "Unexpected error." }, { status: 500 });
}

function handler<T>(run: (body: T) => Promise<unknown>): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_request", message: "Request body must be JSON." }, { status: 400 });
    }
    try {
      return Response.json(await run(body as T));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** App Router POST handler proxying to /v1/search — the API key stays server-side.
 *  Uncached by default; opt in with `{ revalidate }` or `{ cache: true }`. */
export function createSearchHandler(options: RouteOptions = {}): (req: Request) => Promise<Response> {
  return handler<SearchParams>((body) => search(body, routeOptionsOf(options)));
}

/** App Router POST handler proxying to /v1/scrape. Uncached by default. */
export function createScrapeHandler(options: RouteOptions = {}): (req: Request) => Promise<Response> {
  return handler<ScrapeParams>((body) => scrape(body, routeOptionsOf(options)));
}

/** App Router POST handler proxying to /v1/rank. Uncached by default. */
export function createRankHandler(options: RouteOptions = {}): (req: Request) => Promise<Response> {
  return handler<RankParams>((body) => rank(body, routeOptionsOf(options)));
}
