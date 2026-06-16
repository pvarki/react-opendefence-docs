# TAK Tracker - Android guide drafts — push & publish

5 new chapter drafts built from the official US TPC manual
(`helpcontent/takcontent/taktrackercontent/TAK_Tracker_User_Guide.pdf`, v8.1.0).
They **augment** the existing TAK Tracker - Android guide (which only covered
install & connect). All are local `guide.md` + extracted figures; **nothing is
in Outline yet.** Screenshots are git-ignored (`drafts/.gitignore`); the
`guide.md` files are tracked for review.

## What's here (5 pages, ~15 slides)

| Chapter                                        | Page                                           | Source pp. |
| ---------------------------------------------- | ---------------------------------------------- | ---------- |
| START & CONNECT                                | Enroll on a Server (manual URL/port/user/pass) | 5          |
| USING TAK TRACKER FEATURES → Basic Features    | Read Your Status & Location                    | 3, 6       |
| USING TAK TRACKER FEATURES → Basic Features    | Chat With Your Team                            | 8          |
| USING TAK TRACKER FEATURES → Basic Features    | Send an Emergency Alert Beacon                 | 7          |
| USING TAK TRACKER FEATURES → Advanced Features | Options & Settings                             | 8          |

Structure mirrors the ATAK guide: a platform-level `USING TAK TRACKER FEATURES`
toporg (sibling of the existing `START & CONNECT` / `USAGE BY ROLE`) holding
`Basic Features` and `Advanced Features` chapters. The PDF's _Android
Permissions_ and import flow are already covered by the existing _Start from
Download_ / _Importing Server Connection_ pages and were intentionally left
untouched.

## How to push

```bash
# 1. Review the guide.md files (open any drafts/tak/tak-tracker-android/*/guide.md).
# 2. Preview every push — no writes:
DRY=1 ./drafts/tak/tak-tracker-android/push-all.sh
# 3. Push for real (creates UNPUBLISHED Outline drafts + uploads figures):
./drafts/tak/tak-tracker-android/push-all.sh
# 4. Publish each page in Outline, then:
pnpm sync
```

`push-all.sh` uses the nested `--chapter` support, which **idempotently creates**
the `USING TAK TRACKER FEATURES` toporg and its chapters and matches the existing
`START & CONNECT` chapter by title. Order-independent.

## Structure note (renderer constraint)

The sidebar renderer does **not** support a toporg nested inside another toporg —
a toporg's child organizers render as chapters, and anything below chapter level
is flattened. `USING TAK TRACKER FEATURES` is therefore a platform-level toporg
with `Basic Features` / `Advanced Features` as chapters under it.

## Image-light pages (swap branded shots later)

Figures are official-manual screenshots (small, ~100–270px). Two pages lean on
text where the manual had only a tiny toolbar glyph and no honest full figure:

- **Enroll on a Server** — only the Enrollment window figure (step 2 text-led).
- **Options & Settings** — only the Connection Settings window figure
  (Lock / Import / display toggles are text-led).
- **Chat With Your Team** — the unread-count badge step is text-led.

Add branded Android shots via the normal scaffold/push loop when convenient.
