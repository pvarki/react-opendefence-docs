# Style and translations

Readers are soldiers in a hurry, often on a phone, sometimes offline.
Write for them.

## Style basics

- **Short pages.** One task per page. If a page scrolls forever,
  split it into chapters.
- **Lead with the action.** First sentence tells the reader what
  they'll get done. Background goes last, or nowhere.
- **Screenshots over prose.** One good screenshot beats three
  paragraphs. Use the [step guide format](02-write-a-step-guide.md)
  for anything procedural.
- **Short sentences.** Commands, not essays. "Tap **Install**."
- **Bold UI labels.** Write button and menu names exactly as they
  appear on screen: **Download ATAK**, **Settings → Import**.

## Linking translations

Each language version is its own document under its locale root
(`en`, `fi`, `sv`). Link them with a Translations list at the top of
the document, right under the title:

```
* Translations:
  * fi: [Asenna ATAK](https://pvarki.getoutline.com/doc/asenna-atak-aB3dE9fG)
  * sv: [Installera ATAK](https://pvarki.getoutline.com/doc/installera-atak-xY7zQ2wK)
```

Each bullet is `locale: link-to-the-doc`. In Outline, just type the
locale code and paste the document's link — Outline turns it into a
link for you. The list itself is stripped from the published page;
the site uses it to power the language switcher, so readers can flip
between languages on the same page.

Maintain the list in every variant (the English doc links fi and sv,
the Finnish doc links en and sv, and so on). Use `sv` for Swedish —
the old `se` code still works, but don't start new docs with it.

## The under-development marker

Drafting in the open is fine. Add this exact phrase anywhere in the
body and the page renders as "Coming Soon", hidden from reading
order and search:

```
(this page is under development)
```

`(this tab is under development)` works too. Delete the line when
the page is ready.

## Images

- **Paste screenshots directly into Outline.** No upload service, no
  URLs to manage. The pipeline converts every image to WebP and
  serves it from the site itself — so images work offline and in
  air-gapped deployments.
- **One image per step** in step guides. Two images means two steps.
- **Crop to what matters.** A full 4K desktop screenshot of one
  button is unreadable on a phone. Crop close.
- **Portrait phone screenshots are fine** — most readers are on
  phones anyway.
- Skip decorative images. Every image should show the reader where
  to click or what they should see.

## Naming: it's "Deploy App"

The product is called **Deploy App**. You'll find the old names
RASENMAEHER and pvarki in legacy content and in technical
identifiers — leave the identifiers alone, but in prose always write
Deploy App. Fix old names when you're editing a page anyway.

- Yes: "Open Deploy App and go to the TAK tab."
- No: "Open RASENMAEHER..."
