import type { LocaleManifest } from "@shared/content-schema";
import { loadPage } from "@/lib/content/loader";
import { readingOrder } from "@/lib/content/neighbors";

const IMG_SRC_RE = /<img[^>]+src="([^"]+)"/g;

/**
 * Warm the runtime image cache for a whole book so it reads fully offline.
 * Page JSON is already precached by the service worker; images are
 * CacheFirst-cached on demand — this fetches them all up front (field units
 * prep connectivity before going dark).
 */
export async function downloadCollectionImages(
  manifest: LocaleManifest,
  collection: string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const pages = readingOrder(manifest, collection);
  const srcs = new Set<string>();

  for (const page of pages) {
    const doc = await loadPage(page.path).catch(() => undefined);
    if (!doc) continue;
    for (const block of doc.blocks) {
      switch (block.type) {
        case "image":
          srcs.add(block.src);
          break;
        case "slideset":
          for (const slide of block.slides) {
            for (const image of slide.images) srcs.add(image.src);
          }
          break;
        case "html": {
          for (const match of block.html.matchAll(IMG_SRC_RE)) {
            if (match[1].startsWith("/")) srcs.add(match[1]);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  const all = [...srcs];
  let done = 0;
  onProgress(0, all.length);
  // Modest concurrency: enough to finish fast, low enough not to stall reads.
  const CONCURRENCY = 4;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, lane) => {
      for (let i = lane; i < all.length; i += CONCURRENCY) {
        await fetch(all[i]).catch(() => {});
        done += 1;
        onProgress(done, all.length);
      }
    }),
  );
}
