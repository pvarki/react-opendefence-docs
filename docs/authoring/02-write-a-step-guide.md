# Write a step guide

Most field guides are the same shape: do this, then this, then this,
with a screenshot per step. The site has a format for exactly that.

Write one line — `META: slides` — near the top of your document.
Then write each step as an `##` heading with one screenshot and a
short caption. That's the whole format.

## The rules

1. Put `META: slides` on its own line, anywhere before the first `##`.
2. Each `## Heading` = one step.
3. The **first image** in a step = that step's screenshot.
4. The remaining text in the step = the caption.
5. Text before the first `##` (minus the marker line) stays on the
   page as a normal intro.

## A complete example: Install ATAK

This is the whole document, as you'd type it in Outline.
(In Outline you paste screenshots directly — they become the images.)

```
# Install ATAK

META: slides

This guide installs ATAK on your Android phone and connects it to
your unit's TAK server. Takes about five minutes.

## Open Deploy App

[screenshot: Deploy App home screen]

Open Deploy App in your phone's browser. Log in if asked.

## Download the ATAK package

[screenshot: TAK tab with download button]

Go to the **TAK** tab. Tap **Download ATAK**.

## Install the APK

[screenshot: Android install prompt]

Open the downloaded file. Allow installs from your browser if
Android asks. Tap **Install**.

## Import your data package

[screenshot: ATAK import screen]

Open ATAK. Go to **Settings → Import** and pick the data package
you downloaded from Deploy App. ATAK connects automatically.
```

That's it. In Outline it just reads as a normal step-by-step doc —
which is the point. It previews fine right where you write it.

## How it renders on the site

- **Desktop:** a slide deck. One step per slide, image plus caption,
  arrow keys to move.
- **Mobile:** a numbered step list, scrolled like a checklist.

You write it once; the site picks the right layout.

## One image per step

Each step gets exactly one screenshot. If a step needs two images,
that's two steps — split it. Steps with no image are fine too; they
render as text-only.

Validation warns about image-layout steps without an image
(`slideset-step-missing-image`), so keep it tight.

## Converting a legacy slideshow

Old guides used a code fence with `[picN]` references and a separate
"Pictures" list. It still works, but every sync flags it
(`legacy-slideset-format`). Convert when you touch one. New guides:
always use `META: slides`.

Before (legacy):

````
```markdown
# Step one
[pic1]
Do the thing
---
# Step two
[pic2]
Do the next thing
```

Pictures:
* pic1![](/api/attachments/...)
* pic2![](/api/attachments/...)
````

After (canonical):

```
META: slides

## Step one
[screenshot pasted here]
Do the thing

## Step two
[screenshot pasted here]
Do the next thing
```

Delete the fence, turn each `#` slide title into a `##` heading,
move each picture from the Pictures list up into its step, then
delete the Pictures list. Done.
