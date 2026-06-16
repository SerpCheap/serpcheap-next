export const searchGolden = {
  search: "best running shoes",
  page: 1,
  organic: [
    { position: 1, title: "A", link: "https://a", snippet: "s" },
    { position: 2, title: "B", link: "https://b", snippet: "s" },
  ],
  stats: { balance: 994, cost: 6, cached: false },
};

export const scrapeGolden = {
  url: "https://example.com",
  status: 200,
  title: "Example",
  content: "# Example",
  content_text: "Example",
  stats: { balance: 988, cost: 6 },
};

export const rankGolden = {
  url: "a",
  search: "q",
  gl: "us",
  match_type: "domain",
  pages_scanned: 1,
  found: true,
  rank: 1,
  matches: [{ rank: 1, page: 1, position_on_page: 1, link: "https://a", title: "A" }],
  organic: [{ position: 1, title: "A", link: "https://a", snippet: "s" }],
  partial: false,
  pages_failed: [],
  stats: { balance: 985, cost: 6, pages_cached: 0, pages_fresh: 1 },
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export interface RecordedCall {
  url: string;
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } };
}

/** Replace globalThis.fetch with a recorder; returns calls + a restore fn. */
export function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init as RecordedCall["init"] });
    return handler(String(input), init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
