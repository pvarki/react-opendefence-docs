/** Installed home-screen app: no browser chrome, so no browser back button. */
export const IS_STANDALONE: boolean =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true);
