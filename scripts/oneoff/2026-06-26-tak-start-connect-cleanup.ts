#!/usr/bin/env tsx

/**
 * One-off Outline edit (2026-06-26): tidy the TAK guide's ATAK "START & CONNECT"
 * chapter across en/fi/sv.
 *
 *   - DELETE "Start from Deploy App" (duplicates content covered elsewhere).
 *     It's currently first, so removing it makes "Download the App" first and
 *     "Import Server Connection from Deploy App" second automatically — no
 *     reorder needed.
 *   - RENAME "Make sure you have the ATAK App" → "Download the App".
 *   - RENAME "Importing Server Connection" → "Import Server Connection from
 *     Deploy App".
 *
 * Safety: every target's CURRENT title is verified before any write; a single
 * mismatch aborts before touching anything. documents.delete moves to Outline
 * trash (recoverable ~30 days). Back up first: scripts/backup-outline.ts.
 * After running, sync the collection (pnpm tsx scripts/sync-outline.ts
 * --collection guides/tak-guide) to pull the changes into public/content.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-06-26-tak-start-connect-cleanup.ts --dry-run
 *   pnpm tsx scripts/oneoff/2026-06-26-tak-start-connect-cleanup.ts
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

interface Rename {
  id: string;
  from: string;
  to: string;
}
interface LocaleOps {
  locale: string;
  del: { id: string; title: string };
  renames: Rename[];
}

const OPS: LocaleOps[] = [
  {
    locale: "en",
    del: {
      id: "769c51c9-7f73-429e-aaf5-19240034b86c",
      title: "Start from Deploy App",
    },
    renames: [
      {
        id: "45a3e50c-b7c2-45d3-927d-bf2e2d97cbbf",
        from: "Make sure you have the ATAK App",
        to: "Download the App",
      },
      {
        id: "c8842f7a-f533-4bfe-9027-88f165d16ddb",
        from: "Importing Server Connection",
        to: "Import Server Connection from Deploy App",
      },
    ],
  },
  {
    locale: "fi",
    del: {
      id: "018c0695-81ac-4d0c-8b29-8257101c36de",
      title: "Aloita Deploy App -sovelluksesta",
    },
    renames: [
      {
        id: "0572cbe9-3292-4b00-9832-ee67c379108e",
        from: "Varmista, että sinulla on ATAK-sovellus",
        to: "Lataa sovellus",
      },
      {
        id: "10bde822-a52c-4b45-b555-facc61d49f5d",
        from: "Palvelinyhteyden tuonti",
        to: "Tuo palvelinyhteys Deploy Appista",
      },
    ],
  },
  {
    locale: "sv",
    del: {
      id: "f2884ea6-ea8d-4df7-88c0-3bf9b21430d5",
      title: "Börja från Deploy App",
    },
    renames: [
      {
        id: "533c534c-83ea-4469-8a21-9d7fe4118baa",
        from: "Se till att du har ATAK-appen",
        to: "Ladda ner appen",
      },
      {
        id: "d67c228d-562b-4ff9-97d0-790b8ce1dda6",
        from: "Importera serveranslutning",
        to: "Importera serveranslutning från Deploy App",
      },
    ],
  },
];

const DRY = process.argv.includes("--dry-run");
const client = createOutlineClient();

// 1) Verify every target's current title — abort the whole run on any mismatch
//    so we never act on a doc that has moved/changed since this was authored.
let mismatch = false;
for (const op of OPS) {
  const targets = [
    { id: op.del.id, title: op.del.title },
    ...op.renames.map((r) => ({ id: r.id, title: r.from })),
  ];
  for (const t of targets) {
    const info = await client.getDocumentInfo(t.id);
    const ok = info.title === t.title;
    if (!ok) mismatch = true;
    console.log(
      `${ok ? "✓" : "✗"} [${op.locale}] ${t.id} = "${info.title}"` +
        (ok ? "" : `  (expected "${t.title}")`),
    );
  }
}
if (mismatch) {
  throw new Error("Title mismatch — aborting before any writes.");
}

if (DRY) {
  console.log("\ndry-run: titles verified, no changes made.");
  process.exit(0);
}

// 2) Apply: rename the two keepers, then trash the duplicate.
for (const op of OPS) {
  for (const r of op.renames) {
    await client.renameDocument(r.id, r.to);
    console.log(`[${op.locale}] renamed "${r.from}" → "${r.to}"`);
  }
  await client.deleteDocument(op.del.id);
  console.log(`[${op.locale}] trashed "${op.del.title}" (${op.del.id})`);
}

console.log(
  "\nDone. Now sync: pnpm tsx scripts/sync-outline.ts --collection guides/tak-guide",
);
