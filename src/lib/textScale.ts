import { useSyncExternalStore } from "react";

// A global reader text-size control. The chosen step is applied as a multiplier
// to the root font-size (--text-scale in index.css), so every rem-based text on
// the site scales — reader prose, UI chrome, and slideset captions alike.
// Mirrors the platform store: a tiny external store + useSyncExternalStore.

const STORAGE_KEY = "textScale";

/** Root-font multipliers. Index 1 is the normal default. */
export const TEXT_SCALE_STEPS = [0.9, 1, 1.2, 1.45] as const;
const DEFAULT_INDEX = 1;
/** At/above this step, mobile slideset images shrink to give captions room. */
const LARGE_INDEX = 2;

export const TEXT_SCALE_MIN = 0;
export const TEXT_SCALE_MAX = TEXT_SCALE_STEPS.length - 1;

function clamp(i: number): number {
  return Math.max(TEXT_SCALE_MIN, Math.min(TEXT_SCALE_MAX, i));
}

function readStored(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isInteger(raw) && raw >= TEXT_SCALE_MIN && raw <= TEXT_SCALE_MAX)
      return raw;
  } catch {
    // storage unavailable (private mode etc.) — fall through to default
  }
  return DEFAULT_INDEX;
}

function apply(index: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--text-scale",
    String(TEXT_SCALE_STEPS[index]),
  );
}

let current = readStored();
apply(current); // apply the stored choice as soon as this module loads
const listeners = new Set<() => void>();

export function getTextScaleIndex(): number {
  return current;
}

export function setTextScaleIndex(next: number): void {
  const clamped = clamp(next);
  if (clamped === current) return;
  current = clamped;
  apply(clamped);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    // non-fatal
  }
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useTextScaleIndex(): number {
  return useSyncExternalStore(
    subscribe,
    getTextScaleIndex,
    () => DEFAULT_INDEX,
  );
}

/** True once text is enlarged enough that mobile slideset images should shrink. */
export function useIsLargeText(): boolean {
  return useTextScaleIndex() >= LARGE_INDEX;
}

/** Current multiplier — for components that size text in px (fit-text decks). */
export function useTextScaleMult(): number {
  return TEXT_SCALE_STEPS[useTextScaleIndex()];
}
