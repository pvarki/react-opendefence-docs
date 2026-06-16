#!/usr/bin/env tsx
/**
 * One-off Outline restructure (2026-06-15): split the bloated ATAK
 * "Basic Features" / "Advanced Features" chapters. Keep the original chapters in
 * place, then move the newly-authored chapters into focused thematic chapters
 * shown after Basic & Advanced, under the existing "USING ATAK FEATURES" toporg.
 *
 *   tsx scripts/oneoff/2026-06-15-atak-thematic-toporgs.ts [--dry-run]
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const dryRun = process.argv.includes("--dry-run");

const TAK_COLLECTION = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const USING_ATAK_FEATURES = "fda44988-73cb-4c32-9353-3969c5397a04";

// New thematic chapters (created under USING ATAK FEATURES) and the leaf titles
// moved into each, in the order they should appear.
const THEMES: Array<{ title: string; leaves: string[] }> = [
  {
    title: "Navigation & Coordinates",
    leaves: [
      "Go To Coordinates",
      "Get Location with Red X",
      "Get Coordinates with Center Designator",
      "Off-Screen Marker Indicators",
      "Control Location Providers",
      "Navigate a Route",
      "Track to a Target with Bloodhound",
      "Resection (No-GPS Location)",
    ],
  },
  {
    title: "Range & Bearing",
    leaves: [
      "Measure Range & Bearing",
      "Dynamic Range & Bearing",
      "Range Rings & Bullseye",
    ],
  },
  {
    title: "Markers & Drawing",
    leaves: [
      "Customize Markers & Icons",
      "Drop a CASEVAC 9-Line",
      "Draw Shapes & Graphics",
    ],
  },
  {
    title: "Terrain & 3D",
    leaves: [
      "Use 3D Terrain View",
      "Add 3D Models to Map",
      "Scout with First-Person View",
      "Elevation & Viewshed Tools",
      "Manage Elevation Sources",
      "Georeference an Image (Rubber Sheet)",
    ],
  },
  {
    title: "Team Comms & Alerts",
    leaves: ["Manage Contacts", "Digital Pointer", "Broadcast Emergency Alert"],
  },
  {
    title: "Data & Setup",
    leaves: [
      "Track Movement (GPS Tracks)",
      "Import Files & Remote Resources",
      "Setup Encrypted Mesh Comms",
      "Report Issues & Send Feedback",
    ],
  },
];

// Final order of chapters under USING ATAK FEATURES.
const CHAPTER_ORDER = [
  "Basic Features",
  "Advanced Features",
  "Navigation & Coordinates",
  "Range & Bearing",
  "Markers & Drawing",
  "Terrain & 3D",
  "Team Comms & Alerts",
  "Radio & Video",
  "Data & Setup",
];

const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  // Current chapters under USING ATAK FEATURES.
  const chapters = await client.listDocuments({
    collectionId: TAK_COLLECTION,
    parentDocumentId: USING_ATAK_FEATURES,
  });
  const chapterId = (t: string) =>
    chapters.find((c) => norm(c.title) === norm(t))?.id;

  // Build title -> leafId from the leaves currently under Basic + Advanced.
  const leafIndex = new Map<string, string>();
  for (const src of ["Basic Features", "Advanced Features"]) {
    const id = chapterId(src);
    if (!id) throw new Error(`Chapter "${src}" not found`);
    for (const leaf of await client.listDocuments({
      collectionId: TAK_COLLECTION,
      parentDocumentId: id,
    })) {
      leafIndex.set(norm(leaf.title), leaf.id);
    }
  }

  // 1) Create the thematic chapter organizers (find-or-create), keep their ids.
  const themeId = new Map<string, string>();
  for (const theme of THEMES) {
    const existing = chapters.find((c) => norm(c.title) === norm(theme.title));
    if (existing) {
      themeId.set(theme.title, existing.id);
      console.log(`= chapter "${theme.title}" exists (${existing.id})`);
      continue;
    }
    if (dryRun) {
      console.log(`+ would CREATE chapter "${theme.title}"`);
      themeId.set(theme.title, `DRY-${theme.title}`);
      continue;
    }
    const created = await client.createDocument({
      collectionId: TAK_COLLECTION,
      parentDocumentId: USING_ATAK_FEATURES,
      title: theme.title,
      text: "",
      publish: true,
    });
    themeId.set(theme.title, created.id);
    console.log(`+ created chapter "${theme.title}" → ${created.id}`);
    await sleep(200);
  }

  // 2) Move each new leaf into its thematic chapter, in order.
  let moved = 0;
  const missing: string[] = [];
  for (const theme of THEMES) {
    const parentId = themeId.get(theme.title)!;
    for (let i = 0; i < theme.leaves.length; i++) {
      const leafTitle = theme.leaves[i];
      const id = leafIndex.get(norm(leafTitle));
      if (!id) {
        missing.push(leafTitle);
        continue;
      }
      if (dryRun) {
        console.log(`  → would move "${leafTitle}" to "${theme.title}" [${i}]`);
        continue;
      }
      await client.moveDocument({
        id,
        collectionId: TAK_COLLECTION,
        parentDocumentId: parentId,
        index: i,
      });
      moved++;
      console.log(`  → moved "${leafTitle}" → "${theme.title}" [${i}]`);
      await sleep(200);
    }
  }

  // 3) Order the chapters under USING ATAK FEATURES.
  for (let i = 0; i < CHAPTER_ORDER.length; i++) {
    const title = CHAPTER_ORDER[i];
    const id = chapterId(title) ?? themeId.get(title);
    if (!id || id.startsWith("DRY-")) {
      console.log(
        `  ~ order[${i}] ${title}: ${id ? "(new, dry)" : "NOT FOUND"}`,
      );
      continue;
    }
    if (dryRun) {
      console.log(`  ~ would order "${title}" → [${i}]`);
      continue;
    }
    await client.moveDocument({
      id,
      collectionId: TAK_COLLECTION,
      parentDocumentId: USING_ATAK_FEATURES,
      index: i,
    });
    console.log(`  ~ ordered "${title}" → [${i}]`);
    await sleep(200);
  }

  console.log(
    `\nDone. ${dryRun ? "(dry run) " : ""}moved ${moved} leaves into ${THEMES.length} thematic chapters.`,
  );
  if (missing.length)
    console.log(`⚠ leaves not found (skipped): ${missing.join(", ")}`);
}

main().catch((e: unknown) => {
  console.error("restructure failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
