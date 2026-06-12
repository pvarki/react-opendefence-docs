/**
 * Deployment base path support (e.g. GitHub Pages project URLs like
 * /react-opendefence-docs/). Vite injects BASE_URL from its `base` option;
 * the router gets it as basepath, so route paths everywhere in the app stay
 * base-free — only direct fetches/asset URLs and raw pathname reads need
 * these helpers.
 */
export const BASE = import.meta.env.BASE_URL; // always ends with "/"

/** Prefix a root-absolute asset/fetch path ("/content/...") with the base. */
export function withBase(path: string): string {
  return path.startsWith("/") ? BASE + path.slice(1) : path;
}

/** Turn a window pathname back into a router (base-free) pathname. */
export function stripBase(pathname: string): string {
  if (BASE !== "/" && pathname.startsWith(BASE)) {
    return "/" + pathname.slice(BASE.length);
  }
  return pathname;
}
