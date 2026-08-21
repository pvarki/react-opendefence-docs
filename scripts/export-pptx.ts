/**
 * Export docs slideset pages as PowerPoint decks (≤ 1 MB each) for use in a
 * restricted SharePoint intranet: stable slug-based filenames mean an updated
 * deck overwrites the old file in a document library without breaking links.
 *
 *   pnpm export:pptx                        # every guide with slides, locale en
 *   pnpm export:pptx <slug...>              # just these pages
 *   pnpm export:pptx --locale fi            # another locale
 *   pnpm export:pptx --out /tmp/decks       # custom output dir
 *
 * Output: exports/pptx/<slug>.pptx. The slug embeds Outline's stable shortid,
 * so it survives re-syncs and content edits; only retitling a document in
 * Outline changes it (the old file then simply stays in SharePoint until you
 * delete it). Images are transcoded WebP→JPEG (SharePoint-2013-era PowerPoint
 * cannot display WebP) and recompressed until the whole deck fits under 1 MB;
 * a deck that cannot fit even at minimum quality fails loudly and writes
 * nothing.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import PptxGenJS from "pptxgenjs";
import sharp from "sharp";

// tsx/esbuild interop: pptxgenjs's ES bundle arrives as a module object whose
// .default is the class; under plain node the class comes through directly.
const PptxCtor: typeof PptxGenJS =
  (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS;

import {
  LocaleManifestSchema,
  normalizeLocale,
  PageDocSchema,
  type Locale,
  type ManifestPage,
  type PageDoc,
  type Slide,
} from "../shared/content-schema";
import {
  fitFontSize,
  fitRect,
  GEOM,
  htmlToParas,
  parasToTextProps,
} from "./lib/pptx";
import { runWithConcurrency } from "./lib/sync-helpers";
import { ensureDirAsync, printSection } from "./lib/utils";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SITE_ORIGIN = "https://docs.opendefence.fi";
const CAP_BYTES = 1_000_000;
const CONCURRENCY = 4;

/** Quality rungs, best first: scale × 96 dpi × display-inches = target px. */
const RUNGS = [
  { scale: 2, quality: 75 },
  { scale: 2, quality: 62 },
  { scale: 1.5, quality: 55 },
  { scale: 1, quality: 50 },
  { scale: 1, quality: 40 },
];

interface DeckResult {
  slug: string;
  status: "ok" | "no-slideset" | "too-big";
  bytes?: number;
  rung?: string;
  slideCount?: number;
}

function slidesOf(doc: PageDoc): Slide[] {
  return doc.blocks
    .filter((b) => b.type === "slideset")
    .flatMap((b) => b.slides);
}

const warnedImages = new Set<string>();

async function slideImageJpeg(
  slide: Slide,
  rung: (typeof RUNGS)[number],
): Promise<{ data: string; rect: ReturnType<typeof fitRect> } | undefined> {
  const img = slide.images[0];
  if (!img) return undefined;

  // The sync pipeline leaves non-raster attachments (svg, pdf) as remote
  // Outline URLs — nothing local to embed. Warn once, render text-only.
  if (!img.src.startsWith("/")) {
    if (!warnedImages.has(img.src)) {
      warnedImages.add(img.src);
      console.warn(`[export-pptx] skipping non-local image ${img.src}`);
    }
    return undefined;
  }

  // A slide with an image but a text-ish layout still needs an image box.
  const geom = GEOM[slide.layout]?.image
    ? GEOM[slide.layout]
    : GEOM["image-bottom"];
  const srcPath = path.join(PUBLIC_DIR, img.src.replace(/^\//, ""));

  let { width, height } = img;
  if (!width || !height) {
    const meta = await sharp(srcPath).metadata();
    width = meta.width;
    height = meta.height;
    if (!width || !height)
      throw new Error(`cannot read dimensions of ${img.src}`);
  }

  const rect = fitRect(width, height, geom.image!);
  const jpeg = await sharp(srcPath)
    .resize({
      width: Math.round(rect.w * 96 * rung.scale),
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" }) // JPEG has no alpha
    .jpeg({ quality: rung.quality, mozjpeg: true })
    .toBuffer();

  return { data: `image/jpeg;base64,${jpeg.toString("base64")}`, rect };
}

async function buildDeck(
  doc: PageDoc,
  slides: Slide[],
  locale: Locale,
  rung: (typeof RUNGS)[number],
): Promise<Buffer> {
  const pptx = new PptxCtor();
  // Built-in 16:9 preset = canonical 12192000×6858000 EMU, so PowerPoint
  // recognizes the decks as standard Widescreen (no rescale when copying
  // slides into other decks). Same 13.333×7.5 in geometry GEOM assumes.
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = doc.title;

  const cover = pptx.addSlide();
  cover.addText(doc.title, {
    x: 0.7,
    y: 2.1,
    w: 11.9,
    h: 1.2,
    fontSize: 32,
    bold: true,
  });
  cover.addText(doc.breadcrumb.join("  ›  "), {
    x: 0.7,
    y: 3.3,
    w: 11.9,
    h: 0.5,
    fontSize: 14,
    color: "666666",
  });
  const liveUrl = `${SITE_ORIGIN}/${locale}/${doc.collection}/${doc.slug}`;
  cover.addText(liveUrl, {
    x: 0.7,
    y: 3.9,
    w: 11.9,
    h: 0.4,
    fontSize: 12,
    color: "0563C1",
    hyperlink: { url: liveUrl },
  });
  cover.addText(`Updated ${doc.updatedAt.slice(0, 10)}`, {
    x: 0.7,
    y: 4.4,
    w: 11.9,
    h: 0.4,
    fontSize: 12,
    color: "666666",
  });

  for (const s of slides) {
    const slide = pptx.addSlide();
    const image = await slideImageJpeg(s, rung);
    const geom = image
      ? GEOM[s.layout]?.image
        ? GEOM[s.layout]
        : GEOM["image-bottom"]
      : GEOM.text;

    if (s.title) {
      slide.addText(s.title, { ...geom.title, fontSize: 20, bold: true });
    }
    const paras = htmlToParas(s.html);
    if (paras.length > 0) {
      slide.addText(parasToTextProps(paras) as PptxGenJS.TextProps[], {
        ...geom.body,
        // Explicit size that fits the box: read-only viewers (SharePoint /
        // Office Web Apps) never apply fit:"shrink", so don't rely on it.
        fontSize: fitFontSize(paras, geom.body),
        valign: "top",
        fit: "shrink",
      });
    }
    if (image) {
      slide.addImage({ data: image.data, ...image.rect });
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

async function exportDeck(
  page: ManifestPage,
  locale: Locale,
  outDir: string,
): Promise<DeckResult> {
  const raw = await fs.readFile(
    path.join(PUBLIC_DIR, page.path.replace(/^\//, "")),
    "utf8",
  );
  const doc = PageDocSchema.parse(JSON.parse(raw));
  const slides = slidesOf(doc);
  if (slides.length === 0) return { slug: page.slug, status: "no-slideset" };

  let lastSize = 0;
  for (const rung of RUNGS) {
    const buf = await buildDeck(doc, slides, locale, rung);
    lastSize = buf.length;
    if (buf.length <= CAP_BYTES) {
      const outPath = path.join(outDir, `${doc.slug}.pptx`);
      await fs.writeFile(outPath, buf);
      const { size } = await fs.stat(outPath);
      if (size > CAP_BYTES) {
        await fs.rm(outPath);
        throw new Error(`${doc.slug}: written file ${size} B exceeds cap`);
      }
      return {
        slug: page.slug,
        status: "ok",
        bytes: size,
        rung: `q${rung.quality}/${rung.scale}x`,
        slideCount: slides.length + 1,
      };
    }
  }
  return { slug: page.slug, status: "too-big", bytes: lastSize };
}

function usage(): never {
  console.error(
    "Usage: pnpm export:pptx [slug...] [--locale en|fi|sv] [--out <dir>]",
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const localeIdx = args.indexOf("--locale");
  const outIdx = args.indexOf("--out");
  const valueIdxs = new Set(
    [localeIdx, outIdx].filter((i) => i >= 0).map((i) => i + 1),
  );
  const unknownFlag = args.find(
    (a) => a.startsWith("--") && !["--locale", "--out"].includes(a),
  );
  if (unknownFlag) {
    console.error(`Unknown flag ${unknownFlag}`);
    usage();
  }

  // A flag value that is itself a flag means the value was omitted.
  const flagValue = (idx: number): string | undefined => {
    const v = idx >= 0 ? args[idx + 1] : undefined;
    return v?.startsWith("--") ? undefined : v;
  };
  const locale = normalizeLocale(
    localeIdx >= 0 ? (flagValue(localeIdx) ?? "") : "en",
  );
  if (!locale) usage();
  const outDir = path.resolve(
    process.cwd(),
    outIdx >= 0 ? (flagValue(outIdx) ?? usage()) : "exports/pptx",
  );
  const slugArgs = args.filter(
    (a, i) => !a.startsWith("--") && !valueIdxs.has(i),
  );

  const manifest = LocaleManifestSchema.parse(
    JSON.parse(
      await fs.readFile(
        path.join(PUBLIC_DIR, "content", locale, "manifest.json"),
        "utf8",
      ),
    ),
  );

  let targets: ManifestPage[];
  if (slugArgs.length > 0) {
    targets = [];
    for (const slug of slugArgs) {
      const page = manifest.pages.find((p) => p.slug === slug);
      if (!page) {
        const near = manifest.pages
          .filter(
            (p) =>
              p.slug.includes(slug.toLowerCase()) ||
              p.title.toLowerCase().includes(slug.toLowerCase()),
          )
          .slice(0, 5);
        console.error(`Unknown slug "${slug}" in locale ${locale}.`);
        if (near.length > 0) {
          console.error("Did you mean:");
          for (const p of near) console.error(`  ${p.slug}  (${p.title})`);
        }
        process.exit(1);
      }
      targets.push(page);
    }
  } else {
    // All mode: every visible page; pages without slides are skipped silently.
    targets = manifest.pages.filter((p) => !p.hidden);
  }

  await ensureDirAsync(outDir);

  const results = await runWithConcurrency(
    targets.map((page) => async () => {
      const result = await exportDeck(page, locale, outDir);
      if (result.status === "ok") {
        console.log(
          `  ${result.slug}.pptx  ${Math.round(result.bytes! / 1024)} KB  (${result.rung})  ${result.slideCount} slides`,
        );
      }
      return result;
    }),
    CONCURRENCY,
  );

  const ok: DeckResult[] = [];
  const noSlides: string[] = [];
  const failures: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failures.push(`${targets[i].slug}: ${String(r.reason)}`);
    } else if (r.value.status === "ok") {
      ok.push(r.value);
    } else if (r.value.status === "no-slideset") {
      noSlides.push(r.value.slug);
    } else {
      failures.push(
        `${r.value.slug}: ${r.value.bytes} B exceeds 1 MB even at minimum quality — split the page or trim images`,
      );
    }
  });

  printSection(
    `export:pptx — ${locale} → ${path.relative(process.cwd(), outDir)}`,
  );
  console.log(`  exported : ${ok.length}`);
  if (noSlides.length > 0) {
    // Explicitly requested slug with no slides is an error; in all mode it's
    // just not a guide.
    if (slugArgs.length > 0)
      failures.push(...noSlides.map((s) => `${s}: no slideset`));
    else console.log(`  skipped  : ${noSlides.length} pages without slides`);
  }
  if (failures.length > 0) {
    console.error(`  FAILED   : ${failures.length}`);
    for (const f of failures) console.error(`    ${f}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error("[export-pptx] failed:", err);
    process.exit(1);
  });
}
