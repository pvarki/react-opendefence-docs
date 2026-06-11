#!/usr/bin/env tsx

// Outline Wiki Sync
//
// Downloads documents from Outline, processes them through the
// normalizer/block-emitter pipeline and writes the app-facing content JSON
// (pages, sidebars, manifests, translations) under public/content/.
//
// Usage:
//   pnpm sync:outline                         # Sync changed documents only
//   pnpm sync:outline --force                 # Re-download all documents
//   pnpm sync:outline --collection guides     # Sync collections starting with "guides/"
//   pnpm sync:outline --collection=deploy-app # Sync specific collection
//   pnpm sync:outline --collection tak        # Sync collections containing "tak"

import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import ora from "ora";
import cliProgress from "cli-progress";
import chalk from "chalk";

import { createOutlineClient } from "./lib/outline-api";
import type { CollectionSyncStats } from "./lib/script-types";
import {
  processDocumentImages,
  updateImageReferences,
} from "./lib/image-processor";
import {
  normalizeOutlineMarkdown,
  extractTranslationLinks,
} from "./lib/outline-normalizer";
import { emitBlocks } from "./lib/block-emitter";
import {
  parseOrganizerMarkers,
  type OrganizerMarkers,
} from "./lib/organizer-markers";
import { createTimer, formatDuration } from "./lib/utils";
import {
  buildBook,
  slugFromUrl,
  type BookPageRef,
  type OutlineNavNode,
} from "./lib/sidebar-generator";
import {
  runWithConcurrency,
  parseSyncArgs,
  collectionMatchesFilter,
  shouldSyncDoc,
  buildBookManifestPages,
  buildLocaleManifest,
  buildTranslationsFile,
  buildSlugRouteMap,
  staleSlugs,
  writeJson,
  readJsonIfExists,
  listJsonSlugs,
  type SyncArgs,
  type BookEntryInput,
  type DocSyncStatus,
} from "./lib/sync-helpers";
import {
  ALL_COLLECTIONS,
  validateCollectionConfig,
  type CollectionConfig,
} from "../config/collections";
import {
  LOCALES,
  SCHEMA_VERSION,
  PageDocSchema,
  LocaleManifestSchema,
  SidebarConfigSchema,
  type Locale,
  type LocaleManifest,
  type ManifestPage,
  type ClientInfo,
  type Platform,
  type TranslationsFile,
} from "../shared/content-schema";

type OutlineClient = ReturnType<typeof createOutlineClient>;
type DocumentInfo = Awaited<ReturnType<OutlineClient["getDocumentInfo"]>>;
type LocaleStructure = Awaited<
  ReturnType<OutlineClient["getCollectionStructure"]>
>;

/** Concurrency for lightweight API calls (document info) */
const INFO_CONCURRENCY = 8;

/** Concurrency for heavy API calls (document export/download) */
const DOWNLOAD_CONCURRENCY = 4;

/**
 * Maximum number of full retry passes for failed documents.
 * Each pass attempts every previously-failed document again.
 * With unlimited retries in rate-limited-fetch this is the outer guard.
 */
const MAX_DOC_RETRY_PASSES = 10;

/** Breather between retry passes to let Outline rate limits reset. */
const RETRY_BREATHER_MS = 5_000;

const CONTENT_ROOT = path.join(process.cwd(), "public", "content");

// Output paths

function pageFilePath(locale: Locale, collectionSlug: string, slug: string) {
  return path.join(
    CONTENT_ROOT,
    locale,
    "pages",
    ...collectionSlug.split("/"),
    `${slug}.json`,
  );
}

function sidebarFilePath(locale: Locale, collectionSlug: string) {
  return path.join(
    CONTENT_ROOT,
    locale,
    "sidebars",
    `${collectionSlug.replace(/\//g, "-")}.json`,
  );
}

function manifestFilePath(locale: Locale) {
  return path.join(CONTENT_ROOT, locale, "manifest.json");
}

function translationsFilePath(locale: Locale) {
  return path.join(CONTENT_ROOT, locale, "translations.json");
}

// Document info cache

const documentInfoCache = new Map<string, DocumentInfo>();

/** Organizer body markers, fetched once per doc per run. */
const organizerMarkersCache = new Map<string, OrganizerMarkers>();

// Get document info with caching to avoid duplicate API calls.
async function getCachedDocumentInfo(
  client: OutlineClient,
  docId: string,
): Promise<DocumentInfo> {
  const cached = documentInfoCache.get(docId);
  if (cached) return cached;
  const info = await client.getDocumentInfo(docId);
  documentInfoCache.set(docId, info);
  return info;
}

// CI-aware logging helpers

// Returns a [HH:MM:SS] timestamp prefix for CI log lines.
function ciTimestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

// Thin wrapper around `ora` that degrades to plain console.log in CI mode.
// Exposes the same succeed/fail surface so call-sites need no changes.
function createSpinner(
  text: string,
  ci: boolean,
): {
  succeed: (msg: string) => void;
  fail: (msg: string) => void;
  set text(v: string);
} {
  if (ci) {
    console.log(`[${ciTimestamp()}] … ${text}`);
    return {
      succeed(msg: string) {
        console.log(`[${ciTimestamp()}] ✔ ${msg}`);
      },
      fail(msg: string) {
        console.log(`[${ciTimestamp()}] ✖ ${msg}`);
      },
      set text(v: string) {
        console.log(`[${ciTimestamp()}] … ${v}`);
      },
    };
  }
  // Interactive mode – delegate to real ora
  const spinner = ora({ text, color: "blue" }).start();
  return {
    succeed(msg: string) {
      spinner.succeed(msg);
    },
    fail(msg: string) {
      spinner.fail(msg);
    },
    set text(v: string) {
      spinner.text = v;
    },
  };
}

// Stats

interface SyncStats {
  startTime: number;
  endTime?: number;
  successfulSyncs: number;
  failedSyncs: number;
  skippedSyncs: number;
  totalImages: number;
  deletedPages: number;
  collections: CollectionSyncStats[];
}

// Document processing

interface ProcessResult {
  images: number;
  underDevelopment: boolean;
  translationLinks: Partial<Record<Locale, string>>;
  title: string;
}

// Download, normalize, emit blocks and write one page JSON.
async function processDocument(
  client: OutlineClient,
  ref: BookPageRef,
  collection: CollectionConfig,
  locale: Locale,
  slugRouteIndex: Map<string, string>,
): Promise<ProcessResult> {
  const info = await getCachedDocumentInfo(client, ref.docId);

  const { markdown: rawMarkdown, images } =
    await client.downloadDocumentWithImages(ref.docId);

  // Convert + store attachments, then rewrite refs to /content/images/... paths.
  const processedImages = await processDocumentImages(images, locale);
  let markdown = rawMarkdown;
  if (processedImages.size > 0) {
    markdown = updateImageReferences(markdown, processedImages, locale);
  }

  // Text-level Outline fixups; cross-doc links resolve via the structure index.
  markdown = normalizeOutlineMarkdown(markdown, {
    locale,
    collectionSlug: collection.slug,
    slugToRoute: (outlineSlug) => slugRouteIndex.get(outlineSlug),
  });

  // Bare outline slugs from the "* Translations:" block.
  const translationLinks = extractTranslationLinks(markdown);

  const imageDims = new Map<string, { width?: number; height?: number }>();
  for (const img of processedImages.values()) {
    imageDims.set(img.src, { width: img.width, height: img.height });
  }

  const emitted = await emitBlocks(markdown, {
    locale,
    collectionSlug: collection.slug,
    imageDims,
  });

  // PageDoc.translations carries resolved route paths in other locales.
  const translations: Record<string, string> = {};
  for (const [targetLocale, bareSlug] of Object.entries(translationLinks)) {
    if (!bareSlug) continue;
    const route = slugRouteIndex.get(bareSlug);
    if (route) translations[targetLocale] = route;
  }

  const page = PageDocSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id: ref.docId,
    slug: ref.slug,
    collection: collection.slug,
    locale,
    title: ref.title,
    breadcrumb: ref.breadcrumb,
    createdAt: info.createdAt,
    updatedAt: info.updatedAt,
    headings: emitted.headings,
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
    ...(emitted.underDevelopment ? { underDevelopment: true } : {}),
    blocks: emitted.blocks,
  });

  await writeJson(pageFilePath(locale, collection.slug, ref.slug), page);

  return {
    images: processedImages.size,
    underDevelopment: emitted.underDevelopment,
    translationLinks,
    title: ref.title,
  };
}

// Collection sync

interface BookSyncResult {
  entries: ManifestPage[];
  processedSlugs: Set<string>;
  /** page slug -> declared locale -> bare target slug. */
  translationLinks: Map<string, Partial<Record<Locale, string>>>;
  /** Clients this book is authored for (under-dev flag from organizer body). */
  clients: ClientInfo[];
}

// Sync a single collection across all locales using a pre-fetched structure.
async function syncCollection(
  client: OutlineClient,
  collection: CollectionConfig,
  structure: LocaleStructure,
  args: SyncArgs,
  previousManifests: Map<Locale, LocaleManifest | undefined>,
  slugRouteIndex: Map<string, string>,
): Promise<{ stats: CollectionSyncStats; books: Map<Locale, BookSyncResult> }> {
  const timer = createTimer();
  const stats: CollectionSyncStats = {
    label: collection.label,
    slug: collection.slug,
    duration: 0,
    documentsProcessed: 0,
    documentsSkipped: 0,
    imagesSaved: 0,
    errors: [],
  };
  const books = new Map<Locale, BookSyncResult>();

  console.log(
    `\n${chalk.bold.cyan(collection.label)} ${chalk.gray(`(${collection.slug})`)}`,
  );

  for (const locale of LOCALES) {
    const localeRoot = structure[locale];
    if (!localeRoot) {
      console.log(
        `  ${chalk.yellow("⚠")} ${chalk.gray(`No documents for locale: ${locale}`)}`,
      );
      // Registering an empty book makes the manifest builder drop any
      // previously synced pages for this collection x locale (the docs
      // vanished remotely) and triggers stale-file cleanup.
      books.set(locale, {
        entries: [],
        processedSlugs: new Set(),
        translationLinks: new Map(),
        clients: [],
      });
      continue;
    }

    // Organizer doc bodies carry editor markers (META: toporg,
    // META: platform: <key>, under-development) that shape the book — fetch
    // them BEFORE building so structure decisions can use them. Candidates:
    // organizers in the top three levels (root / wrapper / client children).
    const navChildren = (localeRoot.children ?? []) as OutlineNavNode[];
    const organizerIds: string[] = [];
    const collectOrganizers = (nodes: OutlineNavNode[], depth: number) => {
      for (const node of nodes) {
        if (node.children.length === 0) continue;
        organizerIds.push(node.id);
        if (depth < 3) collectOrganizers(node.children, depth + 1);
      }
    };
    collectOrganizers(navChildren, 1);

    const markerSpinner = createSpinner(
      `Reading organizer markers for ${locale} (${organizerIds.length} organizers)`,
      args.ci,
    );
    await runWithConcurrency(
      organizerIds.map((docId) => async () => {
        if (organizerMarkersCache.has(docId)) return;
        try {
          const body = await client.getDocumentAsMarkdown(docId);
          organizerMarkersCache.set(docId, parseOrganizerMarkers(body));
        } catch {
          // Best-effort: an unreadable organizer just has no markers.
          organizerMarkersCache.set(docId, {
            toporg: false,
            underDevelopment: false,
          });
        }
      }),
      INFO_CONCURRENCY,
    );
    markerSpinner.succeed(`Organizer markers read for ${locale}`);

    const toporgIds = new Set<string>();
    const platformByDocId = new Map<string, Platform>();
    for (const docId of organizerIds) {
      const markers = organizerMarkersCache.get(docId);
      if (markers?.toporg) toporgIds.add(docId);
      if (markers?.platform) platformByDocId.set(docId, markers.platform);
    }

    // Build the book (sidebar + flattened reading order). The locale root
    // itself is a wrapper folder, not a page.
    const sidebarSpinner = createSpinner(
      `Generating sidebar for ${locale}`,
      args.ci,
    );
    const book = buildBook(navChildren, collection, locale, {
      toporgIds,
      platformByDocId,
    });
    await writeJson(
      sidebarFilePath(locale, collection.slug),
      SidebarConfigSchema.parse(book.sidebar),
    );
    sidebarSpinner.succeed(`Sidebar generated for ${locale}`);

    // Selector entries: one per client organizer, under-dev tag from its body.
    const clients: ClientInfo[] = book.clients.map((c) => ({
      id: c.id,
      label: c.label,
      platform: c.platform,
      ...(organizerMarkersCache.get(c.docId)?.underDevelopment
        ? { underDevelopment: true }
        : {}),
    }));

    // Pre-fetch all document info in parallel to populate cache
    const infoSpinner = createSpinner(
      `Fetching document info for ${locale} (${book.readingOrder.length} docs)`,
      args.ci,
    );
    const infoTasks = book.readingOrder.map(
      (ref) => () => getCachedDocumentInfo(client, ref.docId),
    );
    await runWithConcurrency(infoTasks, INFO_CONCURRENCY);
    infoSpinner.succeed(`Document info fetched for ${locale}`);

    // Previous manifest entries by document id (slug renames still match).
    const prevById = new Map<string, ManifestPage>();
    for (const page of previousManifests.get(locale)?.pages ?? []) {
      prevById.set(page.id, page);
    }

    // Incremental check: remote updatedAt vs the committed manifest entry.
    const docStatus = new Map<string, DocSyncStatus>();
    const docsToProcess: BookPageRef[] = [];
    for (const ref of book.readingOrder) {
      const info = documentInfoCache.get(ref.docId);
      if (!info) {
        // documents.info failed for this doc — count it as failed so the
        // previous manifest entry (if any) is preserved and retried next run.
        docStatus.set(ref.docId, "failed");
        stats.errors.push(`${ref.title}: documents.info failed`);
        continue;
      }
      const previous = prevById.get(ref.docId);
      const fileOk = await fs
        .access(pageFilePath(locale, collection.slug, ref.slug))
        .then(
          () => true,
          () => false,
        );
      const localUpdatedAt =
        previous && fileOk ? previous.updatedAt : undefined;
      if (shouldSyncDoc(info.updatedAt, localUpdatedAt, args.force)) {
        docsToProcess.push(ref);
      } else {
        docStatus.set(ref.docId, "skipped");
        stats.documentsSkipped++;
      }
    }

    const processResults = new Map<string, ProcessResult>();

    if (docsToProcess.length === 0) {
      console.log(
        `  ${chalk.blue("ℹ")} ${chalk.gray(`All ${book.readingOrder.length} documents up-to-date for ${locale}`)}`,
      );
    } else {
      // Process documents with progress bar (interactive) or per-doc log lines (CI)
      console.log(
        `  ${chalk.blue("▸")} Processing ${chalk.bold(locale.toUpperCase())} ${chalk.gray(`(${docsToProcess.length}/${book.readingOrder.length} need update)`)}`,
      );

      // Interactive progress bar (suppressed in CI – TTY animations don't render)
      const progressBar = args.ci
        ? null
        : new cliProgress.SingleBar(
            {
              format: `    ${chalk.cyan("{bar}")} ${chalk.gray("|")} {percentage}% ${chalk.gray("|")} {value}/{total} ${chalk.gray("|")} ETA: {eta_formatted} ${chalk.gray("|")} {doc}`,
              barCompleteChar: "█",
              barIncompleteChar: "░",
              hideCursor: true,
              clearOnComplete: false,
              stopOnComplete: true,
              etaBuffer: 5,
            },
            cliProgress.Presets.shades_classic,
          );

      if (progressBar) {
        progressBar.start(docsToProcess.length, 0, {
          doc: "Starting...",
          eta_formatted: "calculating...",
        });
      }

      let processed = 0;
      const startMs = Date.now();

      // Track documents still needing processing; retry failed ones
      let pendingDocs = [...docsToProcess];
      let passFailedDocs: BookPageRef[] = [];

      for (let pass = 0; pass <= MAX_DOC_RETRY_PASSES; pass++) {
        if (pendingDocs.length === 0) break;

        if (pass > 0) {
          console.log(
            `\n  ${chalk.yellow("↻")} Retrying ${chalk.bold(String(pendingDocs.length))} failed documents (pass ${pass}/${MAX_DOC_RETRY_PASSES})...`,
          );
          // Small breather before retry pass to let rate limits reset
          await new Promise((r) => setTimeout(r, RETRY_BREATHER_MS));
        }

        passFailedDocs = [];

        // Process documents with concurrency pool
        const processTasks = pendingDocs.map((ref) => async () => {
          const result = await processDocument(
            client,
            ref,
            collection,
            locale,
            slugRouteIndex,
          );

          processed++;
          const elapsed = (Date.now() - startMs) / 1000;
          const rate = processed / elapsed;
          const remaining = docsToProcess.length - processed;
          const etaSec = rate > 0 ? remaining / rate : 0;
          const etaStr =
            etaSec < 60
              ? `${Math.ceil(etaSec)}s`
              : `${Math.floor(etaSec / 60)}m ${Math.ceil(etaSec % 60)}s`;

          stats.documentsProcessed++;
          stats.imagesSaved += result.images;
          if (progressBar) {
            progressBar.update(processed, {
              doc:
                result.title.substring(0, 40) +
                (result.title.length > 40 ? "..." : ""),
              eta_formatted: etaStr,
            });
          } else {
            const imgMark = result.images > 0 ? ` +${result.images} img` : "";
            console.log(
              `[${ciTimestamp()}] [${processed}/${docsToProcess.length}] ${result.title}${imgMark} (ETA: ${etaStr})`,
            );
          }

          return { result, ref };
        });

        const results = await runWithConcurrency(
          processTasks,
          DOWNLOAD_CONCURRENCY,
        );

        // Collect truly-failed docs for next retry pass
        for (let i = 0; i < results.length; i++) {
          const settled = results[i];
          if (settled.status === "fulfilled") {
            const { result, ref } = settled.value;
            processResults.set(ref.docId, result);
            docStatus.set(ref.docId, "processed");
          } else {
            passFailedDocs.push(pendingDocs[i]);
            const message =
              settled.reason instanceof Error
                ? settled.reason.message
                : String(settled.reason);
            // Only add to stats.errors on the final pass
            if (pass === MAX_DOC_RETRY_PASSES) {
              stats.errors.push(`${pendingDocs[i].title}: ${message}`);
            }
          }
        }

        pendingDocs = passFailedDocs;
      }

      // Any docs still failing after all passes → record in errors
      for (const ref of passFailedDocs) {
        docStatus.set(ref.docId, "failed");
        if (!stats.errors.some((e) => e.startsWith(ref.title))) {
          stats.errors.push(
            `${ref.title}: Failed after ${MAX_DOC_RETRY_PASSES} retry passes`,
          );
        }
      }

      progressBar?.stop();
    }

    // Assemble this book's manifest entries in reading order.
    const entryInputs: BookEntryInput[] = book.readingOrder.map((ref) => ({
      ref,
      updatedAt: documentInfoCache.get(ref.docId)?.updatedAt,
      status: docStatus.get(ref.docId) ?? "failed",
      underDevelopment: processResults.get(ref.docId)?.underDevelopment,
      previous: prevById.get(ref.docId),
    }));
    const entries = buildBookManifestPages(
      locale,
      collection.slug,
      entryInputs,
    );

    const processedSlugs = new Set<string>();
    const translationLinks = new Map<string, Partial<Record<Locale, string>>>();
    for (const ref of book.readingOrder) {
      const result = processResults.get(ref.docId);
      if (!result) continue;
      processedSlugs.add(ref.slug);
      if (Object.keys(result.translationLinks).length > 0) {
        translationLinks.set(ref.slug, result.translationLinks);
      }
    }

    books.set(locale, { entries, processedSlugs, translationLinks, clients });
  }

  stats.duration = timer.elapsed();
  console.log(
    `  ${chalk.green("✓")} Completed in ${chalk.bold(timer.format())}`,
  );

  return { stats, books };
}

// Reporting

// Print sync completion report.
function printCompletionReport(stats: SyncStats): void {
  console.log("\n" + chalk.bold.cyan("═".repeat(60)));
  console.log(chalk.bold.cyan("  SYNC COMPLETION REPORT"));
  console.log(chalk.bold.cyan("═".repeat(60)));

  console.log(`\n${chalk.bold("Collection Results:")}`);
  console.log(chalk.gray("─".repeat(60)));

  for (const collection of stats.collections) {
    const docsPerSec =
      collection.duration > 0
        ? (
            (collection.documentsProcessed / collection.duration) *
            1000
          ).toFixed(2)
        : "N/A";

    console.log(
      `\n  ${chalk.cyan("●")} ${chalk.bold(collection.label)} ${chalk.gray(`(${collection.slug})`)}`,
    );
    console.log(
      `    ${chalk.gray("Duration:")}     ${formatDuration(collection.duration)}`,
    );
    console.log(
      `    ${chalk.gray("Processed:")}    ${chalk.green(collection.documentsProcessed)} documents`,
    );
    console.log(
      `    ${chalk.gray("Skipped:")}      ${chalk.yellow(collection.documentsSkipped)} documents`,
    );
    console.log(
      `    ${chalk.gray("Images:")}       ${chalk.blue(collection.imagesSaved)} files`,
    );
    console.log(`    ${chalk.gray("Speed:")}        ${docsPerSec} docs/sec`);

    if (collection.errors.length > 0) {
      console.log(`    ${chalk.red("Errors:")}`);
      for (const err of collection.errors) {
        console.log(`      ${chalk.red("✖")} ${err}`);
      }
    }
  }

  console.log(`\n${chalk.bold("Summary:")}`);
  console.log(chalk.gray("─".repeat(60)));
  console.log(
    `  ${chalk.gray("Total Collections:")} ${stats.collections.length}`,
  );
  console.log(
    `  ${chalk.gray("Total Processed:")}   ${chalk.green(stats.successfulSyncs)}`,
  );
  console.log(
    `  ${chalk.gray("Total Skipped:")}     ${chalk.yellow(stats.skippedSyncs)}`,
  );
  console.log(
    `  ${chalk.gray("Total Failed:")}      ${stats.failedSyncs > 0 ? chalk.red(stats.failedSyncs) : "0"}`,
  );
  console.log(
    `  ${chalk.gray("Total Images:")}      ${chalk.blue(stats.totalImages)}`,
  );
  console.log(`  ${chalk.gray("Stale Deleted:")}     ${stats.deletedPages}`);
  console.log(
    `  ${chalk.gray("Total Duration:")}    ${chalk.bold(formatDuration(stats.endTime! - stats.startTime))}`,
  );

  console.log(`\n${chalk.green("✓")} ${chalk.bold("Sync complete!")}\n`);
}

// Main

async function main() {
  const args = parseSyncArgs(process.argv.slice(2));

  console.log(chalk.bold.cyan("\n▸ Outline Wiki Sync\n"));

  if (args.force) {
    console.log(
      chalk.yellow("⚠ Force mode enabled - re-downloading all documents\n"),
    );
  }

  if (args.ci) {
    console.log(
      `[${ciTimestamp()}] CI mode enabled – animations suppressed, per-document logging active`,
    );
  }

  // Validate configuration
  const configSpinner = createSpinner("Validating configuration", args.ci);
  try {
    validateCollectionConfig();
    configSpinner.succeed("Configuration validated");
  } catch (error) {
    configSpinner.fail("Configuration error");
    console.error(chalk.red("Error:"), error);
    process.exit(1);
  }

  const client = createOutlineClient();

  // Filter collections if specified
  const collectionsToSync = args.collection
    ? ALL_COLLECTIONS.filter((c) =>
        collectionMatchesFilter(c, args.collection!),
      )
    : ALL_COLLECTIONS;

  if (collectionsToSync.length === 0) {
    console.error(
      chalk.red(`✖ No collections found matching: ${args.collection}`),
    );
    process.exit(1);
  }

  // Show which collections will be synced
  if (args.collection) {
    console.log(
      chalk.cyan(`📁 Syncing collections matching "${args.collection}":`),
    );
    for (const c of collectionsToSync) {
      console.log(chalk.gray(`   • ${c.label} (${c.slug})`));
    }
    console.log();
  }

  // Initialize stats
  const stats: SyncStats = {
    startTime: Date.now(),
    successfulSyncs: 0,
    failedSyncs: 0,
    skippedSyncs: 0,
    totalImages: 0,
    deletedPages: 0,
    collections: [],
  };

  // Load the previously committed manifests; they drive the incremental
  // check and carry over pages of collections not synced this run.
  const previousManifests = new Map<Locale, LocaleManifest | undefined>();
  for (const locale of LOCALES) {
    const manifest = await readJsonIfExists<LocaleManifest>(
      manifestFilePath(locale),
    );
    previousManifests.set(
      locale,
      manifest && Array.isArray(manifest.pages) ? manifest : undefined,
    );
  }

  // First pass: fetch each collection structure once and build the global
  // outline-slug -> route index used for cross-doc link resolution.
  const structureSpinner = createSpinner(
    "Collecting document structures",
    args.ci,
  );

  const structureCache = new Map<string, LocaleStructure>();
  const slugRouteIndex = new Map<string, string>();
  let totalDocs = 0;

  for (const collection of collectionsToSync) {
    const structure = collection.noLocale
      ? await client.getCollectionStructureFlat(
          collection.collectionId,
          collection.slug,
          collection.label,
        )
      : await client.getCollectionStructure(
          collection.collectionId,
          collection.slug,
        );
    structureCache.set(collection.collectionId, structure);

    for (const locale of LOCALES) {
      const root = structure[locale];
      if (!root) continue;
      const walk = (node: OutlineNavNode) => {
        const slug = slugFromUrl(node.url);
        slugRouteIndex.set(slug, `/${locale}/${collection.slug}/${slug}`);
        totalDocs++;
        for (const child of node.children ?? []) walk(child);
      };
      // The locale root (or synthetic noLocale root) is a wrapper, not a page.
      for (const child of (root.children ?? []) as OutlineNavNode[])
        walk(child);
    }
  }

  structureSpinner.succeed(`Found ${chalk.bold(totalDocs)} total documents`);

  // Second pass: sync each collection (using cached structures)
  const syncedBooks = new Map<Locale, Map<string, ManifestPage[]>>();
  const syncedClients = new Map<Locale, Map<string, ClientInfo[]>>();
  const processedSlugsByLocale = new Map<Locale, Set<string>>();
  const translationLinksByLocale = new Map<
    Locale,
    Map<string, Partial<Record<Locale, string>>>
  >();
  for (const locale of LOCALES) {
    syncedBooks.set(locale, new Map());
    syncedClients.set(locale, new Map());
    processedSlugsByLocale.set(locale, new Set());
    translationLinksByLocale.set(locale, new Map());
  }

  for (const collection of collectionsToSync) {
    try {
      const { stats: collectionStats, books } = await syncCollection(
        client,
        collection,
        structureCache.get(collection.collectionId)!,
        args,
        previousManifests,
        slugRouteIndex,
      );

      stats.collections.push(collectionStats);
      stats.successfulSyncs += collectionStats.documentsProcessed;
      stats.skippedSyncs += collectionStats.documentsSkipped;
      stats.failedSyncs += collectionStats.errors.length;
      stats.totalImages += collectionStats.imagesSaved;

      for (const [locale, book] of books) {
        syncedBooks.get(locale)!.set(collection.slug, book.entries);
        syncedClients.get(locale)!.set(collection.slug, book.clients);
        const processedSlugs = processedSlugsByLocale.get(locale)!;
        for (const slug of book.processedSlugs) processedSlugs.add(slug);
        const links = translationLinksByLocale.get(locale)!;
        for (const [slug, targets] of book.translationLinks) {
          links.set(slug, targets);
        }
      }
    } catch (error) {
      // A collection that failed wholesale stays untouched: its previous
      // manifest entries are carried over and no files are cleaned up.
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `\n${chalk.red("✖")} Failed to sync ${collection.label}: ${message}`,
      );
      stats.failedSyncs++;
    }
  }

  // Write manifests (all locales; non-synced collections carried over).
  console.log(`\n${chalk.bold("Generating manifests...")}`);
  const manifestSpinner = createSpinner("Writing locale manifests", args.ci);

  const generatedAt = new Date().toISOString();
  const newManifests = new Map<Locale, LocaleManifest>();
  for (const locale of LOCALES) {
    const manifest = LocaleManifestSchema.parse(
      buildLocaleManifest({
        locale,
        collections: ALL_COLLECTIONS,
        syncedPages: syncedBooks.get(locale)!,
        syncedClients: syncedClients.get(locale)!,
        previous: previousManifests.get(locale),
        generatedAt,
      }),
    );
    await writeJson(manifestFilePath(locale), manifest);
    newManifests.set(locale, manifest);
    manifestSpinner.text = `Manifest written for ${locale} (${manifest.pages.length} pages)`;
  }
  manifestSpinner.succeed("Locale manifests written");

  // Translations: bare slug -> locale -> route path, enriched across all
  // locales' fresh manifests (collection prefixes included).
  const slugRoutes = buildSlugRouteMap(newManifests.values());
  for (const locale of LOCALES) {
    const manifest = newManifests.get(locale)!;
    const translations = buildTranslationsFile({
      newLinks: translationLinksByLocale.get(locale)!,
      slugRoutes,
      validSlugs: new Set(manifest.pages.map((p) => p.slug)),
      processedSlugs: processedSlugsByLocale.get(locale)!,
      previous: await readJsonIfExists<TranslationsFile>(
        translationsFilePath(locale),
      ),
    });
    await writeJson(translationsFilePath(locale), translations);
  }

  // Stale cleanup: within collections synced this run, delete page files
  // whose slug is no longer in the new manifest (docs vanished remotely or
  // were renamed).
  for (const locale of LOCALES) {
    const manifest = newManifests.get(locale)!;
    for (const collectionSlug of syncedBooks.get(locale)!.keys()) {
      const dir = path.join(
        CONTENT_ROOT,
        locale,
        "pages",
        ...collectionSlug.split("/"),
      );
      const valid = new Set(
        manifest.pages
          .filter((p) => p.collection === collectionSlug)
          .map((p) => p.slug),
      );
      for (const slug of staleSlugs(await listJsonSlugs(dir), valid)) {
        await fs.unlink(path.join(dir, `${slug}.json`));
        stats.deletedPages++;
        if (args.verbose) {
          console.log(
            `  ${chalk.red("✖")} Deleted stale page ${locale}/${collectionSlug}/${slug}.json`,
          );
        }
      }
    }
  }

  stats.endTime = Date.now();
  printCompletionReport(stats);
}

main().catch((err) => {
  console.error(`\n${chalk.red("✖")} Sync failed:`, err.message || err);
  process.exit(1);
});
