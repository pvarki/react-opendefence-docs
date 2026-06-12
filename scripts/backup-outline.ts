#!/usr/bin/env tsx

/**
 * Back up Outline collections before structural edits.
 *
 * For each selected collection this saves, under backups/outline/ (gitignored):
 *   {slug}-{timestamp}.zip             full outline-markdown export incl.
 *                                      attachments (collections.export ->
 *                                      fileOperations poll -> download)
 *   {slug}-{timestamp}.structure.json  the nav tree (collections.documents),
 *                                      which the zip's folder layout mirrors —
 *                                      kept separately for easy diffing.
 *
 * Usage:
 *   pnpm tsx scripts/backup-outline.ts                       # all collections
 *   pnpm tsx scripts/backup-outline.ts --collection tak      # filtered
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { rateLimitedFetch } from "./lib/rate-limited-fetch";
import { ALL_COLLECTIONS, type CollectionConfig } from "../config/collections";
import { collectionMatchesFilter, parseSyncArgs } from "./lib/sync-helpers";

const BACKUP_DIR = path.join(process.cwd(), "backups", "outline");
const API_BASE =
  process.env.OUTLINE_API_BASE ?? "https://pvarki.getoutline.com/api";
const API_KEY = process.env.OUTLINE_API_KEY;

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

async function post<T>(endpoint: string, body: unknown): Promise<T> {
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

async function backupCollection(
  collection: CollectionConfig,
  timestamp: string,
): Promise<void> {
  const safeSlug = collection.slug.replace(/\//g, "-");

  // 1. Structure snapshot — the FULL nav tree with children and urls (the
  // shared client's getCollectionDocuments flattens, so call the API raw).
  const structure = await post<{ data: unknown }>("/collections.documents", {
    id: collection.collectionId,
  });
  await fs.writeFile(
    path.join(BACKUP_DIR, `${safeSlug}-${timestamp}.structure.json`),
    JSON.stringify(structure.data, null, 2) + "\n",
  );

  // 2. Full export: trigger -> poll the file operation -> download the zip.
  const exportRes = await post<{
    data: { id?: string; fileOperation?: { id: string } };
  }>("/collections.export", {
    id: collection.collectionId,
    format: "outline-markdown",
  });
  const fileOp = { id: exportRes.data.fileOperation?.id ?? exportRes.data.id };
  if (!fileOp.id)
    throw new Error("collections.export returned no file operation id");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let state = "creating";
  while (state !== "complete") {
    if (Date.now() > deadline) {
      throw new Error(`export of ${collection.slug} timed out (${state})`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const info = await post<{ data: { state: string; error?: string } }>(
      "/fileOperations.info",
      { id: fileOp.id },
    );
    state = info.data.state;
    if (state === "error") {
      throw new Error(
        `export of ${collection.slug} failed: ${info.data.error}`,
      );
    }
  }

  const download = await rateLimitedFetch(
    `${API_BASE}/fileOperations.redirect`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: fileOp.id }),
    },
  );
  if (!download.ok) {
    throw new Error(`download failed: ${download.status}`);
  }
  const zipPath = path.join(BACKUP_DIR, `${safeSlug}-${timestamp}.zip`);
  await fs.writeFile(zipPath, Buffer.from(await download.arrayBuffer()));
  const { size } = await fs.stat(zipPath);
  console.log(
    `  ✔ ${collection.slug}: ${(size / 1024 / 1024).toFixed(1)} MB zip + structure JSON`,
  );
}

async function main() {
  if (!API_KEY) throw new Error("OUTLINE_API_KEY is not set");
  const args = parseSyncArgs(process.argv.slice(2));
  const selected = args.collection
    ? ALL_COLLECTIONS.filter((c) =>
        collectionMatchesFilter(c, args.collection!),
      )
    : ALL_COLLECTIONS;
  if (selected.length === 0) {
    throw new Error(`no collections match "${args.collection}"`);
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  console.log(
    `Backing up ${selected.length} collection(s) to backups/outline/ ...`,
  );
  for (const collection of selected) {
    await backupCollection(collection, timestamp);
  }
  console.log("✓ Backup complete");
}

main().catch((err: unknown) => {
  console.error("Backup failed:", err);
  process.exitCode = 1;
});
