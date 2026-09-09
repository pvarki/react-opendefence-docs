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
import { pathToFileURL } from "node:url";
import * as pagefind from "pagefind";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LocaleManifestSchema,
  PageDocSchema,
} from "../shared/content-schema";
import { API_SPEC_SOURCES, RELEASE_DOC_SOURCES } from "../config/collections";

const PUBLIC_DIR = path.join(process.cwd(), "public");

function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "GET /api/v1/users — List users" per operation, so a path finds the spec. */
export function operationsText(spec: unknown): string {
  const paths = (spec as { paths?: Record<string, unknown> })?.paths ?? {};
  const lines: string[] = [];
  for (const [route, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(
      (item ?? {}) as Record<
        string,
        { summary?: string; description?: string }
      >,
    )) {
      if (typeof op !== "object" || op === null) continue;
      lines.push(
        `${method.toUpperCase()} ${route} ${op.summary ?? ""} ${op.description ?? ""}`.trim(),
      );
    }
  }
  return lines.join(" ");
}

/** Reference-view URL; the ?v= tag deep-links one release (see $view.tsx). */
export function devRefUrl(book: string, view: string, tag?: string): string {
  const base = `/${DEFAULT_LOCALE}/dev/${book}/${view}`;
  return tag ? `${base}?v=${encodeURIComponent(tag)}` : base;
}

async function readJson(...segments: string[]): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(...segments), "utf8"));
}

type Index = NonNullable<
  Awaited<ReturnType<typeof pagefind.createIndex>>["index"]
>;

interface SpecManifest {
  sources?: { id: string; name: string; versions: { specFile: string }[] }[];
}
interface ReleaseManifest {
  components?: {
    id: string;
    name: string;
    releases?: { tag: string; file: string }[];
    changelogFile?: string;
    releaseNotesFile?: string;
  }[];
}

/** API specs, releases and changelogs; en only, as dev books are en-only. */
async function indexDevReference(index: Index): Promise<number> {
  let count = 0;
  const add = async (
    url: string,
    title: string,
    book: string,
    body: string,
  ) => {
    await index.addCustomRecord({
      url,
      content: `${title}. ${body}`,
      language: DEFAULT_LOCALE,
      meta: { title, collection: book },
    });
    count += 1;
  };
  const read = (...segments: string[]) =>
    readJson(PUBLIC_DIR, ...segments).catch(() => undefined);

  const specs = (await read("api-specs", "manifest.json")) as
    | SpecManifest
    | undefined;
  for (const source of specs?.sources ?? []) {
    const book = API_SPEC_SOURCES.find((s) => s.id === source.id)?.book;
    const newest = source.versions[0];
    if (!book || !newest) continue;
    const spec = await read("api-specs", source.id, newest.specFile);
    if (!spec) continue;
    const info = (spec as { info?: { description?: string } }).info ?? {};
    await add(
      devRefUrl(book, "api"),
      source.name,
      book,
      `${info.description ?? ""} ${operationsText(spec)}`,
    );
  }

  const components = (await read("release-docs", "manifest.json")) as
    | ReleaseManifest
    | undefined;
  for (const component of components?.components ?? []) {
    const book = RELEASE_DOC_SOURCES.find((s) => s.id === component.id)?.book;
    if (!book) continue;
    const docs: [url: string, title: string, file: string][] = (
      component.releases ?? []
    ).map((r) => [
      devRefUrl(book, "releases", r.tag),
      `${component.name} ${r.tag}`,
      path.join("releases", r.file),
    ]);
    if (component.changelogFile) {
      docs.push([
        devRefUrl(book, "changelog"),
        `${component.name} — Changelog`,
        component.changelogFile,
      ]);
    }
    if (component.releaseNotesFile) {
      docs.push([
        devRefUrl(book, "notes"),
        `${component.name} — Release notes`,
        component.releaseNotesFile,
      ]);
    }
    for (const [url, title, file] of docs) {
      const doc = (await read("release-docs", component.id, file)) as
        | { html?: string }
        | undefined;
      if (!doc?.html) continue;
      await add(url, title, book, textOfHtml(doc.html));
    }
  }

  return count;
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

  const refs = await indexDevReference(index);

  await fs.rm(path.join(PUBLIC_DIR, "pagefind"), {
    recursive: true,
    force: true,
  });
  await index.writeFiles({ outputPath: path.join(PUBLIC_DIR, "pagefind") });
  await pagefind.close();
  console.log(
    `[build-search-index] indexed ${count} pages + ${refs} reference docs -> public/pagefind/`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error("[build-search-index] failed:", err);
    process.exitCode = 1;
  });
}
