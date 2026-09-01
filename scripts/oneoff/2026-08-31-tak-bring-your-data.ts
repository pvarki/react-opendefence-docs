/**
 * One-off: create the "Bringing your data to TAK" chapter in the Working with
 * TAK dev book, from drafts + screenshots produced in the demo session
 * scratchpad (opendefense-platform scripts/dronewx demonstrator).
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-08-31-tak-bring-your-data.ts
 *
 * Idempotent: docs are find-or-created by title and bodies re-pushed on every
 * run; screenshots are uploaded once and their attachment URLs cached next to
 * the drafts; sibling order is re-asserted. Drafts reference images as
 * `](IMAGE:<file>.png)` placeholders, replaced with the uploaded URLs here.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createOutlineClient, type OutlineApiClient } from "../lib/outline-api";

const WORK =
  "/private/tmp/claude-501/-Users-bbr-Documents-GitHub-fdfinfohack-opendefense-platform/f06e35eb-ae25-40c0-8012-04181c8cf945/scratchpad/docs-work";
const DRAFTS = `${WORK}/drafts`;
const IMAGES = `${WORK}/images`;
const IMAGE_CACHE = `${WORK}/uploaded-images.json`;

const WORKING_WITH_TAK_ID = "74d6c3aa-0666-44a7-ae41-73632c67c30a";
const CHAPTER_TITLE = "Bringing your data to TAK";

const PAGES: { key: string; title: string }[] = [
  { key: "show", title: "What you can show in TAK clients" },
  { key: "manual", title: "Importing a data source manually" },
  { key: "programmatic", title: "Importing a data source programmatically" },
  { key: "standard", title: "Defining standard data sources" },
  { key: "worked", title: "Worked example: drone weather in ATAK" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function draftBody(key: string): string {
  const path = `${DRAFTS}/${key}.md`;
  if (!existsSync(path)) throw new Error(`Missing draft: ${path}`);
  return readFileSync(path, "utf8");
}

async function findOrCreateDoc(
  client: OutlineApiClient,
  opts: {
    collectionId: string;
    parentDocumentId?: string;
    title: string;
    text: string;
  },
): Promise<string> {
  const siblings = await client.listDocuments({
    collectionId: opts.collectionId,
    parentDocumentId: opts.parentDocumentId,
  });
  const hit = siblings.find(
    (d) => d.title.trim().toLowerCase() === opts.title.trim().toLowerCase(),
  );
  if (hit) {
    await client.updateDocument(hit.id, opts.text);
    await sleep(120);
    return hit.id;
  }
  const doc = await client.createDocument({ ...opts, publish: true });
  await sleep(120);
  return doc.id;
}

/** Upload each referenced screenshot once; cache id/url across runs. */
async function resolveImages(
  client: OutlineApiClient,
  bodies: string[],
): Promise<Record<string, string>> {
  const cache: Record<string, string> = existsSync(IMAGE_CACHE)
    ? JSON.parse(readFileSync(IMAGE_CACHE, "utf8"))
    : {};
  const wanted = new Set<string>();
  for (const b of bodies) {
    for (const m of b.matchAll(/\]\(IMAGE:([\w.-]+)\)/g)) wanted.add(m[1]);
  }
  for (const file of wanted) {
    if (cache[file]) continue;
    const path = `${IMAGES}/${file}`;
    if (!existsSync(path)) throw new Error(`Missing screenshot: ${path}`);
    const { url } = await client.uploadAttachment(path);
    cache[file] = url;
    console.log(`  uploaded ${file}`);
    await sleep(150);
  }
  writeFileSync(IMAGE_CACHE, JSON.stringify(cache, null, 2));
  return cache;
}

async function main() {
  const client = createOutlineClient();

  const roots = await client.getCollectionDocuments(WORKING_WITH_TAK_ID);
  const en = roots.find((d) => d.title.trim().toLowerCase() === "en");
  if (!en) throw new Error("working-with-tak: no 'en' root doc found");

  const bodies = Object.fromEntries(
    PAGES.map((p) => [p.key, draftBody(p.key)]),
  );
  console.log("Screenshots:");
  const images = await resolveImages(client, Object.values(bodies));
  const resolve = (text: string) =>
    text.replace(/\]\(IMAGE:([\w.-]+)\)/g, (_, f) => `](${images[f]})`);

  console.log("Chapter:");
  const chapter = await findOrCreateDoc(client, {
    collectionId: WORKING_WITH_TAK_ID,
    parentDocumentId: en.id,
    title: CHAPTER_TITLE,
    text: "",
  });
  console.log(`  ${CHAPTER_TITLE}: ${chapter}`);

  const ids: string[] = [];
  for (const p of PAGES) {
    const id = await findOrCreateDoc(client, {
      collectionId: WORKING_WITH_TAK_ID,
      parentDocumentId: chapter,
      title: p.title,
      text: resolve(bodies[p.key]),
    });
    ids.push(id);
    console.log(`  page ${p.key}: ${id}`);
  }

  // documents.create prepends, so re-assert the intended order; put the new
  // chapter right after "TAK on the OpenDefence Platform" (index 1).
  for (let i = 0; i < ids.length; i++) {
    await client.moveDocument({
      id: ids[i],
      collectionId: WORKING_WITH_TAK_ID,
      parentDocumentId: chapter,
      index: i,
    });
    await sleep(120);
  }
  await client.moveDocument({
    id: chapter,
    collectionId: WORKING_WITH_TAK_ID,
    parentDocumentId: en.id,
    index: 1,
  });
  console.log("Done. Now run: pnpm sync:collection working-with-tak");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
