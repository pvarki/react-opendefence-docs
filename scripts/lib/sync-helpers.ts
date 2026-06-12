/**
 * Pure helpers for the Outline sync orchestrator (scripts/sync-outline.ts).
 *
 * Everything here is deliberately side-effect-light so the sync decision
 * logic, manifest assembly and translations enrichment can be unit-tested
 * without touching the network or the Outline API client.
 */
import fs from "node:fs/promises";
import path from "node:path";

import {
  SCHEMA_VERSION,
  type Locale,
  type LocaleManifest,
  type ManifestPage,
  type ClientInfo,
  type TranslationsFile,
} from "../../shared/content-schema";
import type { CollectionConfig } from "../../config/collections";
import type { BookPageRef } from "./sidebar-generator";

// ---------------------------------------------------------------------------
// Concurrency pool (ported verbatim from the old sync-outline.ts)
// ---------------------------------------------------------------------------

/** Run async tasks with a concurrency limit, returning results in input order. */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        const value = await tasks[idx]();
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export interface SyncArgs {
  force: boolean;
  collection?: string;
  verbose: boolean;
  ci: boolean;
}

/** Parse sync CLI flags. `--ci` is also auto-detected from the CI env var. */
export function parseSyncArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): SyncArgs {
  // Supports both --collection=value and --collection value.
  let collection: string | undefined;
  const collectionEqIndex = argv.findIndex((a) =>
    a.startsWith("--collection="),
  );
  const collectionSpaceIndex = argv.findIndex((a) => a === "--collection");

  if (collectionEqIndex !== -1) {
    collection = argv[collectionEqIndex].split("=")[1];
  } else if (collectionSpaceIndex !== -1 && argv[collectionSpaceIndex + 1]) {
    collection = argv[collectionSpaceIndex + 1];
  }

  const ci = argv.includes("--ci") || env.CI === "true" || env.CI === "1";

  return {
    force: argv.includes("--force") || argv.includes("-f"),
    collection,
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    ci,
  };
}

/**
 * Collection filter matching, ported from the old sync. Matches when:
 * 1. slug equals filter exactly        ("deploy-app")
 * 2. slug starts with filter + "/"     ("guides" -> "guides/tak-guide")
 * 3. slug contains filter              ("tak" -> "wikis/tak")
 * 4. label contains filter
 */
export function collectionMatchesFilter(
  collection: Pick<CollectionConfig, "slug" | "label">,
  filter: string,
): boolean {
  const f = filter.toLowerCase();
  const slug = collection.slug.toLowerCase();
  const label = collection.label.toLowerCase();
  return (
    slug === f ||
    slug.startsWith(`${f}/`) ||
    slug.includes(f) ||
    label.includes(f)
  );
}

// ---------------------------------------------------------------------------
// Incremental check
// ---------------------------------------------------------------------------

/**
 * Decide whether a document needs re-downloading.
 *
 * `localUpdatedAt` is the updatedAt of the committed manifest entry, or
 * undefined when the entry or its page JSON file is missing. Timestamps are
 * string-compared (per the PageDoc contract): any drift — including remote
 * rollbacks, which a `>` date comparison would miss — triggers a re-sync.
 */
export function shouldSyncDoc(
  remoteUpdatedAt: string,
  localUpdatedAt: string | undefined,
  force: boolean,
): boolean {
  if (force) return true;
  if (!localUpdatedAt) return true;
  return remoteUpdatedAt !== localUpdatedAt;
}

// ---------------------------------------------------------------------------
// Manifest assembly
// ---------------------------------------------------------------------------

export type DocSyncStatus = "processed" | "skipped" | "failed";

export interface BookEntryInput {
  ref: BookPageRef;
  /** Fresh updatedAt from documents.info (undefined when the info call failed). */
  updatedAt?: string;
  status: DocSyncStatus;
  /** From emitBlocks, only meaningful for status "processed". */
  underDevelopment?: boolean;
  /** Previous manifest entry matched by document id. */
  previous?: ManifestPage;
}

/**
 * Build the ManifestPage entries for one book (collection x locale) in
 * reading order. Failed docs keep their previous entry (so the page stays
 * reachable and is retried next run); failed docs without a previous entry
 * are dropped. `order` is the index within the included entries.
 */
export function buildBookManifestPages(
  locale: Locale,
  collectionSlug: string,
  inputs: BookEntryInput[],
): ManifestPage[] {
  const pages: ManifestPage[] = [];

  for (const input of inputs) {
    const { ref, status, previous } = input;

    if (status === "failed") {
      if (!previous) continue;
      pages.push({ ...previous, order: pages.length });
      continue;
    }

    const hidden =
      status === "processed"
        ? input.underDevelopment === true
        : previous?.hidden;
    const updatedAt = input.updatedAt ?? previous?.updatedAt;
    if (!updatedAt) continue; // No info and no history: nothing trustworthy to record.

    pages.push({
      id: ref.docId,
      slug: ref.slug,
      collection: collectionSlug,
      title: ref.title,
      breadcrumb: ref.breadcrumb,
      path: `/content/${locale}/pages/${collectionSlug}/${ref.slug}.json`,
      updatedAt,
      order: pages.length,
      ...(hidden ? { hidden: true } : {}),
      ...(ref.platform ? { platform: ref.platform } : {}),
      ...(ref.clientId ? { clientId: ref.clientId } : {}),
      ...(ref.chapterId
        ? { chapterId: ref.chapterId, chapterLabel: ref.chapterLabel }
        : {}),
    });
  }

  return pages;
}

/**
 * Assemble a LocaleManifest. Collections synced this run contribute their
 * freshly built entries; everything else is carried over from the previous
 * manifest so a `--collection`-filtered sync never drops the rest of the
 * site (the old pipeline regenerated metadata only for synced collections,
 * which clobbered the others — deliberately not ported).
 */
export function buildLocaleManifest(opts: {
  locale: Locale;
  collections: readonly CollectionConfig[];
  /** collection slug -> entries built this run (may be empty arrays). */
  syncedPages: ReadonlyMap<string, ManifestPage[]>;
  /** collection slug -> clients detected this run. */
  syncedClients?: ReadonlyMap<string, ClientInfo[]>;
  /**
   * EN (canonical) clients — used as fallback when this locale has none yet.
   * Ensures the platform selector stays visible for untranslated locales
   * rather than incorrectly treating them as platform-agnostic books.
   */
  enClients?: ReadonlyMap<string, ClientInfo[]>;
  previous: LocaleManifest | undefined;
  generatedAt: string;
}): LocaleManifest {
  const {
    locale,
    collections,
    syncedPages,
    syncedClients,
    enClients,
    previous,
    generatedAt,
  } = opts;

  const pages: ManifestPage[] = [];
  for (const collection of collections) {
    const synced = syncedPages.get(collection.slug);
    if (synced) {
      pages.push(...synced);
    } else if (previous) {
      pages.push(
        ...previous.pages.filter((p) => p.collection === collection.slug),
      );
    }
  }

  const present = new Set(pages.map((p) => p.collection));
  const manifestCollections = collections
    .filter((c) => present.has(c.slug))
    .map((c, order) => {
      // Fresh client info when synced; carried over from previous otherwise.
      const localeClients = syncedPages.has(c.slug)
        ? syncedClients?.get(c.slug)
        : previous?.collections.find((pc) => pc.slug === c.slug)?.clients;
      // Fall back to EN clients when this locale has none — the book is still
      // platform-aware, translations for those clients just aren't posted yet.
      const clients =
        localeClients && localeClients.length > 0
          ? localeClients
          : enClients?.get(c.slug);
      return {
        slug: c.slug,
        label: c.label,
        description: c.description,
        section: c.section,
        order,
        ...(clients && clients.length > 0 ? { clients } : {}),
      };
    });

  return {
    schemaVersion: SCHEMA_VERSION,
    locale,
    generatedAt,
    collections: manifestCollections,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Translations file (bare slug -> locale -> route path)
// ---------------------------------------------------------------------------

/**
 * Build a locale's translations.json. This collapses the old
 * extract-translations + generate-static-api enrichment into one step:
 * the "* Translations:" links carry bare Outline slugs, which are enriched
 * into full route paths ("/{locale}/{collection}/{slug}") via the freshly
 * written manifests of all locales.
 *
 * Entries for pages processed this run are recomputed (so removed
 * Translations blocks disappear); other previous entries are carried over
 * while their page is still in the manifest.
 */
export function buildTranslationsFile(opts: {
  /** page slug -> declared locale -> bare target slug (from this run). */
  newLinks: ReadonlyMap<string, Partial<Record<Locale, string>>>;
  /** bare slug -> route path, built across all locales' new manifests. */
  slugRoutes: ReadonlyMap<string, string>;
  /** Slugs present in this locale's new manifest. */
  validSlugs: ReadonlySet<string>;
  /** Slugs whose pages were (re)processed this run. */
  processedSlugs: ReadonlySet<string>;
  previous: TranslationsFile | undefined;
}): TranslationsFile {
  const { newLinks, slugRoutes, validSlugs, processedSlugs, previous } = opts;
  const out: TranslationsFile = {};

  if (previous) {
    for (const [slug, targets] of Object.entries(previous)) {
      if (validSlugs.has(slug) && !processedSlugs.has(slug)) {
        out[slug] = targets;
      }
    }
  }

  for (const [slug, targets] of newLinks) {
    if (!validSlugs.has(slug)) continue;
    const resolved: Record<string, string> = {};
    for (const [targetLocale, bareSlug] of Object.entries(targets)) {
      if (!bareSlug) continue;
      const route = slugRoutes.get(bareSlug);
      if (route) resolved[targetLocale] = route;
      // Unresolvable targets (doc not synced/published) are dropped: a route
      // we cannot verify would 404 in the locale switcher.
    }
    if (Object.keys(resolved).length > 0) {
      out[slug] = resolved;
    }
  }

  return out;
}

/** bare slug -> "/{locale}/{collection}/{slug}" across the given manifests. */
export function buildSlugRouteMap(
  manifests: Iterable<LocaleManifest>,
): Map<string, string> {
  const routes = new Map<string, string>();
  for (const manifest of manifests) {
    for (const page of manifest.pages) {
      routes.set(
        page.slug,
        `/${manifest.locale}/${page.collection}/${page.slug}`,
      );
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Stale page cleanup
// ---------------------------------------------------------------------------

/** Slugs present on disk but absent from the new manifest (to be deleted). */
export function staleSlugs(
  existing: readonly string[],
  valid: ReadonlySet<string>,
): string[] {
  return existing.filter((slug) => !valid.has(slug));
}

// ---------------------------------------------------------------------------
// JSON file IO (2-space indent, trailing newline, LF)
// ---------------------------------------------------------------------------

export async function writeJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJsonIfExists<T>(
  filePath: string,
): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

/** List the page slugs (basenames of *.json files) in a directory. */
export async function listJsonSlugs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
