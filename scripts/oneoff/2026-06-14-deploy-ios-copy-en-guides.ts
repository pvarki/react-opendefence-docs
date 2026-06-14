#!/usr/bin/env tsx

/**
 * One-off (2026-06-14): copy the Deploy App English User Guide and Admin Guide
 * from the Android platform organizer to the iOS organizer, images included.
 *
 * Why: Android En holds the real, fully-illustrated guides (~32 screenshots);
 * the iOS En "User Guide"/"Admin Guide" were empty placeholder stubs (0 images).
 * The user wants iOS to carry the same English guides as Android, with images.
 *
 * Method: Outline's `documents.duplicate {recursive:true, parentDocumentId}`
 * copies a whole organizer subtree — text AND attachments — and publishes the
 * copies. We duplicate Android's two guide trees under iOS, reorder the copied
 * leaves to match Android's reading order, then trash the old iOS stub guides
 * (recoverable from Outline trash; their text is also dumped to /tmp first).
 *
 * Idempotent: removes ANY existing User/Admin Guide under iOS before copying,
 * so a re-run resets iOS to a clean mirror of Android En.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-06-14-deploy-ios-copy-en-guides.ts            # dry run
 *   pnpm tsx scripts/oneoff/2026-06-14-deploy-ios-copy-en-guides.ts --apply    # execute
 *   Then: pnpm sync   (to pull the new iOS pages into the app)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { rateLimitedFetch } from "../lib/rate-limited-fetch";

const APPLY = process.argv.includes("--apply");
const API_BASE =
  process.env.OUTLINE_API_BASE ?? "https://pvarki.getoutline.com/api";
const API_KEY = process.env.OUTLINE_API_KEY;
const COLLECTION_ID = "d80e5aab-46b6-4518-8719-449e8cf7fd06"; // Deploy App
const GUIDE_TITLES = ["User Guide", "Admin Guide"];

interface Node {
  id: string;
  title: string;
  children?: Node[];
}

async function post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  const res = await rateLimitedFetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${endpoint} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

const find = (nodes: Node[], title: string): Node | undefined =>
  nodes.find((n) => n.title === title);

async function fetchTree(): Promise<Node[]> {
  return (
    await post<{ data: Node[] }>("/collections.documents", {
      id: COLLECTION_ID,
    })
  ).data;
}

async function main() {
  if (!API_KEY) throw new Error("OUTLINE_API_KEY is not set");
  console.log(
    APPLY ? "APPLYING changes\n" : "DRY RUN (pass --apply to execute)\n",
  );

  const tree = await fetchTree();
  const en = find(tree, "En");
  const platforms = en && find(en.children ?? [], "Platforms");
  const android = platforms && find(platforms.children ?? [], "Android");
  const ios = platforms && find(platforms.children ?? [], "iOS");
  if (!android || !ios)
    throw new Error("Could not locate Android/iOS organizers");

  // Source guides on Android, with their canonical child reading order.
  const sources = GUIDE_TITLES.map((t) => {
    const node = find(android.children ?? [], t);
    if (!node) throw new Error(`Android is missing "${t}"`);
    return {
      title: t,
      id: node.id,
      order: (node.children ?? []).map((c) => c.title),
    };
  });
  console.log("Source (Android En):");
  for (const s of sources) console.log(`  ${s.title}: ${s.order.join(" → ")}`);

  // Existing iOS guide organizers to remove (stubs + any prior copies).
  const staleGuides = (ios.children ?? []).filter((c) =>
    GUIDE_TITLES.includes(c.title),
  );
  console.log(
    `\niOS currently has ${staleGuides.length} guide organizer(s) to remove:`,
  );
  for (const g of staleGuides)
    console.log(
      `  - ${g.title} [${g.id.slice(0, 8)}]  (${(g.children ?? []).length} pages)`,
    );

  if (!APPLY) {
    console.log("\nWould: back up & trash the above, then duplicate the two");
    console.log("Android guide trees under iOS (recursive, images included),");
    console.log(
      "reorder copied pages to match Android, and order UG before AG.",
    );
    return;
  }

  // 1) Back up stale iOS guide bodies to /tmp before trashing.
  const backup: Record<string, unknown> = {};
  for (const g of staleGuides) {
    const collect = async (n: Node) => {
      const info = (
        await post<{ data: { id: string; title: string; text: string } }>(
          "/documents.info",
          { id: n.id },
        )
      ).data;
      backup[n.id] = { title: info.title, text: info.text };
      for (const c of n.children ?? []) await collect(c);
    };
    await collect(g);
  }
  const backupPath = `/tmp/ios-deploy-stub-backup-2026-06-14.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(
    `\n✔ backed up ${Object.keys(backup).length} stale doc(s) → ${backupPath}`,
  );

  // 2) Trash the stale iOS guide organizers (recoverable in Outline trash).
  for (const g of staleGuides) {
    await post("/documents.delete", { id: g.id });
    console.log(`  ✔ trashed iOS "${g.title}" [${g.id.slice(0, 8)}]`);
  }

  // 3) Duplicate each Android guide tree under iOS and reorder its children.
  const newRoots: Record<string, string> = {};
  for (const s of sources) {
    const dup = await post<{
      data: {
        documents: Array<{
          id: string;
          title: string;
          parentDocumentId: string | null;
        }>;
      };
    }>("/documents.duplicate", {
      id: s.id,
      recursive: true,
      parentDocumentId: ios.id,
    });
    const docs = dup.data.documents;
    const root = docs.find((d) => d.parentDocumentId === ios.id);
    if (!root)
      throw new Error(`Duplicate of "${s.title}" has no root under iOS`);
    newRoots[s.title] = root.id;
    console.log(`\n✔ duplicated "${s.title}" → iOS [${root.id.slice(0, 8)}]`);

    // Reorder copied leaves to match Android's reading order.
    const kids = docs.filter((d) => d.parentDocumentId === root.id);
    for (const title of s.order) {
      const kid = kids.find((k) => k.title === title);
      if (!kid) {
        console.warn(`  ⚠ copied "${s.title}" missing page "${title}"`);
        continue;
      }
      await post("/documents.move", {
        id: kid.id,
        collectionId: COLLECTION_ID,
        parentDocumentId: root.id,
        index: s.order.indexOf(title),
      });
    }
    console.log(`  ✔ ordered pages: ${s.order.join(" → ")}`);
  }

  // 4) Order the guides within iOS in a final pass (User Guide, then Admin
  // Guide). Done after both exist — documents.duplicate inserts at the top, so
  // per-iteration moves would race with the next duplicate.
  for (let i = 0; i < GUIDE_TITLES.length; i++) {
    await post("/documents.move", {
      id: newRoots[GUIDE_TITLES[i]],
      collectionId: COLLECTION_ID,
      parentDocumentId: ios.id,
      index: i,
    });
  }
  console.log(`\n✔ ordered iOS guides: ${GUIDE_TITLES.join(" → ")}`);

  console.log(
    "\n✓ Done. Run `pnpm sync` to pull the new iOS pages into the app.",
  );
}

main().catch((err: unknown) => {
  console.error("copy failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
