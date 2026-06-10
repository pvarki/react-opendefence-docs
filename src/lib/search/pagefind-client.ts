/**
 * Lazy client for the pagefind bundle generated at build time. The bundle
 * lives outside the Vite module graph (/pagefind/pagefind.js), hence the
 * runtime dynamic import. Pagefind picks the per-language index from
 * <html lang>, which the locale layout keeps in sync; switching locales
 * after the first search keeps the originally loaded index (acceptable —
 * a full reload re-resolves).
 */

export interface SearchHit {
  url: string;
  title: string;
  collection: string;
  excerpt: string;
}

interface PagefindModule {
  search: (query: string) => Promise<{
    results: {
      id: string;
      data: () => Promise<{
        url: string;
        excerpt: string;
        meta: { title?: string; collection?: string };
      }>;
    }[];
  }>;
  init: () => Promise<void>;
}

let modulePromise: Promise<PagefindModule | null> | undefined;

// Non-literal specifier: keeps both TS (no ambient modules for absolute
// paths) and Rollup from trying to resolve a build-generated asset.
const PAGEFIND_URL = "/pagefind/pagefind.js";

function loadPagefind(): Promise<PagefindModule | null> {
  if (!modulePromise) {
    modulePromise = import(/* @vite-ignore */ PAGEFIND_URL)
      .then(async (mod: PagefindModule) => {
        await mod.init();
        return mod;
      })
      .catch(() => {
        modulePromise = undefined; // retry later (dev without an index)
        return null;
      });
  }
  return modulePromise;
}

export async function searchDocs(
  query: string,
  limit = 15,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const pagefind = await loadPagefind();
  if (!pagefind) return [];

  const { results } = await pagefind.search(trimmed);
  const top = await Promise.all(results.slice(0, limit).map((r) => r.data()));
  return top.map((data) => ({
    url: data.url,
    title: data.meta.title ?? data.url,
    collection: data.meta.collection ?? "",
    excerpt: data.excerpt,
  }));
}
