import { useEffect, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import type { PageDoc } from "@shared/content-schema";
import { withBase } from "@/lib/base";

// public/videos.json — the rendered-video index, produced outside this repo and
// committed alongside the content. Keyed by "<collection>/<english slug>", so a
// translated page has to resolve its english slug before looking itself up.

const VideoEntrySchema = z.object({
  videoId: z.string(),
  /** The page updatedAt the video was rendered from — drives the stale notice. */
  docsUpdatedAt: z.string(),
});
export type VideoEntry = z.infer<typeof VideoEntrySchema>;

/** A YouTube playlist for one product and platform, linked from the shelf. */
const VideoPlaylistSchema = z.object({
  collection: z.string(),
  title: z.string(),
  url: z.string(),
  videos: z.number().int().nonnegative(),
});
export type VideoPlaylist = z.infer<typeof VideoPlaylistSchema>;

const VideosManifestSchema = z.object({
  generatedAt: z.string(),
  // Tolerated per entry and defaulted, so an older manifest without the field
  // still parses and the shelf simply shows no links.
  playlists: z.array(VideoPlaylistSchema).catch([]).default([]),
  // Per-entry tolerance on purpose: the manifest is generated in another repo,
  // so one drifted row must cost that page its video and nothing more.
  videos: z.record(z.string(), VideoEntrySchema.optional().catch(undefined)),
});
export type VideosManifest = z.infer<typeof VideosManifestSchema>;

const EMPTY: VideosManifest = { generatedAt: "", playlists: [], videos: {} };

let cached: Promise<VideosManifest> | undefined;
/** The settled manifest, so a pane's first render already knows the answer. */
let resolved: VideosManifest | undefined;

/**
 * One cached fetch, like loadManifest. Unlike content, videos are optional:
 * a missing or malformed file resolves to an empty manifest so the reader
 * behaves exactly as it did before any video existed.
 */
export function loadVideos(): Promise<VideosManifest> {
  cached ??= fetch(withBase("/videos.json"))
    .then((res) => (res.ok ? res.json() : EMPTY))
    .then((data) => {
      resolved = VideosManifestSchema.parse(data);
      return resolved;
    })
    .catch(() => {
      // Don't cache the failure — loader.ts deletes its cache entry for the
      // same reason. One flaky request must not disable videos for the tab.
      cached = undefined;
      return EMPTY;
    });
  return cached;
}

/** Manifest key for a page, or undefined when its english twin is unknown. */
function videoKey(doc: PageDoc): string | undefined {
  if (doc.locale === "en") return `${doc.collection}/${doc.slug}`;
  // "/en/guides/tak-guide/overview-CVNzKhRcKY" → "guides/tak-guide/overview-…"
  return doc.translations?.en?.replace(/^\/en\//, "");
}

/**
 * The video for this page.
 *
 * Seeded from the already-settled manifest rather than from EMPTY: a pane that
 * reports "no video" on its first render mounts the slideset, and
 * useImagePreloader would then fetch every slide image before the manifest
 * arrives a microtask later and throws the whole subtree away.
 */
export function usePageVideo(doc: PageDoc | undefined): VideoEntry | undefined {
  const [manifest, setManifest] = useState(() => resolved ?? EMPTY);

  useEffect(() => {
    let cancelled = false;
    void loadVideos().then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const key = doc && videoKey(doc);
  return key ? manifest.videos[key] : undefined;
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function onlineSnapshot(): boolean {
  return navigator.onLine !== false;
}

/**
 * Whether the browser thinks it has a network at all, so the reader can show
 * the slides instead of a dead youtube-nocookie frame when it does not.
 *
 * This covers the PWA offline case only. It does NOT cover the air-gapped nginx
 * deployment: a device on an isolated LAN has an interface up, so
 * navigator.onLine is true and the embed still renders as a grey box. Detecting
 * that needs a real probe or a build flag baked into the air-gapped image.
 * navigator.onLine is missing in some embedded webviews — treat that as online.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, onlineSnapshot, () => true);
}
