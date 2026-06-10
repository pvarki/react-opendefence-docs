/**
 * Build the pagefind full-text index from the emitted content JSON.
 *
 * Runs as `prebuild` so dist/ always carries a fresh index; the output dir
 * (public/pagefind/) is gitignored — it is derived data. Pagefind keeps one
 * index per language, with Finnish/Swedish stemming, selected at runtime by
 * the document's <html lang>.
 */
import path from "node:path";
import fs from "node:fs/promises";
import * as pagefind from "pagefind";
import {
  LOCALES,
  LocaleManifestSchema,
  PageDocSchema,
} from "../shared/content-schema";

const PUBLIC_DIR = path.join(process.cwd(), "public");

function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const { index, errors } = await pagefind.createIndex({});
  if (!index) {
    throw new Error(`pagefind createIndex failed: ${errors.join(", ")}`);
  }

  let count = 0;
  for (const locale of LOCALES) {
    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(
        path.join(PUBLIC_DIR, "content", locale, "manifest.json"),
        "utf8",
      );
    } catch {
      continue; // locale not synced yet
    }
    const manifest = LocaleManifestSchema.parse(JSON.parse(manifestRaw));

    for (const page of manifest.pages) {
      if (page.hidden) continue;
      const doc = PageDocSchema.parse(
        JSON.parse(
          await fs.readFile(
            path.join(PUBLIC_DIR, page.path.replace(/^\//, "")),
            "utf8",
          ),
        ),
      );
      const content = doc.blocks
        .map((block) => {
          switch (block.type) {
            case "html":
            case "code":
              return textOfHtml(block.html);
            case "slideset":
              return block.slides
                .map((s) => `${s.title ?? ""} ${textOfHtml(s.html)}`)
                .join(" ");
            case "image":
              return block.caption ?? block.alt;
            case "youtube":
            case "pdf":
              return block.title ?? "";
          }
        })
        .join(" ");

      await index.addCustomRecord({
        url: `/${locale}/${page.collection}/${page.slug}`,
        content: `${page.title}. ${content}`,
        language: locale,
        meta: {
          title: page.title,
          collection: page.collection,
        },
      });
      count += 1;
    }
  }

  await fs.rm(path.join(PUBLIC_DIR, "pagefind"), {
    recursive: true,
    force: true,
  });
  await index.writeFiles({ outputPath: path.join(PUBLIC_DIR, "pagefind") });
  await pagefind.close();
  console.log(
    `[build-search-index] indexed ${count} pages -> public/pagefind/`,
  );
}

main().catch((err: unknown) => {
  console.error("[build-search-index] failed:", err);
  process.exitCode = 1;
});
