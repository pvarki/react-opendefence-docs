# Outline Authoring Guide

This guide explains how to structure and write content in the Outline wiki at pvarki.getoutline.com so it renders correctly in docs.opendefence.fi.

---

## Document hierarchy

Every guide collection uses a strict four-level hierarchy:

```
{Locale root}         "En" / "Fi" / "Sv"
└── Platforms          organizer — META: platforms-container in body
    └── {Platform}     organizer — declares OS and optional product markers
        └── {Chapter}  organizer — groups leaf pages
            └── {Page} leaf document — the actual content
```

- **Locale root** — one per supported language. Created by the Outline admin. Do not rename.
- **Platforms** — a single organizer directly under the locale root. Must have `META: platforms-container` in its body. All platform organizers live here.
- **Platform organizer** — one per supported platform or product (ATAK, Android, WinTAK, etc.). See markers below.
- **Chapter organizer** — groups related pages under a platform (Start, Basic Features, Usage by Role, Troubleshooting, …).
- **Leaf page** — the actual guide content: text, slidesets, images.

Platform-agnostic pages (visible on all platforms) go directly under the locale root, **not** inside Platforms.

---

## Marker reference

Markers are plain text lines placed in an organizer's document body. They control how the sync pipeline processes the document tree.

### In the Platforms organizer body

```
META: platforms-container
```

Tells the sync this organizer is a pure wrapper for platform organizers. The sync recurses into its children without treating the wrapper itself as a client.

### In a platform organizer body

```
META: platform: <id>
META: os: <os-key>
META: product: yes          (optional)
```

| Marker                 | Required              | Values                                    | Purpose                                                                        |
| ---------------------- | --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `META: platform: <id>` | optional              | any slug, e.g. `atak`, `android`          | stable client identifier (defaults to organizer slug)                          |
| `META: os: <os-key>`   | required for products | `android` `ios` `windows` `linux` `macos` | underlying OS — determines the icon shown in the platform selector             |
| `META: product: yes`   | optional              | —                                         | marks this as a named product (ATAK, WinTAK) rather than a generic OS platform |

**Generic OS platform** (Android, iOS, Windows, Linux, macOS):

```
META: os: android
```

**Named product** (ATAK, WinTAK, iTAK, TAK Tracker):

```
META: platform: atak
META: os: android
META: product: yes
```

### In any organizer body

```
META: toporg
```

Renders the organizer as a non-clickable **section heading** in the sidebar, grouping the chapters beneath it. Use this for semantic groupings like "Introduction" or "Usage by Role" that are not chapters themselves.

```
META: incomplete
```

Marks a platform or chapter as work in progress. Shows a red "Incomplete" tag in the platform selector and hides pages from the reading order.

### In any leaf page body

```
META: slides
```

Activates the canonical slideset renderer. Everything after this line is parsed as slides — H2 headings become slide titles, the first image in each H2 section is the slide image, and the body text is the slide caption.

---

## Slideset format

Use the canonical `META: slides` format for all new content.

```markdown
# Page Title

META: slides

## Slide One Title

![Alt text](https://pvarki.getoutline.com/api/attachments.redirect?id=abc123)

Body text for slide one. Use bullet lists with `*`:

- Point A
- Point B

## Slide Two Title

![Alt text](https://pvarki.getoutline.com/api/attachments.redirect?id=abc124)

Body text for slide two.
```

### Rules

- `META: slides` must appear on its own line, after the H1 title.
- Each H2 heading starts a new slide.
- The **first** `![]()` in a section is the slide image. Subsequent images in the same section are ignored.
- Image paths are Outline attachment URLs — do not change them; the sync pipeline resolves them at build time.
- **No H3+ headings inside slides** — the parser does not handle them and they will appear as raw text.
- Keep bullet lists with `*` (not `-` or `1.`).
- Do not add a closing "Done — you can close this guide" slide. End the last slide with meaningful content.

### What NOT to do

```markdown
## My Slide

### This subheading will break the slide ✗

- Do not use H3 or deeper inside slides ✗
```

---

## Platform vs. product

| Concept                  | Example               | `META: os` | `META: product: yes` |
| ------------------------ | --------------------- | ---------- | -------------------- |
| Generic OS               | Android               | `android`  | no                   |
| Named product on Android | ATAK                  | `android`  | yes                  |
| Named product on iOS     | iTAK                  | `ios`      | yes                  |
| Named product on Windows | WinTAK                | `windows`  | yes                  |
| Named product on iOS     | TAK Tracker – Apple   | `ios`      | yes                  |
| Named product on Android | TAK Tracker – Android | `android`  | yes                  |

The platform selector shows the organizer **title** as the label. The OS determines the icon (Android robot, Apple logo, Windows flag). For generic platforms, title and icon match naturally; for products, the title is the product name and the icon shows the underlying OS.

---

## Chapter naming conventions

Use consistent chapter titles across all platforms and guides:

| Chapter               | Used for                                           |
| --------------------- | -------------------------------------------------- |
| **Start**             | Installation, initial connection, first-time setup |
| **Basic Features**    | Core day-to-day operations                         |
| **Advanced Features** | Power-user operations                              |
| **Supported Plugins** | Third-party plugin guides                          |
| **Usage by Role**     | Fighter, Command Post role-specific workflows      |
| **Troubleshooting**   | Common issues and fixes                            |

For lightweight guides (Matrix, CryptPad) with a single page, a chapter organizer is optional — the page can sit directly under the platform organizer.

---

## Translation workflow

### What to translate

- Document titles (organizer titles and leaf page titles)
- Slide titles (H2 headings in the slideset)
- All slide body text (paragraphs, bullet lists)

### What NOT to change

- `META: slides` and all other `META:` markers — keep them verbatim in every locale
- Image paths — `![]()` src attributes must be copied exactly from the English source
- Document slugs — Outline generates these; do not alter them

### Locale root structure

The Finnish and Swedish locale roots already exist in each guide collection. Add translated content by creating organizers and pages under the `Fi` / `Sv` root, matching the English hierarchy.

Use `pnpm post-translations --locale fi --guide tak-guide --dry-run` to preview what would be created before posting.

---

## Common mistakes

| Mistake                                                                       | Effect                                 | Fix                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| H3+ heading inside a slide                                                    | Raw text displayed                     | Use only H2 for slide titles                                 |
| Missing `META: slides`                                                        | Page renders as plain text             | Add the marker after the H1                                  |
| Closing "you can close this guide" slide                                      | Clutters the reading experience        | Delete the slide                                             |
| Changing an image URL in translation                                          | Broken image in translated page        | Copy the English URL verbatim                                |
| Adding a platform organizer directly under locale root (not inside Platforms) | Platform may not be detected correctly | Always place platform organizers under the Platforms wrapper |
| No `META: os` on a product organizer                                          | Platform selector shows Monitor icon   | Add `META: os: <key>` to the organizer body                  |
