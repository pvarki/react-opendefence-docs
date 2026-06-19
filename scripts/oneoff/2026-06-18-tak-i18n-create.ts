/**
 * Phase 2a create (TAK i18n): clone the translated tree into Outline under the
 * fi and sv locale roots. Parent-mapped, ordered (DFS pre-order = sibling order
 * preserved), resilient (retry) and resumable (state log).
 *
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-create.ts            # dry-run
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-create.ts --apply    # create+publish
 *
 * Inputs: /tmp/tak-i18n/nodes.json, /tmp/tak-i18n/titles.json,
 *         /tmp/tak-i18n/{fi,sv}/<enId>.md
 * State:  /tmp/tak-i18n/created.tsv   (enId \t locale \t newId)
 */
import "dotenv/config";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const OUT = "/tmp/tak-i18n";
const APPLY = process.argv.includes("--apply");
const LOCALES = ["fi", "sv"] as const;
type Locale = (typeof LOCALES)[number];

const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlanNode {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  isLeaf: boolean;
  markers: string[];
  skipCreate: boolean;
}

async function createRetry(opts: {
  parentDocumentId: string;
  title: string;
  text: string;
}): Promise<string> {
  let lastErr: unknown;
  for (let a = 1; a <= 6; a++) {
    try {
      const doc = await client.createDocument({
        collectionId: TAK,
        parentDocumentId: opts.parentDocumentId,
        title: opts.title,
        text: opts.text,
        publish: true,
      });
      return doc.id;
    } catch (e) {
      lastErr = e;
      const w = 2000 * 2 ** (a - 1);
      console.log(
        `      …retry ${a}/6 (${(e as Error)?.message ?? e}); wait ${w / 1000}s`,
      );
      await sleep(w);
    }
  }
  throw lastErr;
}

async function main() {
  const plan: PlanNode[] = JSON.parse(
    readFileSync(`${OUT}/nodes.json`, "utf8"),
  );
  const titles: Record<string, { fiTitle: string; svTitle: string }> =
    JSON.parse(readFileSync(`${OUT}/titles.json`, "utf8"));

  // Resolve structural anchors (locale roots + existing "Platforms" organizers).
  const struct = (await client.getCollectionStructure(TAK, "")) as Record<
    string,
    { id: string; title: string; children: { id: string; title: string }[] }
  >;
  const enRootId = struct.en.id;
  const enPlatformsId = struct.en.children.find(
    (c) => c.title === "Platforms",
  )!.id;

  // map[locale][enNodeId] = localeDocId
  const map: Record<Locale, Record<string, string>> = { fi: {}, sv: {} };
  for (const loc of LOCALES) {
    map[loc][enRootId] = struct[loc].id;
    const platforms = struct[loc].children.find((c) => c.title === "Platforms");
    if (!platforms)
      throw new Error(`No existing "Platforms" organizer in ${loc} locale`);
    map[loc][enPlatformsId] = platforms.id;
  }

  // Resume: load already-created ids.
  const statePath = `${OUT}/created.tsv`;
  if (existsSync(statePath)) {
    for (const line of readFileSync(statePath, "utf8").split("\n")) {
      const [enId, loc, newId] = line.split("\t");
      if (enId && loc && newId) map[loc as Locale][enId] = newId;
    }
  }

  let created = 0;
  let skipped = 0;
  const missingParents: string[] = [];

  for (const node of plan) {
    if (node.skipCreate) continue;
    for (const loc of LOCALES) {
      if (map[loc][node.id]) {
        skipped++;
        continue;
      } // already created
      const parentLocaleId = node.parentId
        ? map[loc][node.parentId]
        : undefined;
      if (!parentLocaleId) {
        console.log(
          `  !! ${loc}: missing parent for "${node.title}" (enParent ${node.parentId})`,
        );
        missingParents.push(`${loc}:${node.title}`);
        continue;
      }
      const title =
        loc === "fi" ? titles[node.id]?.fiTitle : titles[node.id]?.svTitle;
      const bodyPath = `${OUT}/${loc}/${node.id}.md`;
      if (!title || !existsSync(bodyPath)) {
        console.log(
          `  !! ${loc}: missing translation for "${node.title}" (${node.id})`,
        );
        missingParents.push(`${loc}:${node.title}(no-translation)`);
        continue;
      }
      const text = readFileSync(bodyPath, "utf8");
      if (!APPLY) {
        map[loc][node.id] = `dry-${node.id}`; // so child nodes resolve their parent in dry-run
        created++;
        continue;
      }
      const newId = await createRetry({
        parentDocumentId: parentLocaleId,
        title,
        text,
      });
      map[loc][node.id] = newId;
      appendFileSync(statePath, `${node.id}\t${loc}\t${newId}\n`);
      created++;
      console.log(`  ✓ ${loc}: "${title}" → ${newId}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${APPLY ? "created" : "would create"}: ${created}   already-done: ${skipped}   problems: ${missingParents.length}`,
  );
  if (missingParents.length) {
    console.log("PROBLEMS:");
    for (const m of missingParents.slice(0, 40)) console.log("  - " + m);
  }
}

main().catch((e) => {
  console.error("CREATE ERROR:", e);
  process.exit(1);
});
