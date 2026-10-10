import { useSyncExternalStore } from "react";

// Global "how do I want guides served" preference: the step-by-step slideset
// (the default, and the only medium that works air-gapped) or the rendered
// video. Same tiny external store as textScale — chosen once in the navbar,
// read by every reader page.

const STORAGE_KEY = "mediaPref";

export type MediaPref = "slides" | "videos";

const DEFAULT_PREF: MediaPref = "slides";

function readStored(): MediaPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "slides" || raw === "videos") return raw;
  } catch {
    // storage unavailable (private mode etc.) — fall through to default
  }
  return DEFAULT_PREF;
}

let current = readStored();
const listeners = new Set<() => void>();

export function getMediaPref(): MediaPref {
  return current;
}

export function setMediaPref(next: MediaPref): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
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

export function useMediaPref(): MediaPref {
  return useSyncExternalStore(subscribe, getMediaPref, () => DEFAULT_PREF);
}
