# @serpcheap/next

[![npm](https://img.shields.io/npm/v/@serpcheap/next)](https://www.npmjs.com/package/@serpcheap/next)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Next.js helpers for the [serp.cheap](https://serp.cheap) Google SERP API:
**server-side key handling**, **result caching** (via `unstable_cache`, cached by
default with per-query tags), **Server Actions**, and **App Router route
handlers**. Built on [`@serpcheap/sdk`](https://www.npmjs.com/package/@serpcheap/sdk).

## Install

```bash
npm install @serpcheap/next
```

```bash
# .env.local — server-side only (never NEXT_PUBLIC_)
SERPCHEAP_API_KEY=sk_...
```

Get a key at [app.serp.cheap](https://app.serp.cheap).

## Server Components & Actions

`search` / `scrape` / `rank` are `server-only` — the key stays on the server and
the **result is cached** (1h by default), which saves credits:

```tsx
// app/page.tsx (Server Component)
import { search } from "@serpcheap/next";

export default async function Page() {
  const res = await search({ q: "best running shoes", gl: "us" });
  return (
    <ul>
      {res.organic.map((r) => (
        <li key={r.position}><a href={r.link}>{r.title}</a></li>
      ))}
    </ul>
  );
}
```

```ts
import { scrape, rank } from "@serpcheap/next";
const page = await scrape({ url: "https://example.com", screenshot: true });
const pos  = await rank({ url: "example.com", q: "best running shoes", pages: 3 });
```

## Caching & on-demand revalidation

Results are cached with Next's `unstable_cache` and tagged automatically — so a
repeated query is free, and you can invalidate exactly one query with Next's
native `revalidateTag`:

```ts
import { search, searchTag, SERPCHEAP_TAG } from "@serpcheap/next";
import { revalidateTag } from "next/cache";

await search({ q: "evergreen" }, { revalidate: 86400 }); // cache 24h
await search({ q: "live scores" }, { cache: false });    // always fresh, no cache
await search({ q: "x" }, { revalidate: false });         // cache indefinitely

// refresh just this query
revalidateTag(searchTag({ q: "best running shoes", gl: "us" }));

// or nuke the whole serp.cheap cache
revalidateTag(SERPCHEAP_TAG);
```

Tags are deterministic and mirror what the SDK actually sends: the same query
(any key order, defaults applied) maps to the same tag. `scrapeTag` / `rankTag`
work the same way.

> **Note:** `rank` is cached too (1h). For live rank tracking, pass
> `{ cache: false }` or a short `revalidate`.

## Options

Every helper takes a single options object — cache controls and client overrides
together (they never collide):

```ts
await search(
  { q: "best running shoes" },
  {
    revalidate: 3600,   // cache window (s); false = forever; default 3600
    tags: ["home"],     // extra tags, merged with the per-query tags
    cache: false,       // bypass the cache entirely
    apiKey: "sk_...",   // overrides SERPCHEAP_API_KEY
    timeoutMs: 15000,
    maxRetries: 2,
  },
);
```

`createClient(options)` returns a raw [`SerpCheap`](https://www.npmjs.com/package/@serpcheap/sdk)
client (uncached) if you want the full SDK surface.

## Server Actions

Call from a Client Component or `<form action>` — the key never leaves the
server, and a client can't inject an API key:

```ts
// app/actions.ts
export { searchAction, scrapeAction, rankAction } from "@serpcheap/next/actions";
```

```tsx
"use client";
import { searchAction } from "./actions";
const res = await searchAction({ q: "best running shoes" });
```

## Route handlers

Expose your own API route so client code can query without seeing the key — the
handler proxies to serp.cheap server-side and maps errors to the right status:

```ts
// app/api/search/route.ts
import { createSearchHandler } from "@serpcheap/next/route";
export const POST = createSearchHandler();

// app/api/scrape/route.ts → createScrapeHandler()
// app/api/rank/route.ts   → createRankHandler()
```

```tsx
"use client";
const res = await fetch("/api/search", {
  method: "POST",
  body: JSON.stringify({ q: "best running shoes" }),
}).then((r) => r.json());
```

Errors come back as `{ "error": "insufficient_credits", "message": "..." }` with
the matching HTTP status. The handler is a thin proxy — it does not validate the
request body shape (the API validates server-side).

Route handlers are **uncached by default** (each caller gets a fresh request —
your account balance is never shared in a cached body). Opt in per route:

```ts
export const POST = createSearchHandler({ revalidate: 3600 });
```

## License

MIT
