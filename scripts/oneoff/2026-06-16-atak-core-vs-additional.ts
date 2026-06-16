#!/usr/bin/env tsx
/**
 * One-off Outline restructure (2026-06-16): split the ATAK guide into a CORE
 * block everyone should read and an ADDITIONAL block of secondary tools.
 *
 *   Core:        START & CONNECT, Basic Core Features, Advanced Core Features, USAGE BY ROLE
 *   Divider:     ADDITIONAL FEATURES (toporg) → Navigation & Coordinates,
 *                Range & Bearing Tools, Elevation/Terrain/Map Tools, Video in ATAK
 *   Plugins:     Supported Plugins → … + Radios & Hardware (PRC-152, mesh comms)
 *   Troubleshoot: + Report Issues & Send Feedback
 *
 *   tsx scripts/oneoff/2026-06-16-atak-core-vs-additional.ts [--dry-run]
 */
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const dry = process.argv.includes("--dry-run");
const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const ATAK = "685f6f0f-e7ca-4ba3-807f-568582663e95";
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.trim().toLowerCase();

type Doc = { id: string; title: string };
const kids = (parent: string) =>
  client.listDocuments({ collectionId: TAK, parentDocumentId: parent });
const pick = (list: Doc[], title: string) => {
  const d = list.find((x) => norm(x.title) === norm(title));
  if (!d) throw new Error(`Not found: "${title}"`);
  return d;
};

async function move(id: string, parent: string, index: number, label: string) {
  if (dry) return console.log(`  → move ${label} → [${index}]`);
  await client.moveDocument({
    id,
    collectionId: TAK,
    parentDocumentId: parent,
    index,
  });
  console.log(`  → moved ${label} → [${index}]`);
  await sleep(200);
}
async function rename(id: string, title: string) {
  if (dry) return console.log(`  ✎ rename → "${title}"`);
  await client.renameDocument(id, title);
  console.log(`  ✎ renamed → "${title}"`);
  await sleep(200);
}
async function setToporg(id: string) {
  if (dry) return console.log(`  # set META: toporg`);
  await client.updateDocument(id, "META: toporg\n");
  await sleep(200);
}
async function createOrg(parent: string, title: string, toporg: boolean) {
  const existing = (await kids(parent)).find(
    (x) => norm(x.title) === norm(title),
  );
  if (existing) return existing.id;
  if (dry) {
    console.log(`  + would create ${toporg ? "toporg" : "chapter"} "${title}"`);
    return `DRY-${title}`;
  }
  const c = await client.createDocument({
    collectionId: TAK,
    parentDocumentId: parent,
    title,
    text: toporg ? "META: toporg\n" : "",
    publish: true,
  });
  console.log(
    `  + created ${toporg ? "toporg" : "chapter"} "${title}" → ${c.id}`,
  );
  await sleep(200);
  return c.id;
}
async function del(id: string, label: string) {
  if (dry) return console.log(`  ✗ would delete ${label}`);
  await client.deleteDocument(id);
  console.log(`  ✗ deleted ${label}`);
  await sleep(200);
}

async function main() {
  const atakKids = await kids(ATAK);
  const intro = pick(atakKids, "INTRODUCTION");
  const usageByRole = pick(atakKids, "USAGE BY ROLE");
  const uaf = pick(atakKids, "USING ATAK FEATURES");
  const plugins = pick(atakKids, "Supported Plugins");
  const trouble = pick(atakKids, "TROUBLESHOOTING");

  const uafKids = await kids(uaf.id);
  const basic = pick(uafKids, "Basic Features");
  const advanced = pick(uafKids, "Advanced Features");
  const nav = pick(uafKids, "Navigation & Coordinates");
  const range = pick(uafKids, "Range & Bearing");
  const markers = pick(uafKids, "Markers & Drawing");
  const terrain = pick(uafKids, "Terrain & 3D");
  const teamComms = pick(uafKids, "Team Comms & Alerts");
  const video = pick(uafKids, "Radio & Video");
  const dataSetup = pick(uafKids, "Data & Setup");

  const markersLeaves = await kids(markers.id);
  const teamLeaves = await kids(teamComms.id);
  const dataLeaves = await kids(dataSetup.id);
  const videoLeaves = await kids(video.id);

  const leaf = (list: Doc[], t: string) => pick(list, t).id;

  console.log("== 1. Fill Advanced Core Features (move 6 pages in) ==");
  let ai = 100; // append after originals; final order tidied by Outline
  for (const t of [
    "Customize Markers & Icons",
    "Drop a CASEVAC 9-Line",
    "Draw Shapes & Graphics",
  ])
    await move(leaf(markersLeaves, t), advanced.id, ai++, `"${t}"`);
  for (const t of [
    "Manage Contacts",
    "Digital Pointer",
    "Broadcast Emergency Alert",
  ])
    await move(leaf(teamLeaves, t), advanced.id, ai++, `"${t}"`);

  console.log("== 2. Navigation & Elevation get one page each ==");
  await move(
    leaf(dataLeaves, "Track Movement (GPS Tracks)"),
    nav.id,
    100,
    "Track Movement",
  );
  await move(
    leaf(dataLeaves, "Import Files & Remote Resources"),
    terrain.id,
    100,
    "Import Files",
  );

  console.log("== 3. Plugins: Radios & Hardware ==");
  const radios = await createOrg(plugins.id, "Radios & Hardware", false);
  await move(
    leaf(videoLeaves, "Connect to PRC-152 / Rover Radio"),
    radios,
    0,
    "PRC-152",
  );
  await move(
    leaf(dataLeaves, "Setup Encrypted Mesh Comms"),
    radios,
    1,
    "Mesh Comms",
  );

  console.log("== 4. Troubleshooting gets feedback page ==");
  await move(
    leaf(dataLeaves, "Report Issues & Send Feedback"),
    trouble.id,
    100,
    "Report Issues",
  );

  console.log("== 5. Rename + promote core sections ==");
  await rename(intro.id, "START & CONNECT");
  await setToporg(basic.id);
  await rename(basic.id, "Basic Core Features");
  await setToporg(advanced.id);
  await rename(advanced.id, "Advanced Core Features");

  console.log("== 6. ADDITIONAL FEATURES divider + secondary chapters ==");
  const additional = await createOrg(ATAK, "ADDITIONAL FEATURES", true);
  await move(nav.id, additional, 0, "Navigation & Coordinates");
  await move(range.id, additional, 1, "Range & Bearing");
  await rename(range.id, "Range & Bearing Tools");
  await move(terrain.id, additional, 2, "Terrain & 3D");
  await rename(terrain.id, "Elevation, Terrain & Map Tools");
  await move(video.id, additional, 3, "Radio & Video");
  await rename(video.id, "Video in ATAK");

  console.log("== 7. Promote core feature sections to platform level ==");
  await move(basic.id, ATAK, 1, "Basic Core Features");
  await move(advanced.id, ATAK, 2, "Advanced Core Features");

  console.log("== 8. Delete emptied wrappers ==");
  await del(markers.id, "Markers & Drawing");
  await del(teamComms.id, "Team Comms & Alerts");
  await del(dataSetup.id, "Data & Setup");
  await del(uaf.id, "USING ATAK FEATURES");

  console.log("== 9. Platform-level order ==");
  const order = [
    intro.id,
    basic.id,
    advanced.id,
    usageByRole.id,
    additional,
    plugins.id,
    trouble.id,
  ];
  const labels = [
    "START & CONNECT",
    "Basic Core Features",
    "Advanced Core Features",
    "USAGE BY ROLE",
    "ADDITIONAL FEATURES",
    "Supported Plugins",
    "TROUBLESHOOTING",
  ];
  for (let i = 0; i < order.length; i++) {
    if (order[i].startsWith("DRY-")) {
      console.log(`  ~ order[${i}] ${labels[i]} (new, dry)`);
      continue;
    }
    await move(order[i], ATAK, i, labels[i]);
  }

  console.log(`\nDone.${dry ? " (dry run)" : ""}`);
}

main().catch((e: unknown) => {
  console.error("restructure failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
