import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createClient, search, scrape, rank, searchTag, scrapeTag, rankTag, SERPCHEAP_TAG, DEFAULT_REVALIDATE, SerpCheapError, type ScrapeParams } from "../src/index.js";
import { __setUnstableCache } from "../src/client.js";
import { cacheKey, tagsFor } from "../src/cache.js";
import { createSearchHandler, createScrapeHandler, createRankHandler } from "../src/route.js";
import { searchAction, scrapeAction, rankAction } from "../src/actions.js";
import { searchGolden, scrapeGolden, rankGolden, jsonResponse, installFetch, jsonRequest } from "./fixtures.js";

const KEY = "test-key";

interface CacheCall {
  keyParts: string[];
  options: { revalidate?: number | false; tags?: string[] };
}
let cacheCalls: CacheCall[] = [];

beforeEach(() => {
  process.env.SERPCHEAP_API_KEY = KEY;
  cacheCalls = [];
  // Pass-through fake: records the wrapping, runs the fn (no real caching).
  __setUnstableCache((fn, keyParts, options) => {
    cacheCalls.push({ keyParts, options });
    return fn;
  });
});
afterEach(() => {
  delete process.env.SERPCHEAP_API_KEY;
  __setUnstableCache(undefined);
});

// ---- cache tags / keys ----

test("searchTag normalizes defaults + falsy, ignores key order", () => {
  assert.equal(searchTag({ q: "x" }), searchTag({ q: "x", gl: "us", page: 1 }));
  assert.equal(searchTag({ q: "x", hl: "" }), searchTag({ q: "x" }));
  assert.equal(searchTag({ q: "x", gl: "br" }), searchTag({ gl: "br", q: "x" }));
  assert.notEqual(searchTag({ q: "x" }), searchTag({ q: "y" }));
  assert.match(searchTag({ q: "x" }), /^serpcheap:search:[0-9a-f]{8}$/);
});

test("scrapeTag mirrors the SDK whitelist (extra fields don't change the tag)", () => {
  assert.equal(scrapeTag({ url: "https://a" }), scrapeTag({ url: "https://a", top_n: 5 } as ScrapeParams));
  assert.notEqual(scrapeTag({ url: "https://a" }), scrapeTag({ url: "https://a", screenshot: true }));
});

test("rankTag normalizes its defaults", () => {
  assert.equal(rankTag({ url: "a", q: "x" }), rankTag({ url: "a", q: "x", gl: "us", pages: 1, match_type: "domain" }));
  assert.notEqual(rankTag({ url: "a", q: "x" }), rankTag({ url: "a", q: "x", pages: 2 }));
});

test("cacheKey is exact JSON and tagsFor returns root/kind/query", () => {
  assert.equal(cacheKey("search", { q: "x" }), cacheKey("search", { q: "x", gl: "us", page: 1 }));
  assert.deepEqual(tagsFor("search", { q: "x" }), [SERPCHEAP_TAG, "serpcheap:search", searchTag({ q: "x" })]);
});

// ---- client helpers ----

test("createClient throws when no key is available", () => {
  delete process.env.SERPCHEAP_API_KEY;
  assert.throws(() => createClient(), /API key is missing/);
});

test("search caches with the right key, tags, and default revalidate", async () => {
  const { calls, restore } = installFetch((url) => {
    assert.equal(url, "https://api.serp.cheap/v1/search");
    return jsonResponse(200, searchGolden);
  });
  try {
    const res = await search({ q: "best running shoes" });
    assert.equal(res.organic.length, 2);
    assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], KEY);
    assert.deepEqual(cacheCalls[0].keyParts, ["search", cacheKey("search", { q: "best running shoes" })]);
    assert.equal(cacheCalls[0].options.revalidate, DEFAULT_REVALIDATE);
    assert.deepEqual(cacheCalls[0].options.tags, tagsFor("search", { q: "best running shoes" }));
  } finally {
    restore();
  }
});

test("cache: false bypasses unstable_cache entirely", async () => {
  const { calls, restore } = installFetch(() => jsonResponse(200, searchGolden));
  try {
    await search({ q: "x" }, { cache: false });
    assert.equal(cacheCalls.length, 0);
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test("search honors revalidate + extra tags + explicit apiKey", async () => {
  delete process.env.SERPCHEAP_API_KEY;
  const { calls, restore } = installFetch(() => jsonResponse(200, searchGolden));
  try {
    await search({ q: "x" }, { revalidate: 60, tags: ["home"], apiKey: "explicit" });
    assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "explicit");
    assert.equal(cacheCalls[0].options.revalidate, 60);
    assert.ok(cacheCalls[0].options.tags?.includes("home"));
  } finally {
    restore();
  }
});

test("scrape and rank cache under their own keys", async () => {
  const { restore } = installFetch((url) => jsonResponse(200, url.endsWith("/scrape") ? scrapeGolden : rankGolden));
  try {
    await scrape({ url: "https://example.com" });
    await rank({ url: "a", q: "q" });
    assert.deepEqual(cacheCalls[0].keyParts, ["scrape", cacheKey("scrape", { url: "https://example.com" })]);
    assert.deepEqual(cacheCalls[1].options.tags, tagsFor("rank", { url: "a", q: "q" }));
  } finally {
    restore();
  }
});

// ---- Server Actions ----

test("server actions proxy to the helpers", async () => {
  const { restore } = installFetch((url) =>
    jsonResponse(200, url.endsWith("/scrape") ? scrapeGolden : url.endsWith("/rank") ? rankGolden : searchGolden),
  );
  try {
    assert.equal((await searchAction({ q: "x" })).organic.length, 2);
    assert.equal((await scrapeAction({ url: "https://example.com" })).url, "https://example.com");
    assert.equal((await rankAction({ url: "a", q: "q" }, { cache: false })).found, true);
  } finally {
    restore();
  }
});

// ---- route handlers (POST) ----

test("createSearchHandler returns the API JSON", async () => {
  const { restore } = installFetch(() => jsonResponse(200, searchGolden));
  try {
    const res = await createSearchHandler()(jsonRequest({ q: "best running shoes" }));
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { organic: unknown[] }).organic.length, 2);
  } finally {
    restore();
  }
});

test("scrape and rank handlers proxy too", async () => {
  const { restore } = installFetch((url) => jsonResponse(200, url.endsWith("/scrape") ? scrapeGolden : rankGolden));
  try {
    assert.equal((await createScrapeHandler()(jsonRequest({ url: "https://example.com" }))).status, 200);
    assert.equal((await createRankHandler()(jsonRequest({ url: "a", q: "q" }))).status, 200);
  } finally {
    restore();
  }
});

test("handler rejects non-JSON body with 400", async () => {
  const res = await createSearchHandler()(new Request("http://localhost/api", { method: "POST", body: "nope" }));
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as { error: string }).error, "invalid_request");
});

test("handler maps a SerpCheapError to its status", async () => {
  const { restore } = installFetch(() => jsonResponse(402, { error: "insufficient_credits", required: 6, balance: 2 }));
  try {
    const res = await createSearchHandler({ maxRetries: 0 })(jsonRequest({ q: "q" }));
    assert.equal(res.status, 402);
    assert.equal(((await res.json()) as { error: string }).error, "insufficient_credits");
  } finally {
    restore();
  }
});

test("handler returns 500 when the key is missing (generic error)", async () => {
  delete process.env.SERPCHEAP_API_KEY;
  const res = await createSearchHandler()(jsonRequest({ q: "q" }));
  assert.equal(res.status, 500);
  assert.equal(((await res.json()) as { error: string }).error, "internal");
});

test("route handlers proxy fresh by default (no shared caching)", async () => {
  const { restore } = installFetch(() => jsonResponse(200, searchGolden));
  try {
    await createSearchHandler()(jsonRequest({ q: "q" }));
    assert.equal(cacheCalls.length, 0);
  } finally {
    restore();
  }
});

test("route handlers cache when explicitly opted in", async () => {
  const { restore } = installFetch(() => jsonResponse(200, searchGolden));
  try {
    await createSearchHandler({ revalidate: 60 })(jsonRequest({ q: "q" }));
    assert.equal(cacheCalls.length, 1);
    assert.equal(cacheCalls[0].options.revalidate, 60);
  } finally {
    restore();
  }
});

test("SerpCheapError is re-exported", () => {
  assert.equal(typeof SerpCheapError, "function");
});
