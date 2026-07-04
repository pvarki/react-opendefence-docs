import { useSyncExternalStore } from "react";

/** Chromium-only event; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Wire up capture — called once at module load, exported for tests. */
export function listenForInstallPrompt(target: Window = window) {
  target.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  target.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

if (typeof window !== "undefined") listenForInstallPrompt();

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

// ponytail: UA sniff misses iPadOS-pretending-to-be-Mac; good enough for a hint.
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Install-to-home-screen state. `canInstall` goes true when Chromium fires
 * `beforeinstallprompt` (and false again once installed or prompted);
 * `showIosHint` covers Safari, which has no prompt API — only manual
 * "Add to Home Screen" instructions.
 */
export function usePwaInstall() {
  const event = useSyncExternalStore(subscribe, () => deferred);
  return {
    canInstall: !!event,
    showIosHint: !event && isIos() && !isStandalone(),
    install: async () => {
      const e = deferred;
      // A prompt event is single-use: clear it either way. If the user
      // accepts, `appinstalled` keeps it cleared.
      deferred = null;
      emit();
      await e?.prompt();
    },
  };
}
