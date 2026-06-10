import { useEffect, useSyncExternalStore } from "react";

/**
 * Slide image preloader. Loaded URLs are remembered module-wide and the
 * Image objects pinned so the browser cache can't evict them mid-deck —
 * ported behavior from the old wiki's RevealSlideshow.
 */
const loaded = new Set<string>();
const pinned = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function preload(src: string) {
  if (pinned.has(src)) return;
  const img = new Image();
  img.onload = () => {
    loaded.add(src);
    notify();
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
