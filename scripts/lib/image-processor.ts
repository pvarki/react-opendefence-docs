/**
 * Image processing for the Outline sync pipeline.
 *
 * Converts ZIP-export attachments to WebP (q80) and rewrites markdown
 * references to the content-addressed output path. The reference-rewrite
 * regexes are ported byte-identical from the old wiki pipeline — they encode
 * years of Outline export quirks (HTML <img> tags mixed into markdown, size
 * attrs after the path, and the infamous missing-slash
 * "pvarki.getoutline.comattachments/..." URLs).
 *
 * Output: public/content/images/{locale}/attachments/{sha256hex16}.webp
 * (served at /content/images/{locale}/attachments/...). Filenames hash the
 * ORIGINAL attachment bytes, not the converted ones, so re-syncing an
 * unchanged document deterministically reproduces the same filename and a
 * sharp upgrade cannot orphan-and-duplicate every image at once.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Locale } from "../../shared/content-schema";

// Configuration

/** Image extensions that can be converted to WebP. */
const CONVERTIBLE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".tiff",
  ".bmp",
]);

/** WebP quality (0-100), same as the old pipeline. */
const WEBP_QUALITY = 80;

// Types

export interface ProcessedImage {
  /** Public fetch path, e.g. "/content/images/en/attachments/<hash16>.webp". */
  src: string;
  width?: number;
  height?: number;
}

// Helpers

/** Check if a file is an image that can be converted to WebP. */
export function isConvertibleImage(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.has(ext);
}

function attachmentsDir(locale: Locale): string {
  return path.join(
    process.cwd(),
    "public",
    "content",
    "images",
    locale,
    "attachments",
  );
}

function publicSrc(locale: Locale, fileName: string): string {
  return `/content/images/${locale}/attachments/${fileName}`;
}

// Processing

/**
 * Convert, persist and measure every image attachment of one document.
 *
 * @param images - ZIP entry name -> raw bytes (from downloadDocumentWithImages)
 * @param locale - Locale whose attachments directory receives the files
 * @returns ZIP entry name -> { src, width, height }. Entries that are not
 *   convertible images (PDFs etc.) or fail conversion are omitted — their
 *   markdown references are left untouched, matching the old pipeline's
 *   non-fatal per-image error handling.
 */
export async function processDocumentImages(
  images: Map<string, Buffer>,
  locale: Locale,
): Promise<Map<string, ProcessedImage>> {
  const outDir = attachmentsDir(locale);
  const result = new Map<string, ProcessedImage>();
  if (images.size === 0) return result;

  await fs.mkdir(outDir, { recursive: true });

  // sharp runs on its own thread pool; per-image failures must not sink the
  // document, so each entry settles independently.
  const tasks = [...images.entries()].map(
    async ([entryName, buffer]): Promise<
      [string, ProcessedImage] | undefined
    > => {
      const ext = path.extname(entryName).toLowerCase();

      let output: Buffer;
      if (CONVERTIBLE_EXTENSIONS.has(ext)) {
        output = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer();
      } else if (ext === ".webp") {
        output = buffer;
      } else {
        // Non-raster attachments (svg, pdf, ...) have no home under the
        // content-addressed .webp scheme; skip and keep the original ref.
        return undefined;
      }

      // Content-addressed name from the ORIGINAL bytes (see module docs).
      const hash = createHash("sha256")
        .update(buffer)
        .digest("hex")
        .slice(0, 16);
      const fileName = `${hash}.webp`;

      // Dimensions are captured AFTER conversion so they describe the bytes
      // actually served (gif/tiff first-frame extraction can differ).
      const { width, height } = await sharp(output).metadata();

      await fs.writeFile(path.join(outDir, fileName), output);

      const processed: ProcessedImage = { src: publicSrc(locale, fileName) };
      if (width) processed.width = width;
      if (height) processed.height = height;
      return [entryName, processed];
    },
  );

  const settled = await Promise.allSettled(tasks);
  for (let i = 0; i < settled.length; i++) {
    const res = settled[i];
    if (res.status === "fulfilled") {
      if (res.value) result.set(res.value[0], res.value[1]);
    } else {
      console.warn(
        `  ! image conversion failed (kept original ref): ${[...images.keys()][i]}: ${String(res.reason)}`,
      );
    }
  }

  return result;
}

// Markdown Reference Updates

/**
 * Rewrite every reference to a processed attachment so it points at the
 * content-addressed WebP path. Regexes ported byte-identical from the old
 * updateImageReferencesWithMap.
 *
 * @param markdown - The markdown content
 * @param imageMap - ZIP entry name -> processed image (from processDocumentImages)
 * @param locale - Locale of the document; guards against passing a map that
 *   was built for another locale (per-locale image dirs made that a real bug
 *   class in the old pipeline)
 */
export function updateImageReferences(
  markdown: string,
  imageMap: Map<string, ProcessedImage>,
  locale: Locale,
): string {
  const expectedPrefix = `/content/images/${locale}/attachments/`;
  let result = markdown;

  for (const [originalPath, image] of imageMap.entries()) {
    if (!image.src.startsWith(expectedPrefix)) {
      throw new Error(
        `updateImageReferences: "${originalPath}" -> "${image.src}" was not processed for locale "${locale}"`,
      );
    }
    const newPath = image.src;

    // Get the filename without path (just the actual filename)
    const justFilename = originalPath.split("/").pop() || originalPath;

    // Get the filename without extension
    const filenameNoExt = justFilename.replace(/\.[^.]+$/, "");

    // Escape special regex characters in both the full path and filename
    const escapedOriginal = originalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedFilename = filenameNoExt.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    // Update markdown image syntax: ![alt](path)
    const mdImageRegex = new RegExp(
      `(!\\[[^\\]]*\\]\\()${escapedOriginal}(\\s*[^)]*\\))`,
      "g",
    );
    result = result.replace(mdImageRegex, `$1${newPath}$2`);

    // Update HTML img tags with exact path: <img src="path" />
    const htmlImageRegex = new RegExp(
      `(<img[^>]*src=["'])${escapedOriginal}(["'][^>]*>)`,
      "gi",
    );
    result = result.replace(htmlImageRegex, `$1${newPath}$2`);

    // Update HTML img tags with Outline URL pattern: <img src="https://*.getoutline.com*/attachments/filename.ext" />
    // This handles both pvarki.getoutline.com and app.getoutline.com
    const outlineUrlRegex = new RegExp(
      `(<img[^>]*src=["'])https?://[^/"]+\\.getoutline\\.com[^/]*/attachments/${escapedFilename}\\.[^"']+("\\s*[^>]*>)`,
      "gi",
    );
    result = result.replace(outlineUrlRegex, `$1${newPath}$2`);

    // Update markdown images with Outline URL pattern: ![alt](https://*.getoutline.com*/attachments/filename.ext)
    const outlineMdRegex = new RegExp(
      `(!\\[[^\\]]*\\]\\()https?://[^/)]+\\.getoutline\\.com[^/]*/attachments/${escapedFilename}\\.[^)\\s]+(\\s*[^)]*\\))`,
      "gi",
    );
    result = result.replace(outlineMdRegex, `$1${newPath}$2`);

    // Handle malformed URLs where domain and path are concatenated (pvarki.getoutline.comattachments)
    // This can happen when there's a missing slash in the URL
    // Use JUST the filename without any path prefix since the URL doesn't have the "attachments/" directory
    const malformedOutlineUrlRegex = new RegExp(
      `(<img[^>]*src=["'])https?://[^/"]+\\.getoutline\\.comattachments/${escapedFilename}\\.[^"']+("\\s*[^>]*>)`,
      "gi",
    );
    result = result.replace(malformedOutlineUrlRegex, `$1${newPath}$2`);

    // Handle malformed markdown images with concatenated domain/path
    // This matches URLs like: https://pvarki.getoutline.comattachments/efdd56d5-...-929b60df5d2f.png
    const malformedOutlineMdRegex = new RegExp(
      `(!\\[[^\\]]*\\]\\()https?://[^/)]+\\.getoutline\\.comattachments/${escapedFilename}\\.[^)\\s]+(\\s*[^)]*\\))`,
      "gi",
    );
    result = result.replace(malformedOutlineMdRegex, `$1${newPath}$2`);

    // ADDITIONAL FIX: Match the EXACT filename with extension from the URL
    // Some URLs might have the exact original extension (.png, .jpg, etc.)
    const originalExt = justFilename.match(/\.[^.]+$/)?.[0] || "";
    if (originalExt) {
      const escapedExt = originalExt.replace(/\./g, "\\.");

      // Match exact filename.ext pattern in malformed URLs
      const malformedExactRegex = new RegExp(
        `(!\\[[^\\]]*\\]\\()https?://[^/)]+\\.getoutline\\.comattachments/${escapedFilename}${escapedExt}([^)]*\\))`,
        "gi",
      );
      result = result.replace(malformedExactRegex, `$1${newPath}$2`);

      // Also match for HTML img tags
      const malformedExactHtmlRegex = new RegExp(
        `(<img[^>]*src=["'])https?://[^/"]+\\.getoutline\\.comattachments/${escapedFilename}${escapedExt}(["'][^>]*>)`,
        "gi",
      );
      result = result.replace(malformedExactHtmlRegex, `$1${newPath}$2`);
    }
  }

  return result;
}
