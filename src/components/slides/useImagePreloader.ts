import { useEffect, useSyncExternalStore } from "react";

/**
 * Slide image preloader. Loaded URLs are remembered module-wide and the
 * Image objects pinned so the browser cache can't evict them mid-deck —
 * ported behavior from the old wiki's RevealSlideshow.
 */
const loaded = new Set<string>();
const pinned = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

function preload(src: string) {
  if (pinned.has(src)) return;
  const img = new Image();
  // A failed image is done loading too: the slide shows its alt text
  // instead of a spinner that never stops.
  img.onload = img.onerror = () => {
    loaded.add(src);
    for (const listener of listeners) listener();
  };
  img.src = src;
  pinned.set(src, img);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Warm every image of a deck; `srcs` must be referentially stable. */
export function usePreloadImages(srcs: string[]) {
  useEffect(() => {
    for (const src of srcs) preload(src);
  }, [srcs]);
}

/** One image's state: a load re-renders that image, not its whole deck. */
export function useImageLoaded(src: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded.has(src),
    () => false,
  );
}

/** @deprecated Subscribes a whole deck; the decks move to the hooks above. */
export function useImagePreloader(srcs: string[]) {
  useEffect(() => {
    for (const src of srcs) preload(src);
  }, [srcs]);

  const loadedCount = useSyncExternalStore(
    subscribe,
    () => srcs.filter((s) => loaded.has(s)).length,
    () => 0,
  );

  return {
    loadedCount,
    total: srcs.length,
    isLoaded: (src: string) => loaded.has(src),
  };
}
