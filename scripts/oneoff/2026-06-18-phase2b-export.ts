/**
 * Phase 2b export: clone-plan for the small fill-gaps (matrix, cryptpad, deploy).
 * Walks each configured EN gap-root subtree, writes en bodies + a combined node
 * plan + a per-collection seed map (anchors + pre-existing siblings to order).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const OUT = "/tmp/phase2b";
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Cfg {
  collection: string;
  /** EN ids of subtree roots to clone (their parent maps to the anchor). */
  gapRoots: string[];
  /** anchor: EN parent id of the gap roots -> existing fi/sv doc ids. */
  anchorEnParent: string;
  anchor: { fi: string; sv: string };
  /** pre-existing EN sibling ids under the anchor -> their fi/sv ids (for ordering). */
  siblings?: Record<string, { fi: string; sv: string }>;
}

const CONFIGS: Record<string, Cfg> = {
  matrix: {
    collection: "197bf6c2-f095-4a31-af4d-7c0cef365ee4",
    gapRoots: ["bf79a0c0", "e8cbadc7", "ae6b78d9"], // Connect to Server, Basic Features, Usage in Unit
    anchorEnParent: "c0e1be27",
    anchor: { fi: "8172a4f9", sv: "2a1608d2" },
    siblings: { de32139b: { fi: "4708aeef", sv: "b6280ed6" } }, // Platforms org
  },
  cryptpad: {
    collection: "1fa15405-4e21-4d83-be45-f0d263e2c790",
    gapRoots: ["b378d634", "51af4f7d", "232a7497"], // Connect to Server, Basic Features, Usage in Unit
    anchorEnParent: "c921ccf6",
    anchor: { fi: "62a70b68", sv: "2b07fdd0" },
  },
  deploy: {
    collection: "d80e5aab-46b6-4518-8719-449e8cf7fd06",
    gapRoots: ["ed412ef0", "ee7d4162", "8e3fdeae"], // Introduction, iOS, Windows
    anchorEnParent: "105d6103",
    anchor: { fi: "9411626b", sv: "0612a372" },
    siblings: { "356a70b8": { fi: "cdd04071", sv: "7778ee93" } }, // Android
  },
};

type N = { id: string; title: string; url: string; children: N[] };
function findByPrefix(node: N, prefix: string): N | null {
  if (node.id.startsWith(prefix)) return node;
  for (const c of node.children ?? []) {
    const f = findByPrefix(c, prefix);
    if (f) return f;
  }
  return null;
}
async function textRetry(id: string): Promise<string> {
  for (let a = 1; a <= 6; a++) {
    try {
      return await client.getDocumentText(id);
    } catch (e) {
      if (a === 6) throw e;
      await sleep(1500 * 2 ** (a - 1));
    }
  }
  return "";
}
function stripTranslations(b: string): string {
  return (
    b
      .replace(/\n*^---\s*\n\s*\*\s*Translations:[\s\S]*?^---\s*$/gm, "")
      .replace(/\n*\* Translations:\s*\n(?:\s*\*\s+\w+:.*\n)+/g, "")
      .trimEnd() + "\n"
  );
}

interface PlanNode {
  collection: string;
  id: string;
  title: string;
  parentId: string;
  isLeaf: boolean;
}

async function main() {
  mkdirSync(`${OUT}/en`, { recursive: true });
  mkdirSync(`${OUT}/fi`, { recursive: true });
  mkdirSync(`${OUT}/sv`, { recursive: true });

  const plan: PlanNode[] = [];
  const seeds: Record<string, unknown> = {};

  for (const [name, cfg] of Object.entries(CONFIGS)) {
    let struct = {} as Record<string, N>;
    for (let a = 1; a <= 6; a++) {
      try {
        struct = (await client.getCollectionStructure(
          cfg.collection,
          "",
        )) as Record<string, N>;
        break;
      } catch (e) {
        if (a === 6) throw e;
        await sleep(2000 * 2 ** (a - 1));
      }
    }
    const enRoot = struct.en;

    // Resolve all prefixes to FULL ids.
    const enAnchor = findByPrefix(enRoot, cfg.anchorEnParent)!.id;
    const fiAnchor = findByPrefix(struct.fi, cfg.anchor.fi)!.id;
    const svAnchor = findByPrefix(struct.sv, cfg.anchor.sv)!.id;
    const siblings: Record<string, { fi: string; sv: string }> = {};
    for (const [enPfx, locs] of Object.entries(cfg.siblings ?? {})) {
      const enFull = findByPrefix(enRoot, enPfx)!.id;
      siblings[enFull] = {
        fi: findByPrefix(struct.fi, locs.fi)!.id,
        sv: findByPrefix(struct.sv, locs.sv)!.id,
      };
    }
    seeds[name] = {
      collection: cfg.collection,
      enAnchor,
      fiAnchor,
      svAnchor,
      siblings,
    };

    async function walk(node: N, parentId: string) {
      const body = await textRetry(node.id);
      const isLeaf = (node.children ?? []).length === 0;
      writeFileSync(`${OUT}/en/${node.id}.md`, stripTranslations(body), "utf8");
      plan.push({
        collection: cfg.collection,
        id: node.id,
        title: node.title,
        parentId,
        isLeaf,
      });
      for (const c of node.children ?? []) await walk(c, node.id);
    }

    for (const rootPrefix of cfg.gapRoots) {
      const root = findByPrefix(enRoot, rootPrefix);
      if (!root) {
        console.error(`!! ${name}: gap root ${rootPrefix} not found`);
        continue;
      }
      await walk(root, enAnchor); // gap root's parent = the (full) anchor en id
    }
    console.log(
      `${name}: planned ${plan.filter((p) => p.collection === cfg.collection).length} nodes`,
    );
  }

  writeFileSync(`${OUT}/nodes.json`, JSON.stringify(plan, null, 2));
  writeFileSync(`${OUT}/seeds.json`, JSON.stringify(seeds, null, 2));
  console.log(
    `\ntotal nodes: ${plan.length}  (leaves=${plan.filter((p) => p.isLeaf).length})`,
  );
}

main().catch((e) => {
  console.error("EXPORT ERROR:", e);
  process.exit(1);
});
