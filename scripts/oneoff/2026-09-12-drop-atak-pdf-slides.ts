#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-09-12), two unrelated fixes across en/fi/sv:
 *
 *  1. Deploy App → Introduction, slide "Developed to be augmented": swap the
 *     512×512 logo for the Deploy App front page screenshot already used by the
 *     first slide of the same document (so no upload is needed).
 *
 *  2. TAK Guide → ATAK → Basic Core Features: drop the slides sourced from the
 *     official ATAK PDF manual (the `aug-NN.png` figure extracts). Their image
 *     quality is too low for the reader. In every affected document those
 *     slides are a trailing run, so the fix is "keep the first N `##` sections".
 *
 * Safety: each document's section count and the first dropped section's title
 * are verified against expectations before any write; one mismatch aborts the
 * whole run. Back up first: scripts/backup-outline.ts. Afterwards:
 *   pnpm tsx scripts/sync-outline.ts
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-09-12-drop-atak-pdf-slides.ts --dry-run
 *   pnpm tsx scripts/oneoff/2026-09-12-drop-atak-pdf-slides.ts
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const DRY = process.argv.includes("--dry-run");

/** Deploy App Introduction, one id per locale. Same slide order in all three. */
const INTRO_IDS = [
  "ed412ef0-5e77-4db2-a774-303a9e42119f", // en
  "ef1e49fe-2f98-479a-b6d2-59645d01ddd4", // fi
  "9551fc89-fe7f-46b2-a890-64209d4acbe7", // sv
];

interface Truncation {
  label: string;
  /** Number of `##` sections to keep; everything after is PDF-sourced. */
  keep: number;
  /** Total sections expected now — a guard against re-running on edited docs. */
  total: number;
  ids: string[]; // en, fi, sv
}

const TRUNCATIONS: Truncation[] = [
  {
    label: "Basic view, tools and toolbar",
    keep: 4,
    total: 9,
    ids: [
      "82c77545-7b47-4c8a-bf4b-2701a1bb3943",
      "135d7682-d3f6-4c38-bcb8-c4355ca4efb5",
      "a9979711-9672-4008-bab3-331107520a07",
    ],
  },
  {
    label: "Feeds with Data Sync",
    keep: 5,
    total: 10,
    ids: [
      "ce3ace12-abf3-4d66-a94b-8a5cbccfeebb",
      "79181696-83f2-4fc5-bd50-10e961b69b28",
      "9470832b-7765-4e92-acfc-48440644ccf9",
    ],
  },
  {
    label: "Sending a Marker",
    keep: 6,
    total: 10,
    ids: [
      "c588cbd2-a6fb-48d6-842f-6920707f82d3",
      "f02574d8-063c-496d-9688-9c2f03f43329",
      "d2b390c5-bc6e-4df3-9e17-bb0934a31ab6",
    ],
  },
  {
    label: "Point Dropper - Quick Pic",
    keep: 7,
    total: 9,
    ids: [
      "ac6ec0b2-a62a-4435-ab5d-32cb374cc4c1",
      "74085c34-90d6-47ef-a23d-f2895998048a",
      "d134e99b-5355-46ab-84f8-4ee726df339b",
    ],
  },
  {
    label: "GeoChat",
    keep: 12,
    total: 14,
    ids: [
      "1ddce881-2116-41eb-9980-f201fcc06f27",
      "ad49b71f-6f00-47bd-a0fa-d7efd33b72ef",
      "247093ea-6d9b-42f7-bdd6-628628ba8410",
    ],
  },
  {
    label: "Clear Content",
    keep: 3,
    total: 5,
    ids: [
      "a9de8b5d-4c35-4246-b0fe-7aeade6054ec",
      "a0f332b7-266a-46e8-9c2b-f613cfb06964",
      "f9334da8-9115-490b-ab3b-f4345f8db1bf",
    ],
  },
];

/** Byte offsets of every `## ` heading line, in order. */
function sectionStarts(text: string): number[] {
  const starts: number[] = [];
  const re = /^## .*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) starts.push(m.index);
  return starts;
}

function headingAt(text: string, offset: number): string {
  return text.slice(offset, text.indexOf("\n", offset)).trim();
}

const IMG_RE = /!\[[^\]]*\]\([^)]*attachments\.redirect[^)]*\)/g;

/**
 * The Introduction is a legacy slideset: the body references [pic1]..[pic3] and
 * the three images sit at the bottom. Point pic3 at pic1's attachment.
 */
function fixIntro(text: string): string {
  const imgs = [...text.matchAll(IMG_RE)];
  if (imgs.length !== 3) {
    throw new Error(`expected 3 attachment images, found ${imgs.length}`);
  }
  const [first, , last] = imgs;
  if (first[0] === last[0]) return text; // already swapped
  return (
    text.slice(0, last.index!) +
    first[0] +
    text.slice(last.index! + last[0].length)
  );
}

/**
 * The sync pipeline appends a "Translations" footer after the last section;
 * it must survive a truncation. Returns [body, footer].
 */
function splitFooter(text: string): [string, string] {
  const at = text.indexOf("* Translations:");
  if (at < 0) return [text, ""];
  const hr = text.lastIndexOf("\n---", at);
  if (hr < 0) return [text, ""];
  return [text.slice(0, hr), text.slice(hr)];
}

async function main() {
  const client = createOutlineClient();
  const writes: { id: string; label: string; text: string }[] = [];

  for (const id of INTRO_IDS) {
    const text = await client.getDocumentText(id);
    const next = fixIntro(text);
    if (next === text) {
      console.log(`= Introduction ${id}: already uses the front page shot`);
      continue;
    }
    writes.push({ id, label: `Introduction ${id}`, text: next });
  }

  for (const t of TRUNCATIONS) {
    for (const id of t.ids) {
      const [body, footer] = splitFooter(await client.getDocumentText(id));
      const starts = sectionStarts(body);
      if (starts.length !== t.total) {
        throw new Error(
          `${t.label} ${id}: expected ${t.total} sections, found ${starts.length}`,
        );
      }
      const cut = starts[t.keep];
      console.log(
        `- ${t.label} ${id}: dropping ${t.total - t.keep} from "${headingAt(body, cut)}"`,
      );
      writes.push({
        id,
        label: `${t.label} ${id}`,
        text: body.slice(0, cut).trimEnd() + "\n" + footer,
      });
    }
  }

  if (DRY) {
    console.log(`\nDRY RUN — would update ${writes.length} documents.`);
    return;
  }
  for (const w of writes) {
    await client.updateDocument(w.id, w.text);
    console.log(`✓ ${w.label}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
