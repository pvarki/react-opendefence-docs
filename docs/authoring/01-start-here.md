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

## Which marker? Show, mark or hide

| The material is…                                              | Do this                                         |
| ------------------------------------------------------------- | ----------------------------------------------- |
| ready                                                         | nothing                                         |
| usable, but needs final polish                                | mark the page under development                 |
| a whole chapter or platform that is usable but not finished   | mark its organizer under development            |
| a whole book that is so unfinished readers must be told       | mark the book's language root under development |
| not fit to read yet (a few sentences, an idea, wrong content) | hide the page                                   |

Mark a whole book only when the book as a whole is unfinished. If the
visible pages are ready, the book needs no marker, even when some of
its pages are hidden or marked.

All draft banners come from these markers in Outline. Nothing is set
in the site's code, so changing a marker never needs a developer, only
the next sync.

## Not finished yet? Mark it

Put this exact phrase anywhere in the document body:

```
(This tab is under development)
```

Write it in English in every language (fi and sv docs too); upper or
lower case doesn't matter. Other wordings, such as
`(this page is under development)`, `(Under development)` or a
translation, are not recognised: they show up on the page as plain
text, and validation warns about them as `marker-variant` (for
organizer docs, the sync log warns).

The page is still published: readers see its content with an "Under
construction" banner above it, in the language of the site they are
reading, and the page stays in the reading order and search. Remove
the marker when you're done, and the banner goes away on the next
sync.

So mark pages that readers can already use but that are not finished.
A page that is not fit to read yet should be hidden instead (next
section).

### A whole chapter, platform or book

The same marker works on an organizer doc too, and then covers every
page under it:

- **Chapter or section organizer** (e.g. `Supported Plugins`): every
  page in that chapter shows the banner.
- **Platform or client organizer** (e.g. `iTAK`): every page of that
  client shows the banner, the book cover shows it while that client
  is selected, and the platform selector shows an "Incomplete" tag.
- **Language root** (`en`, `fi` or `sv` at the top of the collection):
  the whole book in that language. The cover and every page show the
  banner. Mark each language separately; marking `sv` only flags the
  Swedish book.

Write the marker as its own line in the organizer's body. Only
organizers down to chapter level are read: a sub-organizer nested
inside a chapter is flattened into it (see
[Keep nesting shallow](#keep-nesting-shallow)), and its marker is
ignored. Organizer
markers are read on every sync, so adding or removing one takes effect
on the next sync even when no page changed. Books without language
roots (the developer books) can only be marked page by page.

## Not meant for readers? Hide it

Put this exact phrase anywhere in the document body, a code block
included:

```
(This tab should not be shown)
```

The page is then left out of the site completely: no sidebar entry,
no page, no search result. Hidden pages never affect the draft banner
of the pages around them, or of the book. Use it for old, badly unfinished or wrong
content. The same rules as above apply: English in every language,
any letter case, and a translation such as
`(Tätä välilehteä ei pitäisi näyttää)` hides nothing and gets a
`marker-variant` warning.

- A sidebar group whose pages are all hidden disappears too.
- The marker on an organizer doc does nothing: organizers are not
  pages, so the pages under it stay visible. The sync log says so.
- A link to a hidden page turns into plain text, and the sync log
  names the page that has it. A link to it in a Translations list is
  dropped without a warning.
- The sync log lists hidden pages that still have content besides
  the marker, so nothing useful stays hidden by accident.

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
- `(This tab is under development)` — on a client organizer this shows an
  "Incomplete" tag in the platform selector and the draft banner on all of
  the client's pages (see
  [A whole chapter, platform or book](#a-whole-chapter-platform-or-book)).

Structure under a client: organizers become chapters (or toporgs with the
marker), loose docs group under the client's own name. Each client is its
own entry in the selector — ATAK and TAK Tracker are separate choices even
though both run on Android.

## Quick checklist for a new page

1. Open the right collection in Outline.
2. Create the document under the correct locale root (`en`, `fi`, `sv`).
3. Drag it to the right spot in the sidebar.
4. Add `(This tab is under development)` if it's not finished yet.
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
