/**
 * Phase 2a export (TAK i18n): walk the EN TAK tree, fetch every node body, and
 * write a node plan + per-node EN markdown for translation/cloning. Read-only.
 *
 * Output:
 *   /tmp/tak-i18n/nodes.json       node plan (parent links, order, leaf/org, markers)
 *   /tmp/tak-i18n/en/<id>.md       raw EN body of each node that needs translating
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createOutlineClient } from "../lib/outline-api";

const TAK = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009";
const EN_ROOT = "9f104399"; // prefix; matched loosely below
const EN_PLATFORMS = "1dce6fa1";
const OUT = "/tmp/tak-i18n";

const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

interface RawNode {
  id: string;
  title: string;
  children: RawNode[];
}
interface PlanNode {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  isLeaf: boolean;
  markers: string[];
  skipCreate: boolean; // structural node that maps to an existing fi/sv doc
}

/** Strip a trailing "* Translations:" list (and the --- around it) from a body. */
function stripTranslations(body: string): string {
  // Remove a block that starts at a "* Translations:" bullet through end / next ---.
  return (
    body
      .replace(/\n?\* *Translations:[\s\S]*?(?=\n---\n|\n*$)/i, "")
      .trimEnd() + "\n"
  );
}

async function main() {
  mkdirSync(`${OUT}/en`, { recursive: true });
  const struct = (await client.getCollectionStructure(TAK, "")) as Record<
    string,
    RawNode
  >;
  const enRoot = struct.en;

  const plan: PlanNode[] = [];

  async function walk(node: RawNode, parentId: string | null, order: number) {
    const isRoot = node.id.startsWith(EN_ROOT);
    const isPlatforms = node.id.startsWith(EN_PLATFORMS);
    const skipCreate = isRoot || isPlatforms;

    let isLeaf = false;
    let markers: string[] = [];
    if (!skipCreate) {
      const body = await textRetry(node.id);
      isLeaf = body.trimStart().startsWith("META: slides");
      markers = (body.match(/^META:.*$/gm) ?? []).map((m) => m.trim());
      writeFileSync(`${OUT}/en/${node.id}.md`, stripTranslations(body), "utf8");
    }

    plan.push({
      id: node.id,
      title: node.title,
      parentId,
      order,
      isLeaf,
      markers,
      skipCreate,
    });

    const kids = node.children ?? [];
    for (let i = 0; i < kids.length; i++) await walk(kids[i], node.id, i);
  }

  await walk(enRoot, null, 0);

  writeFileSync(`${OUT}/nodes.json`, JSON.stringify(plan, null, 2));
  const leaves = plan.filter((n) => n.isLeaf).length;
  const orgs = plan.filter((n) => !n.isLeaf && !n.skipCreate).length;
  const skipped = plan.filter((n) => n.skipCreate).length;
  console.log(
    `nodes: ${plan.length}  (leaves=${leaves}, organizers=${orgs}, structural-skip=${skipped})`,
  );
  console.log(`wrote ${OUT}/nodes.json + ${OUT}/en/*.md`);
}

main().catch((e) => {
  console.error("EXPORT ERROR:", e);
  process.exit(1);
});
