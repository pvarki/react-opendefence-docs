import { useLayoutEffect, useRef } from "react";

/**
 * Per-page scroll position memory so swiping back to a page restores where
 * the reader was. sessionStorage-backed: survives the swiper unmounting
 * panes, intentionally forgotten when the app session ends.
 */
const memory = new Map<string, number>();

function storageKey(key: string) {
  return `scroll:${key}`;
}

function read(key: string): number {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(storageKey(key), String(value));
  } catch {
    // storage full/unavailable — in-memory map still works
  }
}

export function useScrollMemory(key: string) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.scrollTop = read(key);

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => write(key, el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [key]);

  return ref;
}
