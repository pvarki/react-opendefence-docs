# ATAK guide drafts — push & publish

55 ATAK chapter drafts built from the official TAK manuals (see
`~/.claude/plans/…whimsical-whale.md`). All are local `guide.md` + extracted
figures; **nothing is in Outline yet.** Screenshots are git-ignored
(`drafts/.gitignore`); the `guide.md` files are tracked for review.

## What's here (55 chapters, ~327 slides)

| Group                                 | Count                | Kind                             |
| ------------------------------------- | -------------------- | -------------------------------- |
| Basic Features                        | 16 new + 6 augmented | new chapters + appended slides   |
| Advanced Features                     | 14 new + 2 augmented | incl. 4 rebuilt empty skeletons  |
| Radio & Video                         | 2 new                | new chapter group                |
| Supported Plugins → UAS Tool          | 6 new                | drone control                    |
| Supported Plugins → Reports           | 5 new                | field reports                    |
| Supported Plugins → GRG Builder       | 3 new                | gridded graphics                 |
| Usage by Role → Use Geochat for comms | 1                    | image-fill (partial — see below) |

Augmented chapters keep all existing branded slides (fetched + converted from
legacy to the canonical `META: slides` format) and add new slides; their drafts
live in `aug-*` folders and push as an UPDATE of the existing page.

## How to push

```bash
# 1. Review the guide.md files (open any drafts/tak/atak/*/guide.md).
# 2. Preview every push — no writes:
DRY=1 ./drafts/tak/atak/push-all.sh
# 3. Push for real (creates UNPUBLISHED Outline drafts + uploads figures):
./drafts/tak/atak/push-all.sh
# 4. Publish each page in Outline, then:
pnpm sync
```

`push-all.sh` uses the new nested `--chapter` support, which **idempotently
creates** the organizer tree (the `Supported Plugins` toporg and its UAS Tool /
Reports / GRG Builder chapters, the `Radio & Video` chapter). Order-independent.

## Structure note (renderer constraint)

The sidebar renderer does **not** support a toporg nested inside another toporg —
a toporg's child organizers render as chapters, and anything below chapter level
is flattened. So per-plugin grouping only works if **`Supported Plugins` is a
platform-level toporg** (a sibling of `USING ATAK FEATURES`, `USAGE BY ROLE`…),
with `UAS Tool` / `Reports` / `GRG Builder` as chapters under it. `push-all.sh`
is set up that way (`--chapter "Supported Plugins/UAS Tool"`, etc.).

_Alternative_ if you'd rather not add a top-level section: drop the umbrella and
make each plugin a chapter directly under `USING ATAK FEATURES` — change the
plugin paths in `push-all.sh` to `"USING ATAK FEATURES/UAS Tool"` etc.

## One-time Outline cleanup (after pushing)

The old placeholder `Supported Plugins` organizer (nested under
`USING ATAK FEATURES`) and its `Uastool` stub page both have the body
`(This tab should not be shown)`. Once the new structure is pushed, **delete that
old `Supported Plugins` organizer and the `Uastool` stub** in Outline so there
aren't two "Supported Plugins" entries.

## Needs your branded screenshots (not auto-sourced)

These are OpenDefence/Deploy-App-specific views with no honest match in the
generic ATAK manual, so they were left imageless rather than filled with a
mismatched stock figure:

- **Use Geochat for comms** — 8 channel slides (COMMAND / BLUFOR / RECON /
  COMMON + their examples). The 5 generic GeoChat-UI slides were filled.
- **A3 partials (no draft created)** — existing chapters each missing 1–2
  images: _Importing Server Connection_, _Load ATAK Plugins_, _Overview_,
  _Use RECON Feed_, _What you get & send_, _RECON Feed Management_. Add branded
  shots via the normal scaffold/push loop when convenient.

## Deviations from the approved plan (why)

- **Plugin layout** moved to a platform-level `Supported Plugins` toporg (renderer
  can't nest toporgs — see above).
- **Point Dropper - Markers (+3)** and **Draw & share Plans (+6)** were already
  22 and 11 slides; appending would break the "not too long" rule, so that
  content became focused new chapters **Customize Markers & Icons** and **Draw
  Shapes & Graphics** instead of augmentations.
- **Image quality**: figures are official-manual ATAK-stock screenshots
  (~200–800px). ~14 slides use small toolbar/icon figures (the manual's only
  source for those steps); swap branded shots later if you want them larger.
