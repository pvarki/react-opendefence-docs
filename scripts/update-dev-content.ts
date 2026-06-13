#!/usr/bin/env tsx

/**
 * One-off: replace the bodies of specific Developer-book pages in Outline with
 * revised drafts (matched by collection + exact title). Reads a key->markdown
 * map from /tmp/dev-content-updates.json. Re-runnable.
 *
 * Usage:
 *   OUTLINE_API_KEY=... pnpm tsx scripts/update-dev-content.ts
 *   Then: pnpm sync:collection <slug> (for each touched collection) or pnpm sync:outline
 */

import "dotenv/config";
import { readFileSync } from "node:fs";

import { createOutlineClient } from "./lib/outline-api";
import { getCollectionBySlug } from "../config/collections";

interface Target {
  key: string;
  collection: string;
  title: string;
}

// key -> (collection slug, exact Outline title). Titles are unique per collection.
const TARGETS: Target[] = [
  {
    key: "architecture",
    collection: "introduction",
    title: "Architecture orientation",
  },
  {
    key: "audit-logging",
    collection: "operate",
    title: "Audit logging & observability",
  },
  {
    key: "deploy-kubernetes",
    collection: "operate",
    title: "Deploy on Kubernetes",
  },
  {
    key: "core-apis-rm-contract",
    collection: "develop-deploy-app",
    title: "Core APIs & the rmapi contract",
  },
  {
    key: "setup-dev-env-compose",
    collection: "develop-deploy-app",
    title: "Set up your dev environment (Docker Compose)",
  },
  {
    key: "iterate-core-compose",
    collection: "develop-deploy-app",
    title: "Iterate on the core API (Docker Compose)",
  },
  {
    key: "setup-integration-dev-compose",
    collection: "build-an-integration",
    title: "Set up your dev environment (Docker Compose)",
  },
  {
    key: "register-integration-compose",
    collection: "build-an-integration",
    title: "Register your integration (Docker Compose)",
  },
];

interface Node {
  id: string;
  title: string;
  children: Node[];
}

function findByTitle(nodes: Node[], title: string): Node | undefined {
  for (const n of nodes) {
    if (n.title.trim() === title) return n;
    const found = findByTitle(n.children ?? [], title);
    if (found) return found;
  }
  return undefined;
}

const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const updates: Record<string, string> = JSON.parse(
    readFileSync("/tmp/dev-content-updates.json", "utf-8"),
  );
  console.log(`Loaded ${Object.keys(updates).length} revised bodies.\n`);

  // Cache each collection's en-root tree once.
  const trees = new Map<string, Node>();
  let updated = 0;

  for (const t of TARGETS) {
    const md = updates[t.key]?.trim();
    if (!md) {
      console.warn(`= no revised body for "${t.key}" — skipping`);
      continue;
    }
    const col = getCollectionBySlug(t.collection);
    if (!col) {
      console.warn(
        `⚠ unknown collection "${t.collection}" — skipping ${t.key}`,
      );
      continue;
    }
    if (!trees.has(t.collection)) {
      const structure = await client.getCollectionStructure(
        col.collectionId,
        "",
      );
      const root = structure.en as unknown as Node | undefined;
      if (!root) {
        console.warn(`⚠ no en root in ${t.collection}`);
        continue;
      }
      trees.set(t.collection, root);
    }
    const root = trees.get(t.collection)!;
    const doc = findByTitle(root.children ?? [], t.title);
    if (!doc) {
      console.warn(`⚠ "${t.title}" not found in ${t.collection} — skipping`);
      continue;
    }
    await client.updateDocument(doc.id, md);
    updated++;
    console.log(`  ✓ ${t.collection} › ${t.title} → ${doc.id}`);
    await sleep(150);
  }

  console.log(`\n✓ Updated ${updated} document(s).`);
  console.log(
    "Next: pnpm sync:collection for each touched collection (or pnpm sync:outline)",
  );
}

main().catch((err) => {
  console.error("update-dev-content failed:", err?.message ?? err);
  process.exit(1);
});
