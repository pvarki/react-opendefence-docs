#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-06-26): fix broken internal links in the three
 * "References" docs of the working-with-tak collection.
 *
 * The links point at CHAPTER ORGANIZER docs, which the sync never emits as
 * pages — so they 404 (and `pnpm validate:docs` flags broken-internal-link).
 * Fix: repoint each chapter link to that chapter's first content page; the
 * "Wire up two Federation Hubs (IaC)" chapter has no published pages, so that
 * link is unlinked (its visible text is kept).
 *
 * Safety: every source AND target doc's current title is verified before any
 * write; a single mismatch aborts before touching anything. Edits replace only
 * the link slug substrings (or convert one `[text](url)` to `text`); the rest
 * of each body is preserved verbatim. documents.update creates a recoverable
 * revision (Outline history). After running, sync the collection:
 *   pnpm tsx scripts/sync-outline.ts --collection working-with-tak
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-06-26-fix-tak-reference-links.ts            # dry-run
 *   pnpm tsx scripts/oneoff/2026-06-26-fix-tak-reference-links.ts --apply    # write
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

// Source "References" docs (Outline urlId = trailing shortid of the synced slug).
const SOURCES = ["KdqJO1rcQ0", "jcEIPLZieK", "n9W8lB6Gpz"];
const SOURCE_TITLE = "References";

// Chapter-organizer slug → first-content-page slug (both are full Outline
// path slugs: title-slug + shortid). Verified present in the en manifest.
const REPOINT: Record<string, string> = {
  "federation-hub-connecting-multiple-tak-servers-pfBog3Q9uI":
    "how-the-federation-hub-works-kfYEsVehxZ",
  "integrating-to-tak-server-i19y5KVtNV": "how-tak-server-works-a3STsGkoWB",
  "wire-up-deploy-app-tak-servers-via-a-federation-hub-iac-7b653SFdyn":
    "the-iac-trust-model-oJJLybgejE",
};

// Chapter with no published pages → unlink (keep the link text as plain text).
const UNLINK = ["wire-up-two-federation-hubs-iac-fzNcHRftqI"];

// Target docs whose existence/titles we verify before repointing onto them.
const TARGET_TITLES: Record<string, string> = {
  "how-the-federation-hub-works-kfYEsVehxZ": "How the Federation Hub works",
  "how-tak-server-works-a3STsGkoWB": "How TAK Server works",
  "the-iac-trust-model-oJJLybgejE": "The IaC trust model",
};

const APPLY = process.argv.includes("--apply");
const client = createOutlineClient();

/** Apply slug repoints + unlinks; return new text and a list of changes. */
function fixLinks(text: string): { out: string; changes: string[] } {
  let out = text;
  const changes: string[] = [];

  for (const [oldSlug, newSlug] of Object.entries(REPOINT)) {
    if (out.includes(oldSlug)) {
      out = out.split(oldSlug).join(newSlug);
      changes.push(`repoint  ${oldSlug}  →  ${newSlug}`);
    }
  }

  for (const slug of UNLINK) {
    const re = new RegExp(
      `\\[([^\\]]+)\\]\\((?:https?:\\/\\/[^)]+)?\\/doc\\/${slug}[^)]*\\)`,
      "g",
    );
    if (re.test(out)) {
      out = out.replace(
        new RegExp(
          `\\[([^\\]]+)\\]\\((?:https?:\\/\\/[^)]+)?\\/doc\\/${slug}[^)]*\\)`,
          "g",
        ),
        "$1",
      );
      changes.push(`unlink   ${slug}  (kept link text as plain text)`);
    }
  }

  return { out, changes };
}

async function titleOf(id: string): Promise<string> {
  return (await client.getDocumentInfo(id)).title;
}

// 1) Verify target docs exist with their expected titles.
let mismatch = false;
for (const [slug, expected] of Object.entries(TARGET_TITLES)) {
  try {
    const actual = await titleOf(slug);
    if (actual !== expected) {
      console.error(
        `✗ target "${slug}" title is "${actual}", expected "${expected}"`,
      );
      mismatch = true;
    }
  } catch (e) {
    console.error(`✗ target "${slug}" not found: ${(e as Error).message}`);
    mismatch = true;
  }
}

// 2) Verify source docs are the "References" docs we expect.
for (const id of SOURCES) {
  try {
    const actual = await titleOf(id);
    if (actual !== SOURCE_TITLE) {
      console.error(
        `✗ source "${id}" title is "${actual}", expected "${SOURCE_TITLE}"`,
      );
      mismatch = true;
    }
  } catch (e) {
    console.error(`✗ source "${id}" not found: ${(e as Error).message}`);
    mismatch = true;
  }
}

if (mismatch) {
  console.error("\nAborting: verification failed, nothing was written.");
  process.exit(1);
}

// 3) Edit each source doc.
console.log(APPLY ? "APPLYING changes\n" : "DRY RUN (pass --apply to write)\n");
for (const id of SOURCES) {
  const text = await client.getDocumentText(id);
  const { out, changes } = fixLinks(text);
  console.log(`=== References (${id}) ===`);
  if (!changes.length) {
    console.log("  no matching broken links found\n");
    continue;
  }
  changes.forEach((c) => console.log(`  • ${c}`));
  if (APPLY) {
    await client.updateDocument(id, out);
    console.log("  ✔ written to Outline\n");
  } else {
    console.log("  (dry-run — not written)\n");
  }
}

console.log(
  APPLY
    ? "Done. Now: pnpm tsx scripts/sync-outline.ts --collection working-with-tak"
    : "Dry run complete. Re-run with --apply to write.",
);
