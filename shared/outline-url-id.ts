/**
 * Outline document URLs end in a stable `urlId`: `/doc/<title-slug>-<urlId>`.
 * The title part changes whenever a page is renamed; the urlId never does, so
 * Outline itself resolves a document by it. Page slugs on this site are the
 * same Outline slug, which lets old URLs and stale links keep resolving after
 * a rename.
 */

/** A document uuid ("2586e9d1-9343-…"): an id, not a slug, so no urlId. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<title-slug>-<urlId>` or a bare urlId: 10 alphanumerics today, up to 15 allowed. */
const SLUG_URL_ID = /^(?:[0-9a-zA-Z_~-]*-)?([0-9a-zA-Z]{10,15})$/;

/**
 * The urlId at the end of an Outline slug (`takserver-groups-PQ4dCV2SYR` →
 * `PQ4dCV2SYR`), or undefined when `key` is not slug-shaped (a uuid, a path).
 */
export function outlineUrlId(key: string): string | undefined {
  if (UUID.test(key)) return undefined;
  return key.match(SLUG_URL_ID)?.[1];
}

/**
 * Lookup keys for an Outline doc key (slug, uuid or urlId): the key itself,
 * then its urlId — a link or Translations entry written before a rename
 * still carries the old title in its slug.
 */
export function docKeys(key: string): string[] {
  const urlId = outlineUrlId(key);
  return urlId && urlId !== key ? [key, urlId] : [key];
}
