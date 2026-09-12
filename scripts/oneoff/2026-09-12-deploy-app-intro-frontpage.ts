#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-09-12): Deploy App → Introduction, slide
 * "Developed to be augmented" gets a desktop-width front page screenshot
 * (TAK + MediaMTX + Matrix) instead of the mobile shot it borrowed from slide 1.
 *
 * Source: https://demo.opendefence.fi captured at 1680 CSS px, English, demo
 * chrome and footer hidden — see drafts/deploy-app/intro-frontpage.png.
 *
 * The Introduction is a legacy slideset: the body references [pic1]..[pic3] and
 * the images sit at the bottom of the document. Only pic3's line changes. The
 * upload happens once (en) and all three locales point at the same attachment,
 * matching how the other two slides already share images.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-09-12-deploy-app-intro-frontpage.ts --dry-run
 *   pnpm tsx scripts/oneoff/2026-09-12-deploy-app-intro-frontpage.ts
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const DRY = process.argv.includes("--dry-run");
const SHOT = "drafts/deploy-app/intro-frontpage.png";
const WIDTH = 3360;
const HEIGHT = 1240;

const IDS = [
  "ed412ef0-5e77-4db2-a774-303a9e42119f", // en
  "ef1e49fe-2f98-479a-b6d2-59645d01ddd4", // fi
  "9551fc89-fe7f-46b2-a890-64209d4acbe7", // sv
];

const IMG_RE = /!\[[^\]]*\]\([^)]*attachments\.redirect[^)]*\)/g;

async function main() {
  const client = createOutlineClient();

  // Read all three first so a structural surprise aborts before the upload.
  const docs = await Promise.all(
    IDS.map(async (id) => {
      const text = await client.getDocumentText(id);
      const imgs = [...text.matchAll(IMG_RE)];
      if (imgs.length !== 3) {
        throw new Error(`${id}: expected 3 images, found ${imgs.length}`);
      }
      return { id, text, last: imgs[2] };
    }),
  );

  if (DRY) {
    for (const d of docs) console.log(`- ${d.id}: would replace ${d.last[0]}`);
    console.log(
      `\nDRY RUN — would upload ${SHOT} and update ${docs.length} documents.`,
    );
    return;
  }

  // Reuse an attachment from an earlier run rather than uploading a duplicate.
  const reuse = process.argv[process.argv.indexOf("--attachment") + 1];
  let attachmentId = process.argv.includes("--attachment") ? reuse : "";
  if (attachmentId) {
    console.log(`= reusing attachment ${attachmentId}`);
  } else {
    ({ id: attachmentId } = await client.uploadAttachment(SHOT, {
      name: "deploy-app-frontpage.png",
      documentId: IDS[0],
    }));
    console.log(`↑ uploaded ${SHOT} → ${attachmentId}`);
  }

  // Empty alt text is load-bearing: scripts/lib/slideset/legacy.ts pairs a
  // [picN] key with its image by matching the literal "![](" form.
  const replacement = `![](/api/attachments.redirect?id=${attachmentId} " =${WIDTH}x${HEIGHT}")`;

  for (const d of docs) {
    const next =
      d.text.slice(0, d.last.index!) +
      replacement +
      d.text.slice(d.last.index! + d.last[0].length);
    await client.updateDocument(d.id, next);
    console.log(`✓ ${d.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
