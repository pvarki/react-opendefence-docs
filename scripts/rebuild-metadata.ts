#!/usr/bin/env tsx

/**
 * Rebuild manifest.json files from the page JSON already on disk.
 *
 * Recovery tool: when a manifest is lost or corrupted, scan
 * public/content/{locale}/pages/**\/*.json plus the sidebar configs and
 * reconstruct the per-locale manifest. Reading order comes from the sidebar
 * (depth-first doc items); pages missing from a sidebar fall back to the
 * existing manifest's order field and finally to slug order.
 *
 * Usage:
 *   pnpm rebuild:meta
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  LOCALES,
  PageDocSchema,
  LocaleManifestSchema,
  type Locale,
  type LocaleManifest,
  type ManifestPage,
  type PageDoc,
  type SidebarConfig,
  type SidebarItem,
} from "../shared/content-schema";
import { ALL_COLLECTIONS } from "../config/collections";
import {
  readJsonIfExists,
  writeJson,
  buildLocaleManifest,
} from "./lib/sync-helpers";

// Recursively collect *.json file paths under a directory.
async function walkJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(fullPath)));
    } else if (entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

// Depth-first doc slugs of a sidebar => slug -> reading-order index.
function sidebarOrderIndex(sidebar: SidebarConfig): Map<string, number> {
  const order = new Map<string, number>();
  const walk = (items: SidebarItem[]) => {
    for (const item of items) {
      if (item.type === "doc" && item.slug && !order.has(item.slug)) {
        order.set(item.slug, order.size);
      }
      if (item.children) walk(item.children);
    }
  };
  walk(sidebar.items);
  return order;
}

/**
 * Rebuild one locale's manifest from disk. Returns undefined when the locale
 * has no pages and no existing manifest (nothing to rebuild).
 */
export async function rebuildLocaleManifest(
  publicDir: string,
  locale: Locale,
): Promise<LocaleManifest | undefined> {
  const contentDir = path.join(publicDir, "content", locale);
  const previous = await readJsonIfExists<LocaleManifest>(
    path.join(contentDir, "manifest.json"),
  );

  // Scan page JSON
  const pages: PageDoc[] = [];
  for (const file of await walkJsonFiles(path.join(contentDir, "pages"))) {
    const raw = await readJsonIfExists<unknown>(file);
    const parsed = PageDocSchema.safeParse(raw);
    if (parsed.success) {
      pages.push(parsed.data);
    } else {
      console.warn(`  ⚠ Skipping invalid page JSON: ${file}`);
    }
  }

  if (pages.length === 0 && !previous) return undefined;

  // Sidebar reading order per collection (keyed by the slug stored inside)
  const sidebarOrders = new Map<string, Map<string, number>>();
  let sidebarFiles: string[] = [];
  try {
    sidebarFiles = (await fs.readdir(path.join(contentDir, "sidebars")))
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(contentDir, "sidebars", f));
  } catch {
    // No sidebars directory — fall back to existing order fields.
  }
  for (const file of sidebarFiles) {
    const sidebar = await readJsonIfExists<SidebarConfig>(file);
    if (sidebar?.slug && Array.isArray(sidebar.items)) {
      sidebarOrders.set(sidebar.slug, sidebarOrderIndex(sidebar));
    }
  }

  const prevById = new Map<string, ManifestPage>();
  for (const page of previous?.pages ?? []) prevById.set(page.id, page);

  // Assemble entries per collection, ordered by sidebar / previous order.
  const syncedPages = new Map<string, ManifestPage[]>();
  const byCollection = new Map<string, PageDoc[]>();
  for (const page of pages) {
    const group = byCollection.get(page.collection) ?? [];
    group.push(page);
    byCollection.set(page.collection, group);
  }

  const FALLBACK = 1_000_000;
  for (const [collectionSlug, group] of byCollection) {
    const sidebarOrder = sidebarOrders.get(collectionSlug);
    const sortKey = (page: PageDoc): number => {
      const fromSidebar = sidebarOrder?.get(page.slug);
      if (fromSidebar !== undefined) return fromSidebar;
      const fromPrevious = prevById.get(page.id)?.order;
      return fromPrevious !== undefined
        ? FALLBACK + fromPrevious
        : 2 * FALLBACK;
    };
    group.sort(
      (a, b) => sortKey(a) - sortKey(b) || a.slug.localeCompare(b.slug),
    );

    syncedPages.set(
      collectionSlug,
      group.map((page, order) => {
        const prev = prevById.get(page.id);
        return {
          id: page.id,
          slug: page.slug,
          collection: page.collection,
          title: page.title,
          breadcrumb: page.breadcrumb,
          path: `/content/${locale}/pages/${page.collection}/${page.slug}.json`,
          updatedAt: page.updatedAt,
          order,
          ...(page.underDevelopment ? { hidden: true } : {}),
          // platform only exists in the manifest (parsed from the Outline
          // title at sync time) — carry it over from the previous manifest.
          ...(prev?.platform ? { platform: prev.platform } : {}),
        };
      }),
    );
  }

  // Only configured collections are included (same rule as sync); stray
  // page files from removed collections are reported by validate-docs.
  const manifest = buildLocaleManifest({
    locale,
    collections: ALL_COLLECTIONS,
    syncedPages,
    previous: undefined,
    generatedAt: new Date().toISOString(),
  });

  return LocaleManifestSchema.parse(manifest);
}

async function main() {
  console.log("\n🔨 Rebuilding manifest files from page JSON\n");

  const publicDir = path.join(process.cwd(), "public");
  let totalPages = 0;

  for (const locale of LOCALES) {
    const manifest = await rebuildLocaleManifest(publicDir, locale);
    if (!manifest) {
      console.log(`${locale}: no content found, skipping`);
      continue;
    }
    await writeJson(
      path.join(publicDir, "content", locale, "manifest.json"),
      manifest,
    );
    totalPages += manifest.pages.length;
    console.log(
      `${locale}: ${manifest.pages.length} pages across ${manifest.collections.length} collections`,
    );
  }

  console.log(`\nComplete! Indexed ${totalPages} pages across all locales.\n`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("\nFailed:", err.message || err);
    process.exit(1);
  });
}
