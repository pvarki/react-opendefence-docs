/**
 * Phase 2a link (TAK i18n): add a resolving "* Translations:" block to the en,
 * fi and sv version of every cloned node, so the language switcher works.
 *
 * Links use the page SLUG (url last segment) — NOT the doc uuid — because the
 * sync resolves a link's last path segment against manifest slugs. (The legacy
 * /doc/<uuid> links in older content do not resolve; this fixes the pattern.)
 *
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-link.ts            # dry-run
 *   npx tsx scripts/oneoff/2026-06-18-tak-i18n-link.ts --apply
 */
import "dotenv/config";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const OUT = "/tmp/tak-i18n";
const APPLY = process.argv.includes("--apply");
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Info {
  slug: string;
  title: string;
}
type Node = { id: string; title: string; url: string; children: Node[] };

function indexTree(node: Node, out: Map<string, Info>) {
  const slug = node.url.slice(node.url.lastIndexOf("/") + 1);
  out.set(node.id, { slug, title: node.title });
  for (const c of node.children ?? []) indexTree(c, out);
}

function stripExistingTranslations(body: string): string {
  return body
    .replace(/\n*^---\s*\n\s*\*\s*Translations:[\s\S]*?^---\s*$/gm, "")
    .replace(/\n*\* Translations:\s*\n(?:\s*\*\s+\w+:.*\n)+/g, "")
    .trimEnd();
}

function block(en: Info, fi: Info, sv: Info): string {
  return (
    `\n\n---\n\n* Translations:\n` +
    `  * en: [${en.title}](/doc/${en.slug})\n` +
    `  * fi: [${fi.title}](/doc/${fi.slug})\n` +
    `  * sv: [${sv.title}](/doc/${sv.slug})\n\n---\n`
  );
}

async function updateRetry(id: string, text: string): Promise<void> {
  let lastErr: unknown;
  for (let a = 1; a <= 6; a++) {
    try {
      await client.updateDocument(id, text);
      return;
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
  // enId -> {fi, sv} doc ids
  const created = new Map<string, { fi?: string; sv?: string }>();
  for (const line of readFileSync(`${OUT}/created.tsv`, "utf8").split("\n")) {
    const [enId, loc, newId] = line.split("\t");
    if (!enId || !loc || !newId) continue;
    const e = created.get(enId) ?? {};
    (e as Record<string, string>)[loc] = newId;
    created.set(enId, e);
  }

  const struct = (await client.getCollectionStructure(TAK, "")) as Record<
    string,
    Node
  >;
  const enIdx = new Map<string, Info>();
  const fiIdx = new Map<string, Info>();
  const svIdx = new Map<string, Info>();
  indexTree(struct.en, enIdx);
  indexTree(struct.fi, fiIdx);
  indexTree(struct.sv, svIdx);

  const linkedPath = `${OUT}/linked.log`;
  const done = new Set<string>(
    existsSync(linkedPath)
      ? readFileSync(linkedPath, "utf8").split("\n").filter(Boolean)
      : [],
  );

  let updated = 0;
  let problems = 0;
  for (const [enId, ids] of created) {
    if (!ids.fi || !ids.sv) continue;
    const en = enIdx.get(enId);
    const fi = fiIdx.get(ids.fi);
    const sv = svIdx.get(ids.sv);
    if (!en || !fi || !sv) {
      console.log(
        `  !! missing info for ${enId} (en=${!!en} fi=${!!fi} sv=${!!sv})`,
      );
      problems++;
      continue;
    }
    const blk = block(en, fi, sv);
    for (const [, docId] of [
      ["en", enId],
      ["fi", ids.fi],
      ["sv", ids.sv],
    ] as const) {
      if (done.has(docId)) continue;
      if (!APPLY) {
        updated++;
        continue;
      }
      const body = await client.getDocumentText(docId);
      const next = stripExistingTranslations(body) + blk;
      await updateRetry(docId, next);
      appendFileSync(linkedPath, docId + "\n");
      updated++;
      if (updated % 25 === 0) console.log(`  …${updated} docs linked`);
    }
  }
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${APPLY ? "linked" : "would link"} doc-updates: ${updated}   nodes: ${created.size}   problems: ${problems}`,
  );
}

main().catch((e) => {
  console.error("LINK ERROR:", e);
  process.exit(1);
});
