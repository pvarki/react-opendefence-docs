#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-11-05): Deploy App → Introduction gets a new
 * slide 3, "Decentralized, one server to one unit", before the former third
 * slide ("Developed to be augmented", now slide 4).
 *
 * The Introduction is a legacy slideset. The new slide uses `[layout: text]`
 * and has no [picN], so the existing pic1..pic3 keys stay untouched.
 * en/fi/sv are edited in lockstep (fi/sv are translations of the en copy).
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-11-05-intro-decentralized-slide.ts --dry-run
 *   pnpm tsx scripts/oneoff/2026-11-05-intro-decentralized-slide.ts
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const DRY = process.argv.includes("--dry-run");

interface Doc {
  id: string;
  /** Title of the slide the new one is inserted before. */
  before: string;
  slide: string;
}

const DOCS: Doc[] = [
  {
    id: "ed412ef0-5e77-4db2-a774-303a9e42119f", // en
    before: "Developed to be augmented",
    slide: `# Decentralized, one server to one unit
[layout: text]
- The unit knows who their fighters are and who needs what access.
- Deploy App lets them have full control of their very own Deploy App server. No slow and dangerous centralized identity management.

You can spin them up in the cloud or on your own boxes, whichever you want to operate.`,
  },
  {
    id: "ef1e49fe-2f98-479a-b6d2-59645d01ddd4", // fi
    before: "Kehitetty laajennettavaksi",
    slide: `# Hajautettu, yksi palvelin yhtä yksikköä kohti
[layout: text]
- Yksikkö tietää, keitä sen taistelijat ovat ja kuka tarvitsee mitäkin pääsyä.
- Deploy App antaa yksikölle täyden hallinnan omaan Deploy App -palvelimeensa. Ei hidasta ja vaarallista keskitettyä identiteetinhallintaa.

Voit pystyttää palvelimet pilveen tai omille laitteillesi sen mukaan, mitä haluat operoida.`,
  },
  {
    id: "9551fc89-fe7f-46b2-a890-64209d4acbe7", // sv
    before: "Utvecklad för att utökas",
    slide: `# Decentraliserat, en server per enhet
[layout: text]
- Enheten vet vilka dess soldater är och vem som behöver vilken åtkomst.
- Deploy App ger enheten full kontroll över sin alldeles egna Deploy App-server. Ingen långsam och farlig centraliserad identitetshantering.

Du kan starta dem i molnet eller på egna maskiner, precis det du vill driva.`,
  },
];

async function main() {
  const client = createOutlineClient();

  // Read + splice everything first so a structural surprise aborts before
  // any write.
  const edits = await Promise.all(
    DOCS.map(async (d) => {
      const text = await client.getDocumentText(d.id);
      if (text.includes(d.slide.split("\n")[0])) {
        throw new Error(`${d.id}: new slide already present`);
      }
      const marker = `---\n# ${d.before}\n`;
      if (text.split(marker).length !== 2) {
        throw new Error(`${d.id}: expected exactly one "${marker.trim()}"`);
      }
      const next = text.replace(marker, `---\n\n${d.slide}\n\n${marker}`);
      return { id: d.id, next };
    }),
  );

  for (const e of edits) {
    if (DRY) {
      console.log(`- ${e.id}: would insert slide`);
      continue;
    }
    await client.updateDocument(e.id, e.next);
    console.log(`✓ ${e.id}`);
  }
  if (DRY) console.log("\nDRY RUN — nothing written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
