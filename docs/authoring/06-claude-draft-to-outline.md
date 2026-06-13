# Draft a guide with Claude, push it to Outline

Writing a whole step guide by hand is the slow part. This loop hands the
writing to Claude and the screenshots to you — then pushes the finished guide
straight into Outline, where the normal [sync](04-how-sync-works.md) picks it
up. Nobody pastes images one at a time.

Claude can't take the products' screenshots itself — TAK, Matrix (Element) and
Deploy App are native or login-gated apps it has no access to. So the split is:
**you provide screenshots + a one-line hint each; Claude writes everything else
and publishes it.**

## The loop

```
1. YOU    drop ordered screenshots into a draft folder + one hint per shot
2. CLAUDE write the canonical guide.md (titles + captions + image refs)
3. YOU    skim guide.md locally, approve
4. CLAUDE pnpm author:push <draft>  → uploads images, creates the Outline page
5. YOU    glance in Outline, publish
6.        pnpm sync  → it lands in the app
```

## 1. Scaffold a draft

```
pnpm author:scaffold <product> <platform> <slug> <stepCount> [--title "..."]

# platform-aware book:
pnpm author:scaffold deploy-app android add-a-user 5 --title "Add a user"
# platform-agnostic book (Matrix etc.) — use "_" for platform:
pnpm author:scaffold matrix _ join-a-room 4
```

`<product>` / `<platform>` are validated against
[scripts/author/products.ts](../../scripts/author/products.ts) (which holds the
Outline collection + platform-organizer ids), so a typo fails immediately.

This writes:

```
drafts/<product>/<platform>/<slug>/
  guide.md     ← the canonical META: slides markdown, one ## per step
  hints.txt    ← authoring notes, never published
```

## 2. Add screenshots + hints

Save each screenshot in the folder as `01-screenshot.png`,
`02-screenshot.png`, … (matching the placeholders in `guide.md`). Then jot one
line per shot in `hints.txt`:

```
01: Deploy App home in phone browser; tap "Log in"
02: enter unit credentials; button is labelled "Kirjaudu" / "Sign in"
03: TAK tab — the download button says "Download ATAK package"
```

Terse is fine. The hints are what stop Claude mislabelling a button or missing
an off-screen step. Screenshots alone usually work, but the hints close the gap.

## 3. Claude fills in guide.md

Claude writes each step title and caption into `guide.md`, keeping the
[canonical step format](02-write-a-step-guide.md): one `# Title`, `META: slides`,
each `## Heading` a step, the first image its screenshot, the rest the caption.
You review the file locally before anything touches the wiki.

## 4. Push to Outline

```
pnpm author:push drafts/<product>/<platform>/<slug> [--chapter "Title"] [--publish] [--dry-run]
```

- `--dry-run` — print the target hierarchy and create/update plan, write nothing.
- `--chapter "Getting Started"` — nest the page under a chapter organizer
  (find-or-created automatically under the platform organizer).
- `--publish` — publish immediately. **Default is an unpublished Outline draft**
  so you can review there first.

The push uploads each local screenshot as an Outline attachment (via
`attachments.create`), rewrites the image refs to the hosted
`attachments.redirect?id=…` URLs, and creates the page under the right platform
organizer — or updates it in place if a page with that title already exists
(idempotent, so re-running is safe).

## 5. Publish & sync

Open the draft in Outline, fix any wording, hit publish. Then:

```
pnpm sync
```

The page appears in the app on the chosen platform. Done.

## Notes

- One image per step (the format rule). Need two images? That's two steps.
- The `# Title` line becomes the Outline document title and is stripped from the
  body — don't repeat it as an `##` heading.
- `drafts/` is local working material. Commit the `guide.md` for review history
  if you like; large screenshot folders are better left out of git.
