/**
 * Grouping of the dev-section books for navigation surfaces (shelf, cross-book
 * sidebar, contents sheets): the Deploy App platform books vs the official
 * product-integration books.
 */
export const INTEGRATION_BOOK_SLUGS = new Set([
  "working-with-tak",
  "mediamtx",
  "matrix",
]);

/** Partition dev books (manifest order preserved) into the two nav groups. */
export function devBookGroups<T extends { slug: string }>(
  books: T[],
): { deployApp: T[]; integrations: T[] } {
  return {
    deployApp: books.filter((b) => !INTEGRATION_BOOK_SLUGS.has(b.slug)),
    integrations: books.filter((b) => INTEGRATION_BOOK_SLUGS.has(b.slug)),
  };
}
