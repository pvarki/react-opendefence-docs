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

/**
 * "Suggest an edit" — a prefilled GitHub issue for the page being read. Anyone
 * with a GitHub account can propose a change; a maintainer applies it in
 * Outline (the source of truth), where the weekly sync then publishes it. The
 * issue is plain text, so this adds no write path to the site or the build.
 */
export function suggestEditUrl(opts: {
  collection: string;
  title: string;
  pageUrl: string;
  docId?: string;
}): string {
  const body = [
    `**Page:** ${opts.title}`,
    `**URL:** ${opts.pageUrl}`,
    opts.docId
      ? `**Source (maintainers):** https://pvarki.getoutline.com/doc/${opts.docId}`
      : null,
    ``,
    `**Current wording**`,
    `> (paste the text you want changed)`,
    ``,
    `**Suggested change**`,
    `> (your proposed wording)`,
  ]
    .filter((line) => line !== null) // keep "" spacers; drop the absent docId line
    .join("\n");
  const q = new URLSearchParams({
    title: `Doc suggestion: ${opts.title}`,
    body,
    labels: "doc-suggestion",
  });
  return `${issuesUrl(opts.collection)}?${q}`;
}
