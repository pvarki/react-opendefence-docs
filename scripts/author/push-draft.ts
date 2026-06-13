#!/usr/bin/env tsx

/**
 * Push a local guide draft to Outline: upload its screenshots as attachments,
 * then create-or-update the leaf page (and an optional chapter organizer) under
 * the right platform organizer. The existing `pnpm sync` then pulls it into the
 * app — this script only writes to Outline.
 *
 *   pnpm author:push <draftDir> [--chapter "Title"] [--publish] [--dry-run]
 *
 * Examples:
 *   pnpm author:push drafts/deploy-app/android/install-deploy-app --dry-run
 *   pnpm author:push drafts/deploy-app/android/install-deploy-app --chapter "Getting Started"
 *   pnpm author:push drafts/matrix/_/join-a-room --publish
 *
 * The draft folder path encodes the target: drafts/<product>/<platform>/<slug>
 * ("_" platform = platform-agnostic book → pages hang off the En locale root).
 * Default is an UNPUBLISHED Outline draft; pass --publish once reviewed.
 */
import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";

import { createOutlineClient } from "../lib/outline-api";
import { getPlatform, getProduct } from "./products";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const publish = args.includes("--publish");
const chapterIdx = args.indexOf("--chapter");
const chapter = chapterIdx >= 0 ? args[chapterIdx + 1] : undefined;
const chapterValueIdx = chapterIdx >= 0 ? chapterIdx + 1 : -1;
const draftArg = args.find(
  (a, i) => !a.startsWith("--") && i !== chapterValueIdx,
);

if (!draftArg) {
  console.error(
    'Usage: pnpm author:push <draftDir> [--chapter "Title"] [--publish] [--dry-run]',
  );
  process.exit(1);
}

const draftDir = resolve(process.cwd(), draftArg);

// drafts/<product>/<platform>/<slug>
const segments = draftDir.split(sep);
const dIdx = segments.lastIndexOf("drafts");
if (dIdx < 0 || segments.length < dIdx + 4) {
  console.error(
    `Draft path must look like drafts/<product>/<platform>/<slug>, got "${draftArg}"`,
  );
  process.exit(1);
}
const [productKey, platformKey] = segments.slice(dIdx + 1, dIdx + 4);

const guidePath = join(draftDir, "guide.md");
if (!existsSync(guidePath)) {
  console.error(`No guide.md in ${draftDir}`);
  process.exit(1);
}

// --- parse the draft -------------------------------------------------------
const raw = readFileSync(guidePath, "utf-8");

const titleMatch = raw.match(/^#\s+(.+?)\s*$/m);
if (!titleMatch) {
  console.error("guide.md must start with a single `# Title` line.");
  process.exit(1);
}
const title = titleMatch[1].trim();
// Strip the H1 (Outline stores the title separately) and any leading blanks.
const body = raw.replace(titleMatch[0], "").replace(/^\s+/, "");

// Image refs: ![alt](url) with an optional "caption". Keep alt + caption.
const IMG_RE = /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;
interface LocalImage {
  ref: string; // original url as written
  abs: string; // resolved absolute path on disk
}
const localImages = new Map<string, LocalImage>();
for (const m of raw.matchAll(IMG_RE)) {
  const url = m[2];
  if (/^https?:\/\//i.test(url)) continue; // already hosted
  const abs = isAbsolute(url) ? url : resolve(draftDir, url);
  if (!localImages.has(url)) localImages.set(url, { ref: url, abs });
}

const missing = [...localImages.values()].filter((i) => !existsSync(i.abs));

// --- resolve the target ----------------------------------------------------
const product = getProduct(productKey);
const client = createOutlineClient();

async function resolveParentId(): Promise<string> {
  if (platformKey === "_") {
    // Platform-agnostic: hang off the En locale root.
    const tops = await client.getCollectionDocuments(product.collectionId);
    const en =
      tops.find((d) => /^en$/i.test(d.title.trim())) ??
      (tops.length === 1 ? tops[0] : undefined);
    if (!en) {
      throw new Error(
        `Could not find an "en" locale root in collection ${product.collectionId}. Top-level docs: ${tops
          .map((d) => d.title)
          .join(", ")}`,
      );
    }
    return en.id;
  }
  return getPlatform(product, platformKey).organizerId;
}

async function findChildByTitle(
  parentId: string,
  childTitle: string,
): Promise<{ id: string; title: string } | undefined> {
  const children = await client.listDocuments({
    collectionId: product.collectionId,
    parentDocumentId: parentId,
  });
  const want = childTitle.trim().toLowerCase();
  return children.find((c) => c.title.trim().toLowerCase() === want);
}

async function main() {
  console.log(`Draft:    ${draftArg}`);
  console.log(`Product:  ${product.key} (${product.collectionId})`);
  console.log(`Platform: ${platformKey}`);
  console.log(`Title:    ${title}`);
  if (chapter) console.log(`Chapter:  ${chapter}`);
  console.log(
    `Publish:  ${publish ? "yes" : "no (unpublished Outline draft)"}`,
  );
  console.log(
    `Images:   ${localImages.size} local${missing.length ? `, ${missing.length} MISSING` : ""}`,
  );
  for (const img of localImages.values()) {
    console.log(`  ${existsSync(img.abs) ? "·" : "✗"} ${img.ref}`);
  }

  if (missing.length) {
    console.error(
      `\n✗ ${missing.length} referenced screenshot(s) not found on disk:`,
    );
    for (const m of missing) console.error(`    ${m.abs}`);
    process.exit(1);
  }

  // Resolve hierarchy (read-only — safe in dry-run too).
  const platformParentId = await resolveParentId();
  let parentId = platformParentId;
  let chapterExisting: { id: string; title: string } | undefined;
  if (chapter) {
    chapterExisting = await findChildByTitle(platformParentId, chapter);
    if (chapterExisting) parentId = chapterExisting.id;
  }
  const leafParentForLookup = chapterExisting?.id ?? platformParentId;
  const existingLeaf = await findChildByTitle(leafParentForLookup, title);

  console.log(`\nParent organizer: ${platformParentId}`);
  if (chapter) {
    console.log(
      `Chapter "${chapter}": ${chapterExisting ? `exists (${chapterExisting.id})` : "will be CREATED"}`,
    );
  }
  console.log(
    `Leaf page "${title}": ${existingLeaf ? `exists (${existingLeaf.id}) → UPDATE` : "will be CREATED"}`,
  );

  if (dryRun) {
    console.log("\n(dry run — no uploads or writes performed)");
    return;
  }

  // 1) Create the chapter organizer if needed.
  if (chapter && !chapterExisting) {
    const created = await client.createDocument({
      collectionId: product.collectionId,
      parentDocumentId: platformParentId,
      title: chapter,
      text: "",
      publish: true, // organizers are structural — always published
    });
    parentId = created.id;
    console.log(`+ created chapter "${chapter}" → ${created.url}`);
    await sleep(150);
  }

  // 2) Upload screenshots and rewrite refs to absolute attachment URLs.
  const urlByRef = new Map<string, string>();
  for (const img of localImages.values()) {
    const { url } = await client.uploadAttachment(img.abs);
    urlByRef.set(img.ref, url);
    console.log(`↑ uploaded ${img.ref} → ${url}`);
    await sleep(150);
  }
  const finalBody = body.replace(
    IMG_RE,
    (_full: string, pre: string, url: string, post: string) =>
      /^https?:\/\//i.test(url)
        ? `${pre}${url}${post}`
        : `${pre}${urlByRef.get(url) ?? url}${post}`,
  );

  // 3) Create or update the leaf page.
  if (existingLeaf) {
    await client.updateDocument(existingLeaf.id, finalBody, { publish });
    console.log(`✓ updated leaf page "${title}" (${existingLeaf.id})`);
  } else {
    const created = await client.createDocument({
      collectionId: product.collectionId,
      parentDocumentId: parentId,
      title,
      text: finalBody,
      publish,
    });
    console.log(`✓ created leaf page "${title}" → ${created.url}`);
  }

  console.log(
    publish
      ? "\nDone. Run `pnpm sync` to pull it into the app."
      : "\nDone (unpublished). Review in Outline, publish, then run `pnpm sync`.",
  );
}

main().catch((err: unknown) => {
  console.error("push-draft failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
