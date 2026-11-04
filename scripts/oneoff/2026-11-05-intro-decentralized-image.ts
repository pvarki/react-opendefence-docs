#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-11-05): the new Introduction slide "Decentralized,
 * one server to one unit" (see 2026-11-05-intro-decentralized-slide.ts) gets a
 * diagram: three units, each with its own Deploy App server.
 *
 * Source: drafts/deploy-app/intro-decentralized.svg (rendered to .png). The
 * image has no translatable text, so all three locales share one attachment.
 * The slide switches `[layout: text]` → `image-left` and takes the new key
 * [pic4]; pic1..pic3 stay untouched.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-11-05-intro-decentralized-image.ts --dry-run
 *   pnpm tsx scripts/oneoff/2026-11-05-intro-decentralized-image.ts
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const DRY = process.argv.includes("--dry-run");
const SHOT = "drafts/deploy-app/intro-decentralized.png";
const WIDTH = 1800;
const HEIGHT = 1000;

const IDS = [
  "ed412ef0-5e77-4db2-a774-303a9e42119f", // en
  "ef1e49fe-2f98-479a-b6d2-59645d01ddd4", // fi
  "9551fc89-fe7f-46b2-a890-64209d4acbe7", // sv
];

const LAYOUT = "[layout: text]";
const SLIDE_END = "\n\n---\n";
// Empty alt text is load-bearing: see 2026-09-12-deploy-app-intro-frontpage.ts.
const PIC3_DEF = /pic3\n\n ?!\[\]\([^)]*\)/g;

function splice(id: string, text: string, attachmentId: string): string {
  if (text.split(LAYOUT).length !== 2) {
    throw new Error(`${id}: expected exactly one ${LAYOUT}`);
  }
  if (text.includes("[pic4]")) throw new Error(`${id}: [pic4] already present`);
  const pic3 = [...text.matchAll(PIC3_DEF)];
  if (pic3.length !== 1) throw new Error(`${id}: expected one pic3 definition`);

  const at = text.indexOf(LAYOUT);
  const end = text.indexOf(SLIDE_END, at);
  if (end === -1) throw new Error(`${id}: new slide has no closing ---`);

  const def = `\n\npic4\n\n ![](/api/attachments.redirect?id=${attachmentId} " =${WIDTH}x${HEIGHT}")`;
  const p3End = pic3[0].index! + pic3[0][0].length;
  return (
    text.slice(0, at) +
    "[layout: image-left]" +
    text.slice(at + LAYOUT.length, end) +
    "\n[pic4]" +
    text.slice(end, p3End) +
    def +
    text.slice(p3End)
  );
}

async function main() {
  const client = createOutlineClient();
  const texts = await Promise.all(IDS.map((id) => client.getDocumentText(id)));

  // Dry-splice with a placeholder id so a structural surprise aborts before
  // the upload.
  texts.forEach((t, i) => splice(IDS[i], t, "PLACEHOLDER"));
  if (DRY) {
    console.log(
      `DRY RUN — would upload ${SHOT} and update ${IDS.length} docs.`,
    );
    return;
  }

  const { id: attachmentId } = await client.uploadAttachment(SHOT, {
    name: "deploy-app-decentralized.png",
    documentId: IDS[0],
  });
  console.log(`↑ uploaded ${SHOT} → ${attachmentId}`);

  for (const [i, id] of IDS.entries()) {
    await client.updateDocument(id, splice(id, texts[i], attachmentId));
    console.log(`✓ ${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
