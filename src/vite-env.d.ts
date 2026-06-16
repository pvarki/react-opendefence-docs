/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OpenDefence landing-page URL for the home footer; link hidden when unset. */
  readonly VITE_LANDING_URL?: string;
}

// Build stamp injected by Vite `define` (see vite.config.ts).
declare const __BUILD_DATE__: string;
declare const __BUILD_COMMIT__: string;

// Fontsource packages resolve to bare CSS files; no type declarations shipped.
declare module "@fontsource-variable/geist";
declare module "@fontsource-variable/geist-mono";
