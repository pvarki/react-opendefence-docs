import {
  HIDDEN_SECTIONS,
  UNDER_CONSTRUCTION_SECTIONS,
} from "@config/collections";
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

/**
 * The manifest as the app sees it: books of hidden sections dropped, books of
 * sections under construction flagged like a draft marker in Outline would.
 */
export function applySectionStatus(manifest: LocaleManifest): LocaleManifest {
  const slugsIn = (sections: readonly string[]) =>
    new Set(
      manifest.collections
        .filter((c) => sections.includes(c.section))
        .map((c) => c.slug),
    );
  const hidden = slugsIn(HIDDEN_SECTIONS);
  const flagged = slugsIn(UNDER_CONSTRUCTION_SECTIONS);
  return {
    ...manifest,
    collections: manifest.collections
      .filter((c) => !hidden.has(c.slug))
      .map((c) => (flagged.has(c.slug) ? { ...c, underDevelopment: true } : c)),
    pages: manifest.pages
      .filter((p) => !hidden.has(p.collection))
      .map((p) =>
        flagged.has(p.collection) ? { ...p, underDevelopment: true } : p,
      ),
  };
}

const syncedManifests = new Map<Locale, Promise<LocaleManifest>>();
const manifestCache = new Map<Locale, Promise<LocaleManifest>>();

/**
 * The manifest as synced, hidden books included. Only for telling where an
 * outdated URL leads — everything a reader sees comes from loadManifest.
 */
export function loadSyncedManifest(locale: Locale): Promise<LocaleManifest> {
  let cached = syncedManifests.get(locale);
  if (!cached) {
    cached = fetchJson(`/content/${locale}/manifest.json`)
      .then((data) => LocaleManifestSchema.parse(data))
      .catch((err: unknown) => {
        syncedManifests.delete(locale); // don't cache failures
        throw err;
      });
    syncedManifests.set(locale, cached);
  }
  return cached;
}

export function loadManifest(locale: Locale): Promise<LocaleManifest> {
  let cached = manifestCache.get(locale);
  if (!cached) {
    cached = loadSyncedManifest(locale)
      .then(applySectionStatus)
      .catch((err: unknown) => {
        manifestCache.delete(locale);
        throw err;
      });
    manifestCache.set(locale, cached);
  }
  return cached;
}

/** Small LRU for page docs — adjacent-page preloading lives on top of this. */
const PAGE_CACHE_MAX = 30;
const pageCache = new Map<string, Promise<PageDoc>>();
const loadedPages = new Map<string, PageDoc>();

export function loadPage(path: string): Promise<PageDoc> {
  let cached = pageCache.get(path);
  if (cached) {
    // refresh LRU position
    pageCache.delete(path);
    pageCache.set(path, cached);
    return cached;
  }
  cached = fetchJson(path)
    .then((data) => {
      const doc = rebaseAssets(PageDocSchema.parse(data));
      if (pageCache.has(path)) loadedPages.set(path, doc);
      return doc;
    })
    .catch((err: unknown) => {
      pageCache.delete(path);
      throw err;
    });
  pageCache.set(path, cached);
  if (pageCache.size > PAGE_CACHE_MAX) {
    const oldest = pageCache.keys().next().value;
    if (oldest) {
      pageCache.delete(oldest);
      loadedPages.delete(oldest);
    }
  }
  return cached;
}

/** A page doc that has already loaded, without waiting a tick for its promise. */
export function peekPage(path: string): PageDoc | undefined {
  return loadedPages.get(path);
}

const sidebarCache = new Map<string, Promise<SidebarConfig>>();

export function loadSidebar(
  locale: Locale,
  collection: string,
): Promise<SidebarConfig> {
  const file = collection.replace(/\//g, "-");
  const key = `${locale}/${file}`;
  let cached = sidebarCache.get(key);
  if (!cached) {
    cached = fetchJson(`/content/${locale}/sidebars/${file}.json`)
      .then((data) => SidebarConfigSchema.parse(data))
      .catch((err: unknown) => {
        sidebarCache.delete(key);
        throw err;
      });
    sidebarCache.set(key, cached);
  }
  return cached;
}

const translationsCache = new Map<Locale, Promise<TranslationsFile>>();

export function loadTranslations(locale: Locale): Promise<TranslationsFile> {
  let cached = translationsCache.get(locale);
  if (!cached) {
    cached = fetchJson(`/content/${locale}/translations.json`)
      .then((data) => TranslationsFileSchema.parse(data))
      .catch((err: unknown) => {
        translationsCache.delete(locale); // don't cache failures
        throw err;
      });
    translationsCache.set(locale, cached);
  }
  return cached;
}
