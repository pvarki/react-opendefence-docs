#!/usr/bin/env tsx

/**
 * Fetch an existing Outline page's raw markdown, so a draft can convert/augment
 * it instead of starting blank. Read-only — never writes to Outline.
 *
 *   pnpm author:fetch <product> <platform> "<Chapter/Path>" "<Page Title>"
 *
 * Example:
 *   pnpm author:fetch tak atak "USING ATAK FEATURES/Basic Features" "Sending a Marker"
 *
 * Walks the (possibly nested) chapter path under the platform organizer exactly
 * like author:push, finds the leaf page by title, and prints its markdown body
 * to stdout. Exits non-zero if the page can't be found.
 */
import "dotenv/config";

import { createOutlineClient } from "../lib/outline-api";
import { getPlatform, getProduct } from "./products";

const argv = process.argv.slice(2);
const canonical = argv.includes("--canonical");
const positional = argv.filter((a) => !a.startsWith("--"));
const [productKey, platformKey, chapterPath, pageTitle] = positional;

if (!productKey || !platformKey || !pageTitle) {
  console.error(
    'Usage: pnpm author:fetch <product> <platform> "<Chapter/Path>" "<Page Title>" [--canonical]',
  );
  process.exit(1);
}

const ORIGIN = (
  process.env.OUTLINE_API_BASE || "https://pvarki.getoutline.com/api"
).replace(/\/api\/?$/, "");

/**
 * Convert a legacy fenced slideset (```markdown … ``` with `[picN]` refs + a
 * `## Pictures:` map) into the canonical `META: slides` format, keeping each
 * slide's hosted image. Already-canonical bodies pass through (just re-wrapped
 * with the H1 + marker and absolute image URLs). Returns the full guide.md body.
 */
function toCanonical(raw: string, title: string): string {
  const absolutize = (u: string) => (u.startsWith("/") ? `${ORIGIN}${u}` : u);

  // Split off the "Pictures" definition list (picN → url); colon is optional.
  const parts = raw.split(/^#{1,6}\s*Pictures\s*:?\s*$/im);
  const main = parts[0];
  const picPart = parts.slice(1).join("\n");

  const picMap = new Map<string, string>();
  for (const m of picPart.matchAll(
    /\*\s*(pic\d+)\b[\s\S]*?!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g,
  )) {
    picMap.set(m[1], absolutize(m[2]));
  }

  // The slides live inside the ```markdown … ``` fence when present; any
  // pre-fence heading is a redundant title (dropped) and post-fence prose
  // (e.g. wiki cross-links) is kept as a tail on the last slide.
  let slidesText = main;
  let tail = "";
  const fence = main.match(/```[a-z]*\s*\n([\s\S]*?)```/i);
  if (fence) {
    slidesText = fence[1];
    tail = main.slice((fence.index ?? 0) + fence[0].length);
  }

  let body = slidesText.replace(/^\s*---\s*$/gm, ""); // drop legacy separators

  // Inline each [picN] as its hosted image (first image in an H2 = slide image).
  body = body.replace(/\[(pic\d+)\]/g, (_full, p: string) => {
    const url = picMap.get(p);
    return url ? `\n\n![](${url})\n` : "";
  });

  const cleanTail = tail.replace(/^\s*---\s*$/gm, "").trim();
  if (cleanTail) body += `\n\n${cleanTail}`;

  // Absolutize any already-inline attachment refs and drop size-hint titles.
  body = body.replace(
    /(!\[[^\]]*\]\()\s*([^)\s]+)(?:\s+"[^"]*")?\s*(\))/g,
    (_full, pre: string, url: string, post: string) =>
      `${pre}${absolutize(url)}${post}`,
  );

  body = body
    .replace(/^#[ \t]+/gm, "## ") // any stray single-# heading → slide H2
    .replace(/^META:\s*slides\s*$/gim, "") // we re-add the marker once
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `# ${title}\n\nMETA: slides\n\n${body}\n`;
}

const product = getProduct(productKey);
const client = createOutlineClient();

async function findChildByTitle(parentId: string, title: string) {
  const children = await client.listDocuments({
    collectionId: product.collectionId,
    parentDocumentId: parentId,
  });
  const want = title.trim().toLowerCase();
  return children.find((c) => c.title.trim().toLowerCase() === want);
}

async function main() {
  let parentId: string;
  if (platformKey === "_") {
    const tops = await client.getCollectionDocuments(product.collectionId);
    const en =
      tops.find((d) => /^en$/i.test(d.title.trim())) ??
      (tops.length === 1 ? tops[0] : undefined);
    if (!en) throw new Error("No en locale root found");
    parentId = en.id;
  } else {
    parentId = getPlatform(product, platformKey).organizerId;
  }

  const segments = (chapterPath ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const next = await findChildByTitle(parentId, seg);
    if (!next)
      throw new Error(`Organizer "${seg}" not found under ${parentId}`);
    parentId = next.id;
  }

  const leaf = await findChildByTitle(parentId, pageTitle);
  if (!leaf) throw new Error(`Page "${pageTitle}" not found in that chapter`);

  const text = await client.getDocumentText(leaf.id);
  process.stdout.write(canonical ? toCanonical(text, pageTitle) : text);
}

main().catch((err: unknown) => {
  console.error(
    "fetch-chapter failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
