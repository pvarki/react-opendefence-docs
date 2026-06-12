import { withBase } from "@/lib/base";
import {
  LocaleManifestSchema,
  PageDocSchema,
  SidebarConfigSchema,
  TranslationsFileSchema,
  type Locale,
  type LocaleManifest,
  type PageDoc,
  type SidebarConfig,
  type TranslationsFile,
} from "@shared/content-schema";

class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`Failed to fetch ${url}: ${status}`);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(withBase(url));
  if (!res.ok) throw new FetchError(url, res.status);
  return res.json();
}

/**
 * The pipeline bakes root-absolute asset URLs ("/content/images/...") into
 * page JSON; under a subpath deployment the browser needs them prefixed.
 * Rebased once at load — render code never thinks about the base.
 */
function rebaseAssets(doc: PageDoc): PageDoc {
  if (withBase("/") === "/") return doc;
  const rebaseHtml = (html: string) =>
    html.replace(
      /(src|href)="(\/(?:content|api-specs|images)\/)/g,
      (_m, attr, path) => `${attr}="${withBase(path)}`,
    );
  for (const block of doc.blocks) {
    switch (block.type) {
      case "html":
      case "code":
        block.html = rebaseHtml(block.html);
        break;
      case "image":
      case "pdf":
        block.src = withBase(block.src);
        break;
      case "slideset":
        for (const slide of block.slides) {
          slide.html = rebaseHtml(slide.html);
          for (const image of slide.images) image.src = withBase(image.src);
        }
        break;
      default:
        break;
    }
  }
  return doc;
}

const manifestCache = new Map<Locale, Promise<LocaleManifest>>();

export function loadManifest(locale: Locale): Promise<LocaleManifest> {
  let cached = manifestCache.get(locale);
  if (!cached) {
    cached = fetchJson(`/content/${locale}/manifest.json`)
      .then((data) => LocaleManifestSchema.parse(data))
      .catch((err: unknown) => {
        manifestCache.delete(locale); // don't cache failures
        throw err;
      });
    manifestCache.set(locale, cached);
  }
  return cached;
}

/** Small LRU for page docs — adjacent-page preloading lives on top of this. */
const PAGE_CACHE_MAX = 30;
const pageCache = new Map<string, Promise<PageDoc>>();

export function loadPage(path: string): Promise<PageDoc> {
  let cached = pageCache.get(path);
  if (cached) {
    // refresh LRU position
    pageCache.delete(path);
    pageCache.set(path, cached);
    return cached;
  }
  cached = fetchJson(path)
    .then((data) => rebaseAssets(PageDocSchema.parse(data)))
    .catch((err: unknown) => {
      pageCache.delete(path);
      throw err;
    });
  pageCache.set(path, cached);
  if (pageCache.size > PAGE_CACHE_MAX) {
    const oldest = pageCache.keys().next().value;
    if (oldest) pageCache.delete(oldest);
  }
  return cached;
}

export function loadSidebar(
  locale: Locale,
  collection: string,
): Promise<SidebarConfig> {
  const file = collection.replace(/\//g, "-");
  return fetchJson(`/content/${locale}/sidebars/${file}.json`).then((data) =>
    SidebarConfigSchema.parse(data),
  );
}

export function loadTranslations(locale: Locale): Promise<TranslationsFile> {
  return fetchJson(`/content/${locale}/translations.json`).then((data) =>
    TranslationsFileSchema.parse(data),
  );
}
