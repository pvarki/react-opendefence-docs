/**
 * Phase 2a reorder (TAK i18n): Outline createDocument PREPENDS children, so the
 * cloned fi/sv siblings came out reversed. Reorder every multi-child parent's
 * fi/sv children to match the EN order via documents.move with an explicit index.
 *
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-reorder.ts                 # dry-run
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-reorder.ts --apply
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-reorder.ts --apply --only <enParentId>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const OUT = "/tmp/tak-i18n";
const APPLY = process.argv.includes("--apply");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1] : undefined;
})();
const LOCALES = ["fi", "sv"] as const;
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type N = { id: string; title: string; children: N[] };

async function moveRetry(id: string, parentDocumentId: string, index: number) {
  for (let a = 1; a <= 6; a++) {
    try {
      await client.moveDocument({
        id,
        collectionId: TAK,
        parentDocumentId,
        index,
      });
      return;
    } catch (e) {
      if (a === 6) throw e;
      await sleep(2000 * 2 ** (a - 1));
    }
  }
}

async function main() {
  const struct = (await client.getCollectionStructure(TAK, "")) as Record<
    string,
    N
  >;

  // enId -> { fi, sv } locale ids
  const map: Record<string, Record<string, string>> = {};
  const set = (enId: string, loc: string, id: string) => {
    (map[enId] ??= {})[loc] = id;
  };
  // structural seeds
  for (const loc of LOCALES) {
    set(struct.en.id, loc, struct[loc].id);
    const enPlat = struct.en.children.find((c) => c.title === "Platforms")!;
    const locPlat = struct[loc].children.find((c) => c.title === "Platforms")!;
    set(enPlat.id, loc, locPlat.id);
  }
  for (const line of readFileSync(`${OUT}/created.tsv`, "utf8").split("\n")) {
    const [enId, loc, id] = line.split("\t");
    if (enId && loc && id) set(enId, loc, id);
  }

  let moves = 0;
  let parents = 0;
  const problems: string[] = [];

  async function visit(node: N) {
    const kids = node.children ?? [];
    if (kids.length >= 2 && (!ONLY || node.id === ONLY)) {
      parents++;
      for (const loc of LOCALES) {
        const parentLoc = map[node.id]?.[loc];
        if (!parentLoc) {
          problems.push(`${loc}: no parent map for ${node.title}`);
          continue;
        }
        for (let i = 0; i < kids.length; i++) {
          const childLoc = map[kids[i].id]?.[loc];
          if (!childLoc) {
            problems.push(`${loc}: no child map for ${kids[i].title}`);
            continue;
          }
          if (APPLY) await moveRetry(childLoc, parentLoc, i);
          moves++;
        }
        if (APPLY)
          console.log(
            `  ✓ ${loc}: reordered ${kids.length} children of "${node.title}"`,
          );
      }
    }
    for (const k of kids) await visit(k);
  }
  await visit(struct.en);

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${APPLY ? "moved" : "would move"}: ${moves}   parents: ${parents}   problems: ${problems.length}`,
  );
  problems.slice(0, 20).forEach((p) => console.log("  - " + p));
}

main().catch((e) => {
  console.error("REORDER ERROR:", e);
  process.exit(1);
});
