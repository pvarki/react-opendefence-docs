/**
 * Per-guide "post an issue" links — the GitHub issue tracker shown near a
 * book's title and in the page footer.
 *
 * Guide-wide settings in this repo live in code (the same way collection
 * labels/descriptions live in config/collections.ts, not in Outline page
 * bodies). Override a collection's tracker by adding its slug below; anything
 * unlisted falls back to the docs repo.
 */
const DEFAULT_ISSUES_URL =
  "https://github.com/pvarki/react-opendefence-docs/issues/new";

const ISSUES_URL: Record<string, string> = {
  // collection slug -> issue tracker URL, e.g.
  // "guides/tak-guide": "https://github.com/pvarki/<repo>/issues/new",
};

export function issuesUrl(collection: string): string {
  return ISSUES_URL[collection] ?? DEFAULT_ISSUES_URL;
}
