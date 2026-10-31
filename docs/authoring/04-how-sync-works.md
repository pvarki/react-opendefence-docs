# How sync works

You write in Outline. A pipeline copies your work into the site repo,
checks it, and opens a pull request. Merging that PR deploys.

You never have to touch the pipeline — but knowing the rhythm helps.

## The schedule

- **Weekly:** every Saturday at 22:00 UTC (midnight in Finland).
- **On demand:** GitHub → **Actions** tab → **Scheduled Outline
  Sync** → **Run workflow**. Two optional inputs:
  - _force_sync_ — re-download everything, not just changed docs.
  - _collection_ — sync only one collection slug
    (e.g. `guides/tak-guide`).

So the worst-case wait for an Outline edit to reach the site is one
week; if it's urgent, anyone with repo access can trigger a run in
ten seconds.

## What the sync PR contains

Each run pushes to the branch `docs/outline-sync` and opens (or
updates) a PR titled "docs: sync content from Outline". It contains:

- the synced content as JSON under `public/content/`,
- converted images (WebP, served from the site itself — no calls
  back to Outline at read time),
- refreshed API specs,
- and, as the **PR body**, the validation report.

## Reading the validation report

The report starts with a summary table (level, code, count), then
lists issues per collection. Every issue includes an
**"open in Outline"** link straight to the document that needs
fixing — click it, fix the doc, done. The fix lands on the next sync.

Levels: **error** (broken for readers, fix it), **warning** (works
but degraded), **info** (FYI).

A PR body holds about 60,000 characters. When the report is longer,
it is cut: the summary and any skipped collections stay whole, all
errors come first, and the rest of the issues follow until the space
runs out. A note at the end says how many were listed; the run's log
under **Actions** → **Scheduled Outline Sync** lists all of them.

The codes you'll actually see:

| Code                          | Meaning                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `broken-internal-link`        | A link to another doc page that doesn't resolve — target moved, renamed, or isn't synced.           |
| `missing-image`               | The doc references an image that didn't make it to disk.                                            |
| `orphaned-page`               | A page file exists but isn't in any navigation — usually a doc outside the en/fi/sv locale roots.   |
| `duplicate-base-slug`         | Two docs in the same collection and locale share a title-slug — rename one.                         |
| `missing-locale-root`         | The collection has no `en`, `fi`, or `sv` root for that language — translation gap, not a breakage. |
| `legacy-slideset-format`      | A slideshow still uses the old code-fence format — convert it to `META: slides`.                    |
| `slideset-step-missing-image` | A step in a slideset expects an image but has none.                                                 |
| `empty-doc`                   | The page has no content at all.                                                                     |
| `marker-variant`              | A marker in the wrong form, e.g. translated, reworded or mistyped — use the official phrase.        |
| `missing-translation`         | No working Translations link to a language the book is in — fix the link or its target.             |

(There are also `invalid-page` and `missing-page-file` errors — those
indicate pipeline trouble, not authoring mistakes. Ping a developer.)

A few warnings come from the sync run itself, not from the report:
hidden pages that still have content, links to hidden pages, and
markers on organizer docs. Find them in the run's log under
**Actions** → **Scheduled Outline Sync** (lines marked ⚠ and the
"Warnings" list in the completion report).

If a collection can't be read at all (deleted in Outline, or the API
key has no access to it), the sync skips it and keeps its current
content on the site. The sync PR body lists it under **Skipped
collections**, right after the summary, and the run's summary page
shows a warning too. Fix the access or remove the collection from
[config/collections.ts](../../config/collections.ts).

## Who merges, and when it deploys

A developer reviews the sync PR — mainly skimming the report for new
errors — and merges it. Merge to `main` deploys automatically to
docs.opendefence.fi (and produces the Docker image used in air-gapped
deployments).

Warnings don't block a merge. Errors usually mean someone clicks the
Outline links, fixes the docs, and re-runs the sync before merging.

## TL;DR

1. Edit in Outline whenever you like.
2. Saturday night (or a manual run) packages it into a PR.
3. The PR body tells you exactly what's broken, with links.
4. Merge = live.
