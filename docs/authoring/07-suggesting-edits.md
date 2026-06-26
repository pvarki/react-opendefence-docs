# Suggesting edits (readers) & reviewing them (maintainers)

Outline accounts are for the core team. Everyone else — readers,
partners, anyone with a GitHub account — can still propose changes
through GitHub, and a maintainer applies the approved ones in Outline.
Nothing a reader submits ever runs on the site: a suggestion is plain
text in a GitHub issue, and the only people who can change a doc are
those with Outline write access. That is the approval gate.

## For readers: how to suggest an edit

On any page, the footer has a **"Suggest an edit →"** link. It opens a
new GitHub issue, pre-filled with the page, its URL, and a
current-wording / suggested-change template. Fill it in and submit
(you'll need a free GitHub account).

People who open a blank issue instead get the same structured form
("Suggest a doc edit"), so every suggestion lands the same way.

## For maintainers: reviewing suggestions

1. **Triage the queue.** All suggestions carry the `doc-suggestion`
   label — filter issues by it.
2. **Decide.** Accept, tweak, or decline. Declining is approval working;
   say why and close.
3. **Apply in Outline.** For accepted edits, make the change in the
   source document. The issue body links straight to the Outline doc
   (the `Source (maintainers)` line) when the suggestion came from the
   in-app link.
4. **Publish.** The next [sync](04-how-sync-works.md) packages it into a
   PR; merging deploys. Close the issue, ideally referencing the sync PR.

## Setup (one-time)

- Repo **Settings → General → Features**: Issues enabled.
- The `doc-suggestion` label exists (the issue form applies it):
  `gh label create doc-suggestion -d "Reader-proposed doc edit" -c "#0e8a16"`.

## Why this is safe

- A suggestion is **text in an issue** — it can't touch the build, the
  content JSON, or other readers' browsers.
- The edit is made by a **trusted person in Outline**, exactly as today.
- The build **sanitizes all content HTML** regardless of source, so even
  an applied edit can't introduce scripts.
- No backend, no public write access to the repo or the live site.
