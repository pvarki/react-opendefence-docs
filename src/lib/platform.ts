import { useMemo, useSyncExternalStore } from "react";
import { PLATFORMS, type Platform } from "@shared/content-schema";

const STORAGE_KEY = "platform";
const CLIENTS_KEY = "clientByBook";

/** First visit: pick the platform from the user agent; changeable + remembered. */
function detectFromUserAgent(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "android"; // soldiers' primary device
}

function readStored(): Platform | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return PLATFORMS.find((p) => p === raw);
  } catch {
    return undefined;
  }
}

let current: Platform = readStored() ?? detectFromUserAgent();
const listeners = new Set<() => void>();

export function getPlatform(): Platform {
  return current;
}

export function setPlatform(next: Platform): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // non-fatal
  }
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function usePlatform(): Platform {
  return useSyncExternalStore(
    subscribe,
    getPlatform,
    () => "android" as Platform,
  );
}

// ---------------------------------------------------------------------------
// Per-book client choice (e.g. TAK guide: ATAK vs TAK Tracker, both android).
// The global platform remains the cross-book default; an explicit client
// pick is remembered for that book.
// ---------------------------------------------------------------------------

export type ClientOverrides = Readonly<Record<string, string>>;

function readOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // fall through
  }
  return {};
}

let overrides: ClientOverrides = readOverrides();

export function getClientOverrides(): ClientOverrides {
  return overrides;
}

export function setClientForBook(collection: string, clientId: string): void {
  if (overrides[collection] === clientId) return;
  overrides = { ...overrides, [collection]: clientId };
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(overrides));
  } catch {
    // non-fatal
  }
  for (const listener of listeners) listener();
}

export function useClientOverrides(): ClientOverrides {
  return useSyncExternalStore(subscribe, getClientOverrides, () => overrides);
}

export interface ReadingView {
  platform: Platform;
  clientOverrides: ClientOverrides;
}

/** The reader's full content-view state: global platform + per-book clients. */
export function useReadingView(): ReadingView {
  const platform = usePlatform();
  const clientOverrides = useClientOverrides();
  return useMemo(
    () => ({ platform, clientOverrides }),
    [platform, clientOverrides],
  );
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
  linux: "Linux",
  macos: "macOS",
  // Developer Guide deployment targets (legacy docker-compose vs new K8s).
  "docker-rasenmaeher-integration": "RASENMAEHER (Docker)",
  "opendefence-k8s": "OpenDefence K8s",
};

/**
 * "TAK Tracker - Android" -> "TAK Tracker". Platform lists pair every label
 * with an OS icon, so the OS suffix is redundant there — two TAK Trackers
 * differ by icon alone. Falls back to the original when the label IS the
 * platform name (generic list). Keep the full label for aria-labels.
 */
export function stripPlatformSuffix(label: string): string {
  const stripped = label
    .replace(
      /\s*[-–—]\s*(android|apple|ios|ipados|windows|macos|linux)\s*$/i,
      "",
    )
    .trim();
  return stripped || label;
}
