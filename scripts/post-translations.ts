/**
 * post-translations.ts
 *
 * Posts translated guide content from the local draft folder to Outline.
 *
 * Usage:
 *   pnpm tsx scripts/post-translations.ts --locale fi [--guide tak-guide] [--dry-run]
 *   pnpm tsx scripts/post-translations.ts --locale sv --guide all
 *   pnpm tsx scripts/post-translations.ts --locale fi --guide cryptpad-guide --dry-run
 *
 * Draft folder layout (produced by the translation workflow):
 *   /tmp/opendefence-draft-translations/{locale}/{guide-slug}/{platform?}/{page}.md
 *
 * Posting creates under the locale root:
 *   1. A "Platforms" organizer (META: platforms-container) — if guide has platforms
 *   2. Per-platform organizers with META markers from a .organizer.json sidecar
 *   3. Per-chapter organizers
 *   4. Leaf page documents from .md files
 *
 * Sidecar files (optional, placed alongside the platform folder):
 *   {platform}/.organizer.json   — { title, markers: string[], chapters: { [name]: string[] } }
 *     title: display title of the platform organizer
 *     markers: extra META: lines to include in the organizer body
 *     chapters: { "Chapter Name": [] } — empty arrays mean no explicit chapter pages
 *
 * After posting run: pnpm sync:outline --force
 * to pull the new locale docs into public/content/{locale}/.
 */

import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, basename, extname } from "path";
import { createOutlineClient } from "./lib/outline-api";
import { ALL_COLLECTIONS } from "../config/collections";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const LOCALE_RAW = getArg("--locale");
const GUIDE_FILTER = getArg("--guide") ?? "all";
const DRY_RUN = args.includes("--dry-run");

if (!LOCALE_RAW || !["fi", "sv"].includes(LOCALE_RAW)) {
  console.error(
    "Usage: post-translations.ts --locale <fi|sv> [--guide <slug>] [--dry-run]",
  );
  process.exit(1);
}

const LOCALE = LOCALE_RAW as string;

const DRAFT_ROOT = `/tmp/opendefence-draft-translations/${LOCALE}`;

if (!existsSync(DRAFT_ROOT)) {
  console.error(`Draft folder not found: ${DRAFT_ROOT}`);
  console.error("Generate translation drafts first.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Guide slug → Outline collection UUID + draft folder name mapping
// ---------------------------------------------------------------------------

const GUIDE_DRAFT_FOLDER: Record<string, string> = {
  "deploy-app": "deploy-guide",
  "guides/tak-guide": "tak-guide",
  "guides/mtx-guide": "mtx-guide",
  "guides/matrix-guide": "matrix-guide",
  "guides/cryptpad-guide": "cryptpad-guide",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}

function dryLog(msg: string) {
  console.log(`[dry-run] ${msg}`);
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function readMarkdown(p: string): Promise<string> {
  return readFile(p, "utf8");
}

async function listEntries(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

interface OrganizerMeta {
  title: string;
  markers: string[];
}

async function readOrganizerMeta(dir: string): Promise<OrganizerMeta | null> {
  const sidcarPath = join(dir, ".organizer.json");
  if (!existsSync(sidcarPath)) return null;
  try {
    return JSON.parse(await readFile(sidcarPath, "utf8")) as OrganizerMeta;
  } catch {
    return null;
  }
}

function buildOrganizerBody(markers: string[]): string {
  return markers.map((m) => `META: ${m}`).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Outline client + collection structure helpers
// ---------------------------------------------------------------------------

const client = createOutlineClient();

interface LocaleRootInfo {
  id: string;
  title: string;
}

async function findLocaleRoot(
  collectionId: string,
  locale: string,
): Promise<LocaleRootInfo | null> {
  const structure = await client.getCollectionStructure(collectionId, "");
  const root = structure[locale as keyof typeof structure];
  if (!root) {
    log(
      `  ⚠  No ${locale.toUpperCase()} locale root found in collection ${collectionId}`,
    );
    return null;
  }
  return { id: root.id, title: root.title };
}

// ---------------------------------------------------------------------------
// Posting logic
// ---------------------------------------------------------------------------

async function createOrganizer(
  collectionId: string,
  parentId: string,
  title: string,
  markers: string[],
): Promise<string> {
  const body = buildOrganizerBody(markers);
  if (DRY_RUN) {
    dryLog(`  CREATE organizer "${title}" (parent: ${parentId})`);
    dryLog(`    body: ${body.trim()}`);
    return `dry-run-id-${title.toLowerCase().replace(/\s/g, "-")}`;
  }
  const doc = await client.createDocument({
    collectionId,
    parentDocumentId: parentId,
    title,
    text: body,
    publish: true,
  });
  log(`  ✓ Created organizer "${title}" → ${doc.id}`);
  return doc.id;
}

async function postLeafPage(
  collectionId: string,
  parentId: string,
  filePath: string,
): Promise<void> {
  const title = basename(filePath, extname(filePath)).replace(/-/g, " ");
  const text = await readMarkdown(filePath);
  // Extract actual title from first H1 if present
  const h1Match = text.match(/^#\s+(.+)$/m);
  const docTitle = h1Match ? h1Match[1].trim() : title;

  if (DRY_RUN) {
    dryLog(
      `  CREATE page "${docTitle}" (parent: ${parentId}) from ${filePath}`,
    );
    return;
  }
  const doc = await client.createDocument({
    collectionId,
    parentDocumentId: parentId,
    title: docTitle,
    text,
    publish: true,
  });
  log(`  ✓ Created page "${docTitle}" → ${doc.id}`);
}

// ---------------------------------------------------------------------------
// Process one guide draft folder
// ---------------------------------------------------------------------------

async function processGuide(
  collection: (typeof ALL_COLLECTIONS)[0],
  draftDir: string,
): Promise<void> {
  log(`\n=== ${collection.label} (${LOCALE}) ===`);
  log(`    collection: ${collection.collectionId}`);
  log(`    draft:      ${draftDir}`);

  const localeRoot = await findLocaleRoot(collection.collectionId, LOCALE);
  if (!localeRoot) return;

  log(`    locale root "${localeRoot.title}" → ${localeRoot.id}`);

  const entries = await listEntries(draftDir);
  if (entries.length === 0) {
    log(`    (no draft files found)`);
    return;
  }

  // Separate platform-agnostic top-level .md files from platform subdirectories
  const topLevelPages: string[] = [];
  const platformDirs: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(draftDir, entry);
    if (await isDir(fullPath)) {
      platformDirs.push(entry);
    } else if (entry.endsWith(".md")) {
      topLevelPages.push(fullPath);
    }
  }

  // Post platform-agnostic leaf pages directly under locale root
  for (const page of topLevelPages) {
    await postLeafPage(collection.collectionId, localeRoot.id, page);
  }

  // If there are platform dirs, create a "Platforms" wrapper first
  if (platformDirs.length > 0) {
    const platformsId = await createOrganizer(
      collection.collectionId,
      localeRoot.id,
      "Platforms",
      ["platforms-container"],
    );

    for (const platformDirName of platformDirs) {
      const platformDir = join(draftDir, platformDirName);
      const meta = await readOrganizerMeta(platformDir);
      const platformTitle = meta?.title ?? platformDirName.replace(/-/g, " ");
      const platformMarkers = meta?.markers ?? [];

      const platformId = await createOrganizer(
        collection.collectionId,
        platformsId,
        platformTitle,
        platformMarkers,
      );

      // Chapters are subdirectories; loose .md files are chapterless pages
      const platformEntries = await listEntries(platformDir);
      const chapterDirs: string[] = [];
      const chapterlessPages: string[] = [];

      for (const entry of platformEntries) {
        if (entry.startsWith(".")) continue;
        const fullPath = join(platformDir, entry);
        if (await isDir(fullPath)) {
          chapterDirs.push(entry);
        } else if (entry.endsWith(".md")) {
          chapterlessPages.push(fullPath);
        }
      }

      for (const page of chapterlessPages) {
        await postLeafPage(collection.collectionId, platformId, page);
      }

      for (const chapterDirName of chapterDirs) {
        const chapterDir = join(platformDir, chapterDirName);
        const chapterMeta = await readOrganizerMeta(chapterDir);
        const chapterTitle =
          chapterMeta?.title ?? chapterDirName.replace(/-/g, " ");

        const chapterId = await createOrganizer(
          collection.collectionId,
          platformId,
          chapterTitle,
          chapterMeta?.markers ?? [],
        );

        const pageFiles = (await listEntries(chapterDir))
          .filter((f) => f.endsWith(".md") && !f.startsWith("."))
          .map((f) => join(chapterDir, f));

        for (const page of pageFiles) {
          await postLeafPage(collection.collectionId, chapterId, page);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(
    `\npost-translations — locale: ${LOCALE}, guide: ${GUIDE_FILTER}${DRY_RUN ? " [DRY RUN]" : ""}`,
  );
  log("=".repeat(60));

  const guideEntries = Object.entries(GUIDE_DRAFT_FOLDER).filter(
    ([slug]) =>
      GUIDE_FILTER === "all" ||
      slug === GUIDE_FILTER ||
      slug.endsWith(`/${GUIDE_FILTER}`),
  );

  if (guideEntries.length === 0) {
    console.error(
      `No guide matched "${GUIDE_FILTER}". Available: ${Object.keys(GUIDE_DRAFT_FOLDER).join(", ")}`,
    );
    process.exit(1);
  }

  for (const [slug, draftFolder] of guideEntries) {
    const collection = ALL_COLLECTIONS.find((c) => c.slug === slug);
    if (!collection) {
      log(`\n⚠  No collection config found for slug "${slug}", skipping.`);
      continue;
    }

    const draftDir = join(DRAFT_ROOT, draftFolder);
    if (!existsSync(draftDir)) {
      log(`\n⚠  Draft folder not found: ${draftDir}, skipping.`);
      continue;
    }

    await processGuide(collection, draftDir);
  }

  log(`\n✓ Done.${DRY_RUN ? " (dry run — nothing was posted)" : ""}`);
  if (!DRY_RUN) {
    log("\nNext step: pnpm sync:outline --force");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
