#!/usr/bin/env tsx

/**
 * Documentation validation over the emitted content JSON.
 *
 * Operates purely on public/content/ (page JSON + manifests + sidebars) and
 * public/content/images — no network. Checks:
 *
 *   error    invalid-page             page JSON fails PageDocSchema
 *   error    broken-internal-link     /{locale}/... href that no manifest resolves
 *   error    missing-image            referenced /content/... asset missing on disk
 *   error    missing-page-file        manifest entry whose page JSON is missing
 *   error    orphaned-page            page file on disk but not in the manifest
 *   warning  duplicate-base-slug      same slug minus shortid, same collection+locale
 *   info     missing-locale-root      collection lacking one of en/fi/sv
 *   warning  legacy-slideset-format   slideset emitted from a legacy authoring format
 *   warning  slideset-step-missing-image  non-text slide without any image
 *   warning  empty-doc                page with no blocks
 *
 * Usage:
 *   pnpm validate:docs                       # exit 1 only on errors
 *   pnpm validate:docs --report report.md    # also write a markdown report
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  LOCALES,
  PageDocSchema,
  type Locale,
  type LocaleManifest,
  type PageDoc,
} from "../shared/content-schema";
import { ALL_COLLECTIONS } from "../config/collections";
import { readJsonIfExists } from "./lib/sync-helpers";

export const OUTLINE_DOC_BASE = "https://pvarki.getoutline.com/doc/";

export type IssueLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: IssueLevel;
  code: string;
  message: string;
  locale: Locale;
  collection: string;
  slug: string;
  /** Deep link for fixing the source document in Outline. */
  outlineUrl: string;
}

/**
 * Slug minus the Outline shortid suffix. Outline shortids are 8+ base62
 * chars containing at least one digit or uppercase letter — the constraint
 * avoids chopping ordinary long English words off slugs.
 */
export function baseSlug(slug: string): string {
  return slug.replace(/-(?=[a-zA-Z]*[A-Z0-9])[a-zA-Z0-9]{8,}$/, "");
}

function issue(
  level: IssueLevel,
  code: string,
  message: string,
  locale: Locale,
  collection: string,
  slug: string,
): ValidationIssue {
  return {
    level,
    code,
    message,
    locale,
    collection,
    slug,
    outlineUrl: `${OUTLINE_DOC_BASE}${slug}`,
  };
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

const HREF_PATTERN = /href="([^"]*)"/g;
const IMG_SRC_PATTERN = /<img\b[^>]*?\bsrc="([^"]*)"/g;

// Real app routes that are not content pages (so they aren't in the manifest);
// links to them are valid. Keyed without the /{locale}/ prefix.
const NON_CONTENT_ROUTES = new Set(["dev/api", "dev/releases"]);

function extractAll(pattern: RegExp, html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(pattern)) out.push(match[1]);
  return out;
}

/** All hrefs found in a page's html blocks and slide bodies. */
export function collectHrefs(page: PageDoc): string[] {
  const hrefs: string[] = [];
  for (const block of page.blocks) {
    if (block.type === "html" || block.type === "code") {
      hrefs.push(...extractAll(HREF_PATTERN, block.html));
    } else if (block.type === "slideset") {
      for (const slide of block.slides) {
        hrefs.push(...extractAll(HREF_PATTERN, slide.html));
      }
    }
  }
  return hrefs;
}

/** All local asset srcs (images, pdfs) referenced by a page. */
export function collectAssetSrcs(page: PageDoc): string[] {
  const srcs: string[] = [];
  for (const block of page.blocks) {
    if (block.type === "image" || block.type === "pdf") {
      srcs.push(block.src);
    } else if (block.type === "slideset") {
      for (const slide of block.slides) {
        srcs.push(...slide.images.map((i) => i.src));
        srcs.push(...extractAll(IMG_SRC_PATTERN, slide.html));
      }
    } else if (block.type === "html" || block.type === "code") {
      srcs.push(...extractAll(IMG_SRC_PATTERN, block.html));
    }
  }
  return srcs;
}

/**
 * Parse an internal route href "/{locale}/{collection...}/{slug}[#anchor]"
 * into locale + "collection/slug" key, or undefined for non-route hrefs
 * (external, anchors, /content/ asset paths, ...).
 */
export function parseRouteHref(
  href: string,
): { locale: Locale; routeKey: string } | undefined {
  const clean = href.split("#")[0].split("?")[0];
  const match = clean.match(/^\/([a-z]{2})\/(.+)$/);
  if (!match) return undefined;
  const locale = LOCALES.find((l) => l === match[1]);
  if (!locale) return undefined;
  return { locale, routeKey: match[2].replace(/\/+$/, "") };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

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
    if (entry.isDirectory()) files.push(...(await walkJsonFiles(fullPath)));
    else if (entry.name.endsWith(".json")) files.push(fullPath);
  }
  return files;
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

/** Validate everything under {publicDir}/content. */
export async function validateDocs(
  publicDir: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const contentDir = path.join(publicDir, "content");

  // Load manifests and build per-locale route sets ("collection/slug").
  const manifests = new Map<Locale, LocaleManifest>();
  const routeSets = new Map<Locale, Set<string>>();
  for (const locale of LOCALES) {
    const manifest = await readJsonIfExists<LocaleManifest>(
      path.join(contentDir, locale, "manifest.json"),
    );
    if (!manifest || !Array.isArray(manifest.pages)) continue;
    manifests.set(locale, manifest);
    routeSets.set(
      locale,
      new Set(manifest.pages.map((p) => `${p.collection}/${p.slug}`)),
    );
  }

  for (const locale of LOCALES) {
    const manifest = manifests.get(locale);
    const pagesDir = path.join(contentDir, locale, "pages");
    const pageFiles = await walkJsonFiles(pagesDir);
    const manifestKeys = routeSets.get(locale) ?? new Set<string>();

    // --- manifest-side checks -------------------------------------------
    if (manifest) {
      // missing-page-file
      for (const entry of manifest.pages) {
        const filePath = path.join(publicDir, ...entry.path.split("/"));
        if (!(await fileExists(filePath))) {
          issues.push(
            issue(
              "error",
              "missing-page-file",
              `Manifest references ${entry.path} but the file is missing`,
              locale,
              entry.collection,
              entry.slug,
            ),
          );
        }
      }

      // duplicate-base-slug (same collection + locale)
      const byBase = new Map<string, string[]>();
      for (const entry of manifest.pages) {
        const key = `${entry.collection}::${baseSlug(entry.slug)}`;
        byBase.set(key, [...(byBase.get(key) ?? []), entry.slug]);
      }
      for (const [key, slugs] of byBase) {
        if (slugs.length > 1) {
          const [collection, base] = key.split("::");
          issues.push(
            issue(
              // Warning, not error: full slugs stay unique (shortid suffix),
              // so nothing breaks — this is an editorial-cleanup signal that
              // must not block deploys until the wiki itself is tidied.
              "warning",
              "duplicate-base-slug",
              `Base slug "${base}" maps to ${slugs.length} documents: ${slugs.join(", ")}`,
              locale,
              collection,
              slugs[0],
            ),
          );
        }
      }
    }

    // --- page-file checks -------------------------------------------------
    for (const file of pageFiles) {
      // locale/collection/slug derived from the file location.
      const rel = path.relative(pagesDir, file).split(path.sep);
      const fileSlug = rel[rel.length - 1].replace(/\.json$/, "");
      const fileCollection = rel.slice(0, -1).join("/");
      const routeKey = `${fileCollection}/${fileSlug}`;

      const raw = await readJsonIfExists<unknown>(file);
      const parsed = PageDocSchema.safeParse(raw);

      if (!parsed.success) {
        issues.push(
          issue(
            "error",
            "invalid-page",
            `Page JSON fails schema validation: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
            locale,
            fileCollection,
            fileSlug,
          ),
        );
        continue;
      }
      const page = parsed.data;

      // orphaned-page
      if (!manifestKeys.has(routeKey)) {
        issues.push(
          issue(
            "error",
            "orphaned-page",
            `Page file exists but is not in the ${locale} manifest`,
            locale,
            fileCollection,
            fileSlug,
          ),
        );
      }

      // broken-internal-link
      for (const href of collectHrefs(page)) {
        const route = parseRouteHref(href);
        if (!route) continue;
        if (NON_CONTENT_ROUTES.has(route.routeKey)) continue;
        if (!routeSets.get(route.locale)?.has(route.routeKey)) {
          issues.push(
            issue(
              "error",
              "broken-internal-link",
              `Link "${href}" does not resolve in the ${route.locale} manifest`,
              locale,
              page.collection,
              page.slug,
            ),
          );
        }
      }

      // missing-image (covers image blocks, slideset images, inline <img>, pdfs)
      for (const src of collectAssetSrcs(page)) {
        if (!src.startsWith("/content/")) continue; // external / data URIs
        if (!(await fileExists(path.join(publicDir, ...src.split("/"))))) {
          issues.push(
            issue(
              "error",
              "missing-image",
              `Referenced asset ${src} is missing on disk`,
              locale,
              page.collection,
              page.slug,
            ),
          );
        }
      }

      // slideset warnings
      for (const block of page.blocks) {
        if (block.type !== "slideset") continue;
        if (block.source === "legacy") {
          issues.push(
            issue(
              "warning",
              "legacy-slideset-format",
              `Slideset${block.title ? ` "${block.title}"` : ""} still uses a legacy authoring format — convert to META: slides`,
              locale,
              page.collection,
              page.slug,
            ),
          );
        }
        const missing = block.slides.filter(
          (s) => s.layout !== "text" && s.images.length === 0,
        ).length;
        if (missing > 0) {
          issues.push(
            issue(
              "warning",
              "slideset-step-missing-image",
              `${missing} slide(s) have an image layout but no image`,
              locale,
              page.collection,
              page.slug,
            ),
          );
        }
      }

      // empty-doc
      if (page.blocks.length === 0) {
        issues.push(
          issue(
            "warning",
            "empty-doc",
            "Page has no content blocks",
            locale,
            page.collection,
            page.slug,
          ),
        );
      }
    }
  }

  // --- cross-locale: missing-locale-root ---------------------------------
  for (const collection of ALL_COLLECTIONS) {
    if (collection.noLocale) continue; // en-only by design
    const present = LOCALES.filter((locale) =>
      manifests
        .get(locale)
        ?.pages.some((p) => p.collection === collection.slug),
    );
    if (present.length === 0) continue; // not synced at all — nothing to report
    for (const locale of LOCALES) {
      if (!present.includes(locale)) {
        issues.push(
          issue(
            "info",
            "missing-locale-root",
            `Collection "${collection.label}" has no ${locale} locale root document`,
            locale,
            collection.slug,
            "",
          ),
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Markdown report for the sync PR body. */
export function renderReport(issues: ValidationIssue[]): string {
  const lines: string[] = ["# Docs validation report", ""];
  lines.push(`Generated: ${new Date().toISOString()}`, "");

  if (issues.length === 0) {
    lines.push("No issues found.", "");
    return lines.join("\n");
  }

  // Summary table by level/code
  const counts = new Map<
    string,
    { level: IssueLevel; code: string; count: number }
  >();
  for (const i of issues) {
    const key = `${i.level}:${i.code}`;
    const entry = counts.get(key) ?? { level: i.level, code: i.code, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  const levelRank: Record<IssueLevel, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  const summary = [...counts.values()].sort(
    (a, b) =>
      levelRank[a.level] - levelRank[b.level] || a.code.localeCompare(b.code),
  );

  lines.push(
    "## Summary",
    "",
    "| Level | Code | Count |",
    "| --- | --- | --- |",
  );
  for (const row of summary) {
    lines.push(`| ${row.level} | \`${row.code}\` | ${row.count} |`);
  }
  lines.push("");

  // Per-collection sections with Outline deep links
  const byCollection = new Map<string, ValidationIssue[]>();
  for (const i of issues) {
    const key = i.collection || "(no collection)";
    byCollection.set(key, [...(byCollection.get(key) ?? []), i]);
  }
  for (const [collection, collectionIssues] of [...byCollection.entries()].sort(
    (a, b) => a[0].localeCompare(b[0]),
  )) {
    lines.push(`## ${collection}`, "");
    const sorted = [...collectionIssues].sort(
      (a, b) =>
        levelRank[a.level] - levelRank[b.level] || a.code.localeCompare(b.code),
    );
    for (const i of sorted) {
      const link = i.slug ? ` ([open in Outline](${i.outlineUrl}))` : "";
      lines.push(
        `- **${i.level}** \`${i.code}\` [${i.locale}${i.slug ? `/${i.slug}` : ""}] — ${i.message}${link}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseReportFlag(argv: string[]): string | undefined {
  const eq = argv.find((a) => a.startsWith("--report="));
  if (eq) return eq.split("=")[1];
  const idx = argv.indexOf("--report");
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

async function main() {
  const reportFile = parseReportFlag(process.argv.slice(2));
  const publicDir = path.join(process.cwd(), "public");

  console.log("🔍 Validating documentation...\n");
  const issues = await validateDocs(publicDir);

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const infos = issues.filter((i) => i.level === "info");

  for (const i of issues) {
    const tag = i.level === "error" ? "✖" : i.level === "warning" ? "⚠" : "ℹ";
    console.log(
      `  ${tag} [${i.level}] ${i.code} ${i.locale}/${i.collection}${i.slug ? `/${i.slug}` : ""}: ${i.message}`,
    );
  }

  console.log(
    `\n${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`,
  );

  if (reportFile) {
    await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
    await fs.writeFile(path.resolve(reportFile), renderReport(issues), "utf-8");
    console.log(`Report written to ${reportFile}`);
  }

  if (errors.length > 0) {
    console.log("\nValidation failed with errors\n");
    process.exit(1);
  }
  console.log(
    warnings.length > 0
      ? "\nValidation passed with warnings\n"
      : "\nAll validations passed!\n",
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("\nValidation failed:", err.message || err);
    process.exit(1);
  });
}
