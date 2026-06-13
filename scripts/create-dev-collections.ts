#!/usr/bin/env tsx

/**
 * One-off: create the five Developer-section Outline collections (reusing any
 * that already exist by name, so it is safe to re-run). Writes a
 * slug -> {id,name} map to /tmp/dev-collections.json and prints it so the
 * UUIDs can be registered in config/collections.ts.
 *
 * Usage: OUTLINE_API_KEY=... pnpm tsx scripts/create-dev-collections.ts
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";

import { createOutlineClient } from "./lib/outline-api";

const BOOKS: { slug: string; name: string; description: string }[] = [
  {
    slug: "introduction",
    name: "Introduction",
    description: "Start here: what Deploy App is and how to choose a platform",
  },
  {
    slug: "operate",
    name: "Operate",
    description: "Deploy and run Deploy App",
  },
  {
    slug: "develop-deploy-app",
    name: "Develop Deploy App",
    description: "Work on the Deploy App core (rmapi)",
  },
  {
    slug: "build-an-integration",
    name: "Build an Integration",
    description: "Build a product integration API for Deploy App",
  },
  {
    slug: "contribute-to-project",
    name: "Contribute to Project",
    description: "Contribute across the pvarki repositories",
  },
];

const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const existing = await client.listCollections();
  const byName = new Map(existing.map((c) => [c.name, c.id]));

  const out: Record<string, { id: string; name: string }> = {};
  for (const book of BOOKS) {
    const found = byName.get(book.name);
    if (found) {
      out[book.slug] = { id: found, name: book.name };
      console.log(`= reused "${book.name}" → ${found}`);
      continue;
    }
    const created = await client.createCollection(book.name, book.description);
    out[book.slug] = { id: created.id, name: created.name };
    console.log(`+ created "${book.name}" → ${created.id}`);
    await sleep(200);
  }

  writeFileSync("/tmp/dev-collections.json", JSON.stringify(out, null, 2));
  console.log("\nslug → collectionId:");
  for (const [slug, v] of Object.entries(out))
    console.log(`  ${slug}: ${v.id}`);
  console.log("\nWrote /tmp/dev-collections.json");
}

main().catch((err) => {
  console.error("create-dev-collections failed:", err?.message ?? err);
  process.exit(1);
});
