import {
  DEFAULT_LOCALE,
  type Locale,
  type TranslationsFile,
} from "@shared/content-schema";

/**
 * Route of the page's counterpart in `next`, else its English one, moved
 * under `next` so the UI switches language. Undefined when the path is not
 * a page or has no translation links; hidden pages never get one.
 */
export function counterpartPath(
  path: string,
  next: Locale,
  files: readonly TranslationsFile[],
): string | undefined {
  const slug = path.split("/").filter(Boolean).pop();
  if (!slug) return undefined;
  // Page slugs are unique across locales: only the page's own locale has it.
  const links = files.find((f) => Object.hasOwn(f, slug))?.[slug];
  const route = links?.[next] ?? links?.[DEFAULT_LOCALE];
  return route?.replace(/^\/[^/]+/, `/${next}`);
}
