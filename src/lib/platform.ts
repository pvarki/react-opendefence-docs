import { useSyncExternalStore } from "react";
import { PLATFORMS, type Platform } from "@shared/content-schema";

const STORAGE_KEY = "platform";

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

export const PLATFORM_LABELS: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
  windows: "Windows",
  linux: "Linux",
  macos: "macOS",
};
