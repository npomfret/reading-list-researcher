import { logger } from "./utils/logger.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function search(
  query: string,
  apiKey: string,
  count = 10
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: String(count) });
  const url = `https://api.search.brave.com/res/v1/web/search?${params}`;

  logger.info(`Brave search: "${query}"`);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results: SearchResult[] = (data.web?.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.description ?? "",
  }));

  logger.info(`Brave search returned ${results.length} results`);
  return results;
}
