/**
 * Phase 1 export: pull every ATAK + WinTAK *slide* page's raw markdown from
 * Outline into /tmp/tak-reformat/src/<id>.md, plus a manifest. Read-only.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const ATAK = "685f6f0f-e7ca-4ba3-807f-568582663e95";
const WINTAK = "2797bf1c-40d6-43ca-8f4c-9314097ee396";
const OUT = "/tmp/tak-reformat";

const client = createOutlineClient();

interface Node {
  id: string;
  title: string;
  children: Node[];
}

function findNode(node: Node, id: string): Node | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

function collectDescendants(node: Node, acc: Node[] = []): Node[] {
  for (const c of node.children ?? []) {
    acc.push(c);
    collectDescendants(c, acc);
  }
  return acc;
}

async function main() {
  mkdirSync(`${OUT}/src`, { recursive: true });
  mkdirSync(`${OUT}/fixed`, { recursive: true });

  const struct = (await client.getCollectionStructure(TAK, "")) as Record<
    string,
    Node
  >;
  const enRoot: Node = struct.en;

  const manifest: Array<{
    id: string;
    title: string;
    platform: string;
    file: string;
  }> = [];

  for (const [platform, orgId] of [
    ["ATAK", ATAK],
    ["WinTAK", WINTAK],
  ] as const) {
    const org = findNode(enRoot, orgId);
    if (!org) {
      console.error(`!! could not find ${platform} organizer ${orgId}`);
      continue;
    }
    const descendants = collectDescendants(org);
    console.log(`${platform}: ${descendants.length} descendant nodes`);
    for (const d of descendants) {
      const body = await client.getDocumentText(d.id);
      const isSlide = body.trimStart().startsWith("META: slides");
      if (!isSlide) continue;
      const file = `${OUT}/src/${d.id}.md`;
      writeFileSync(file, body, "utf8");
      manifest.push({ id: d.id, title: d.title, platform, file });
    }
  }

  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(
    `\nExported ${manifest.length} slide pages -> ${OUT}/manifest.json`,
  );
  const byPlat = manifest.reduce<Record<string, number>>((a, m) => {
    a[m.platform] = (a[m.platform] ?? 0) + 1;
    return a;
  }, {});
  console.log("by platform:", byPlat);
}

main().catch((e) => {
  console.error("EXPORT ERROR:", e);
  process.exit(1);
});
