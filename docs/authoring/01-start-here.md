# Start here: write docs in Outline

You write docs in [Outline](https://pvarki.getoutline.com). That's it.
No git, no markdown files, no build steps. The site syncs from Outline
once a week and publishes your work at docs.opendefence.fi.

This page explains how Outline structure maps to the site.

## The mental model: a bookshelf

- **Collection** = one book on the site (Deploy App, TAK Guide, ...).
- **Document** = one page in that book.
- **Top-level documents** (under the locale root) = chapters.
- **Drag to reorder** in the Outline sidebar = reading order on the site.

Readers swipe through a book page by page, like a paper manual.
Whatever order you see in Outline's sidebar is the order they read.

## Locale roots: en, fi, sv

Every collection has three top-level documents titled exactly:

```
en
fi
sv
```

These are the locale roots. They are wrappers, not pages — put your
actual documents _under_ the matching root:

```
TAK Guide (collection)
├── en
│   ├── Install ATAK        <- chapter
│   │   └── Troubleshooting <- page inside that chapter
│   └── Connect to server   <- chapter
├── fi
│   └── Asenna ATAK
└── sv
```

Writing in Finnish? Put the doc under `fi`. Same guide in English?
Write a separate doc under `en` and link them together (see
[Style and translations](05-style-and-translations.md)).

## Keep nesting shallow

The site shows at most two levels: chapters and their pages.
Anything nested deeper gets flattened into the nearest chapter,
in depth-first order. It still appears — just not as a sub-sub-menu.

So don't build deep trees. Two levels is the sweet spot.

## Not finished yet? Mark it

Put this exact phrase anywhere in the document body:

```
(this page is under development)
```

(`(this tab is under development)` also works.)

The page then renders as "Coming Soon" on the site and is excluded
from the reading order and search. Remove the marker when you're done,
and the page goes live on the next sync.

This means you can draft freely in Outline without half-finished
pages leaking to readers.

## Organizer markers: platforms, clients and section headings

Organizer docs (docs that only nest other docs) shape navigation. Three
markers, typed as plain lines in the organizer doc's body, control how:

- `META: platform: android` (or `ios`, `windows`, `linux`, `macos`) — this
  organizer is a selectable client in the platform selector. You rarely need
  it: names like `Android`, `ATAK`, `iTAK`, `WinTAK` or `TAK Tracker -
Android` are detected automatically. Use the marker when the name alone
  doesn't say the platform (e.g. a new product client).
- `META: toporg` — this organizer is a section heading that groups chapters
  in the table of contents instead of being a chapter itself. Example: under
  `ATAK`, a toporg `INTRODUCTION` holding the intro page and the `Start`
  chapter, then `USING ATAK FEATURES` holding Basic Features, Advanced
  Features and Supported Plugins, then `USAGE BY ROLE`.
- `(this page is under development)` — on a client organizer this shows an
  "Under development" tag in the platform selector, telling readers this
  client still has sections missing compared to the others.

Structure under a client: organizers become chapters (or toporgs with the
marker), loose docs group under the client's own name. Each client is its
own entry in the selector — ATAK and TAK Tracker are separate choices even
though both run on Android.

## Quick checklist for a new page

1. Open the right collection in Outline.
2. Create the document under the correct locale root (`en`, `fi`, `sv`).
3. Drag it to the right spot in the sidebar.
4. Add `(this page is under development)` if it's a draft.
5. Write. Paste screenshots directly. Done.

## What's next

- Writing a step-by-step guide with screenshots? Read
  [Write a step guide](02-write-a-step-guide.md).
- Want Claude to write the guide and publish it for you, screenshots and all?
  Read [Draft a guide with Claude, push to Outline](06-claude-draft-to-outline.md).
- Need a whole new collection? Read
  [Add a collection](03-add-a-collection.md).
- Wondering when your edits go live? Read
  [How sync works](04-how-sync-works.md).
