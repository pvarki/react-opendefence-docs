/**
 * Non-image attachments (PDFs) for the Outline sync pipeline.
 *
 * The ZIP export carries a page's PDFs next to its images, and the markdown
 * links them by ZIP entry name ("attachments/<uuid>.pdf"). image-processor
 * only handles raster images, so without this step those links stay
 * relative and lead nowhere on the site.
 *
 * Output: public/content/files/{sha256hex16}.pdf (served at
 * /content/files/...). Like images, the name hashes the file's bytes, so a
 * re-sync reproduces the same name. Unlike images, files are not split by
 * locale: the fi and sv pages usually link the same manual, and a shared
 * name stores it once.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

/** Attachment extensions published as files. */
const FILE_EXTENSIONS = new Set([".pdf"]);

/** Larger files are left out (with a sync warning) to keep the repo sane. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface FileAttachments {
  /** ZIP entry name -> public path, e.g. "/content/files/<hash16>.pdf". */
  files: Map<string, string>;
  /** Entries over MAX_FILE_BYTES, not published. */
  tooLarge: { entryName: string; bytes: number }[];
}

export function isFileAttachment(entryName: string): boolean {
  return FILE_EXTENSIONS.has(path.extname(entryName).toLowerCase());
}

function filesDir(): string {
  return path.join(process.cwd(), "public", "content", "files");
}

/**
 * Store the file attachments that the document's markdown links to under
 * their content hash. An attachment the text no longer links is not
 * published.
 *
 * @param entries - ZIP entry name -> raw bytes (from downloadDocumentWithImages)
 * @param markdown - the document's markdown, before references are rewritten
 * @param maxBytes - size limit, MAX_FILE_BYTES by default
 */
export async function processDocumentFiles(
  entries: Map<string, Buffer>,
  markdown: string,
  maxBytes = MAX_FILE_BYTES,
): Promise<FileAttachments> {
  const result: FileAttachments = { files: new Map(), tooLarge: [] };
  const wanted = [...entries].filter(
    ([name]) =>
      isFileAttachment(name) &&
      markdown.includes(`attachments/${path.posix.basename(name)}`),
  );
  if (wanted.length === 0) return result;

  await fs.mkdir(filesDir(), { recursive: true });
  for (const [entryName, buffer] of wanted) {
    if (buffer.length > maxBytes) {
      result.tooLarge.push({ entryName, bytes: buffer.length });
      continue;
    }
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const fileName = `${hash}${path.extname(entryName).toLowerCase()}`;
    await fs.writeFile(path.join(filesDir(), fileName), buffer);
    result.files.set(entryName, `/content/files/${fileName}`);
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Point markdown links and HTML hrefs at the stored files. A target matches
 * by its "attachments/<file name>" tail, so the relative export form, an
 * absolute Outline URL and the missing-slash "…getoutline.comattachments/"
 * form (see image-processor) all resolve.
 */
export function updateFileReferences(
  markdown: string,
  files: Map<string, string>,
): string {
  let result = markdown;
  for (const [entryName, src] of files) {
    const tail = `attachments/${escapeRegExp(path.posix.basename(entryName))}`;
    // [label](…attachments/x.pdf) and [label](…attachments/x.pdf "title")
    result = result.replace(
      new RegExp(`(\\]\\()[^)\\s"']*?${tail}(?=[\\s)])`, "g"),
      `$1${src}`,
    );
    // <a href="…attachments/x.pdf">
    result = result.replace(
      new RegExp(`(href=["'])[^"']*?${tail}(?=["'])`, "gi"),
      `$1${src}`,
    );
  }
  return result;
}
