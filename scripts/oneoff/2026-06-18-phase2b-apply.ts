/**
 * Phase 2b apply: create / reorder / link the fill-gap clones for matrix,
 * cryptpad and deploy. Generalized over collections via seeds.json.
 *
 *   npx tsx scripts/oneoff/2026-06-18-phase2b-apply.ts create  [--apply]
 *   npx tsx scripts/oneoff/2026-06-18-phase2b-apply.ts reorder [--apply]
 *   npx tsx scripts/oneoff/2026-06-18-phase2b-apply.ts link    [--apply]
 */
import "dotenv/config";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const OUT = "/tmp/phase2b";
const MODE = process.argv[2];
const APPLY = process.argv.includes("--apply");
const LOCALES = ["fi", "sv"] as const;
type Locale = (typeof LOCALES)[number];
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlanNode {
  collection: string;
  id: string;
  title: string;
  parentId: string;
  isLeaf: boolean;
}
interface Seed {
  collection: string;
  enAnchor: string;
  fiAnchor: string;
  svAnchor: string;
  siblings: Record<string, { fi: string; sv: string }>;
}
type N = { id: string; title: string; url: string; children: N[] };

const plan: PlanNode[] = JSON.parse(readFileSync(`${OUT}/nodes.json`, "utf8"));
const titles: Record<string, { fiTitle: string; svTitle: string }> = JSON.parse(
  readFileSync(`${OUT}/titles.json`, "utf8"),
);
const seeds: Record<string, Seed> = JSON.parse(
  readFileSync(`${OUT}/seeds.json`, "utf8"),
);
const seedByCollection: Record<string, Seed> = {};
for (const s of Object.values(seeds)) seedByCollection[s.collection] = s;

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let a = 1; a <= 6; a++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const w = 2000 * 2 ** (a - 1);
      console.log(
        `      …retry ${a}/6 (${(e as Error)?.message ?? e}); wait ${w / 1000}s`,
      );
      await sleep(w);
    }
  }
  throw last;
}

// enId -> {fi,sv} localeId, seeded with anchors + pre-existing siblings + created.tsv
function buildMap(): Record<string, Partial<Record<Locale, string>>> {
  const map: Record<string, Partial<Record<Locale, string>>> = {};
  const set = (en: string, loc: Locale, id: string) =>
    ((map[en] ??= {})[loc] = id);
  for (const s of Object.values(seeds)) {
    set(s.enAnchor, "fi", s.fiAnchor);
    set(s.enAnchor, "sv", s.svAnchor);
    for (const [en, l] of Object.entries(s.siblings)) {
      set(en, "fi", l.fi);
      set(en, "sv", l.sv);
    }
  }
  const statePath = `${OUT}/created.tsv`;
  if (existsSync(statePath)) {
    for (const line of readFileSync(statePath, "utf8").split("\n")) {
      const [en, loc, id] = line.split("\t");
      if (en && loc && id) set(en, loc as Locale, id);
    }
  }
  return map;
}

async function structOf(collection: string): Promise<Record<string, N>> {
  return retry(() => client.getCollectionStructure(collection, "")) as Promise<
    Record<string, N>
  >;
}
function indexTree(n: N, out: Map<string, { slug: string; title: string }>) {
  out.set(n.id, {
    slug: n.url.slice(n.url.lastIndexOf("/") + 1),
    title: n.title,
  });
  for (const c of n.children ?? []) indexTree(c, out);
}
function stripTranslations(b: string): string {
  return b
    .replace(/\n*^---\s*\n\s*\*\s*Translations:[\s\S]*?^---\s*$/gm, "")
    .replace(/\n*\* Translations:\s*\n(?:\s*\*\s+\w+:.*\n)+/g, "")
    .trimEnd();
}

async function doCreate() {
  const map = buildMap();
  const statePath = `${OUT}/created.tsv`;
  let created = 0;
  const problems: string[] = [];
  for (const node of plan) {
    for (const loc of LOCALES) {
      if (map[node.id]?.[loc]) continue;
      const parent = map[node.parentId]?.[loc];
      if (!parent) {
        problems.push(`${loc}: no parent for "${node.title}"`);
        continue;
      }
      const title =
        loc === "fi" ? titles[node.id]?.fiTitle : titles[node.id]?.svTitle;
      const bodyPath = `${OUT}/${loc}/${node.id}.md`;
      if (!title || !existsSync(bodyPath)) {
        problems.push(`${loc}: no translation for "${node.title}"`);
        continue;
      }
      const text = readFileSync(bodyPath, "utf8");
      if (!APPLY) {
        (map[node.id] ??= {})[loc] = `dry-${node.id}`;
        created++;
        continue;
      }
      const doc = await retry(() =>
        client.createDocument({
          collectionId: node.collection,
          parentDocumentId: parent,
          title,
          text,
          publish: true,
        }),
      );
      (map[node.id] ??= {})[loc] = doc.id;
      appendFileSync(statePath, `${node.id}\t${loc}\t${doc.id}\n`);
      created++;
      console.log(`  ✓ ${loc}: "${title}"`);
    }
  }
  console.log(
    `\n${APPLY ? "created" : "would create"}: ${created}  problems: ${problems.length}`,
  );
  problems.slice(0, 30).forEach((p) => console.log("  - " + p));
}

async function doReorder() {
  const map = buildMap();
  let moves = 0;
  const collections = [...new Set(plan.map((p) => p.collection))];
  for (const collection of collections) {
    const struct = await structOf(collection);
    const enRoot = struct.en;
    // walk en; reorder any parent that has >=2 children mapped in the locale
    async function visit(node: N) {
      const kids = node.children ?? [];
      const mappedKids = kids.filter((k) => map[k.id]); // only those we know in locales
      if (map[node.id] && mappedKids.length >= 2) {
        for (const loc of LOCALES) {
          const parentLoc = map[node.id][loc];
          if (!parentLoc) continue;
          let idx = 0;
          for (const k of kids) {
            const childLoc = map[k.id]?.[loc];
            if (!childLoc) continue; // locale-only or unmapped en child: leave in place
            if (APPLY)
              await retry(() =>
                client.moveDocument({
                  id: childLoc,
                  collectionId: collection,
                  parentDocumentId: parentLoc,
                  index: idx,
                }),
              );
            idx++;
            moves++;
          }
          if (APPLY)
            console.log(
              `  ✓ ${loc}: reordered ${idx} children of "${node.title}"`,
            );
        }
      }
      for (const k of kids) await visit(k);
    }
    await visit(enRoot);
  }
  console.log(`\n${APPLY ? "moved" : "would move"}: ${moves}`);
}

async function doLink() {
  const map = buildMap();
  const linkedPath = `${OUT}/linked.log`;
  const done = new Set<string>(
    existsSync(linkedPath)
      ? readFileSync(linkedPath, "utf8").split("\n").filter(Boolean)
      : [],
  );
  const collections = [...new Set(plan.map((p) => p.collection))];
  const idx: Record<string, Map<string, { slug: string; title: string }>> = {};
  for (const collection of collections) {
    const s = await structOf(collection);
    const m = new Map<string, { slug: string; title: string }>();
    indexTree(s.en, m);
    indexTree(s.fi, m);
    indexTree(s.sv, m);
    idx[collection] = m;
  }
  let updated = 0;
  for (const node of plan) {
    const enInfo = idx[node.collection].get(node.id);
    const fiId = map[node.id]?.fi;
    const svId = map[node.id]?.sv;
    if (!enInfo || !fiId || !svId) continue;
    const fiInfo = idx[node.collection].get(fiId);
    const svInfo = idx[node.collection].get(svId);
    if (!fiInfo || !svInfo) continue;
    const blk =
      `\n\n---\n\n* Translations:\n` +
      `  * en: [${enInfo.title}](/doc/${enInfo.slug})\n` +
      `  * fi: [${fiInfo.title}](/doc/${fiInfo.slug})\n` +
      `  * sv: [${svInfo.title}](/doc/${svInfo.slug})\n\n---\n`;
    for (const docId of [node.id, fiId, svId]) {
      if (done.has(docId)) continue;
      if (!APPLY) {
        updated++;
        continue;
      }
      const body = await retry(() => client.getDocumentText(docId));
      await retry(() =>
        client.updateDocument(docId, stripTranslations(body) + blk),
      );
      appendFileSync(linkedPath, docId + "\n");
      updated++;
    }
  }
  console.log(`\n${APPLY ? "linked" : "would link"} doc-updates: ${updated}`);
}

async function main() {
  if (MODE === "create") await doCreate();
  else if (MODE === "reorder") await doReorder();
  else if (MODE === "link") await doLink();
  else {
    console.error("usage: phase2b-apply.ts <create|reorder|link> [--apply]");
    process.exit(1);
  }
}
main().catch((e) => {
  console.error("PHASE2B ERROR:", e);
  process.exit(1);
});
