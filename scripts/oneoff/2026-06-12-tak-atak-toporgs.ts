#!/usr/bin/env tsx

/**
 * One-off Outline restructure (2026-06-12): introduce toporg sections under
 * the TAK guide's ATAK client, per the new authoring model.
 *
 * Before:                          After:
 *   en                              en
 *   ├ Deploy App - TAK              └ TAK Clients
 *   └ TAK Clients                     └ ATAK
 *     └ ATAK                            ├ INTRODUCTION        (META: toporg)
 *       ├ Start                         │ ├ Deploy App - TAK  (moved from root)
 *       ├ Basic Features                │ └ Start
 *       ├ Advanced Features             ├ USING ATAK FEATURES (META: toporg)
 *       ├ Usage by Role                 │ ├ Basic Features
 *       ├ Supported Plugins             │ ├ Advanced Features
 *       └ Troubleshooting               │ └ Supported Plugins
 *                                       ├ Usage by Role       (+META: toporg)
 *                                       │ ├ Overview / Fighter / Commandpost
 *                                       └ Troubleshooting
 *
 * Backup taken first: backups/outline/guides-tak-guide-2026-06-12T15-48-00.*
 * Document slugs survive moves, so published URLs stay stable.
 */
import "dotenv/config";
import { rateLimitedFetch } from "../lib/rate-limited-fetch";

const API_BASE =
  process.env.OUTLINE_API_BASE ?? "https://pvarki.getoutline.com/api";
const API_KEY = process.env.OUTLINE_API_KEY;

const COLLECTION_ID = "2ed45fcf-9424-4774-b5f9-9a66f7c1a009"; // TAK Guide

// Document ids from the backup structure snapshot.
const ATAK = "685f6f0f-e7ca-4ba3-807f-568582663e95";
const DEPLOY_APP_TAK = "769c51c9-7f73-429e-aaf5-19240034b86c"; // root-level leaf
const START = "709bc302-315b-4afe-889c-8f6ada097e27";
const BASIC_FEATURES = "73d4d56f-a6d4-4819-8936-d3ca44258e82";
const ADVANCED_FEATURES = "0b81d9db-94b1-4474-a58a-6e46f27d3951";
const SUPPORTED_PLUGINS = "0cea7c7c-fac9-410d-91ef-30bfb8df4675";
const USAGE_BY_ROLE = "1c9994ff-4049-4eef-a7ee-2b8f23f749fc";

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

async function createToporg(title: string, index: number): Promise<string> {
  const res = await post<{ data: { id: string; url: string } }>(
    "/documents.create",
    {
      title,
      text: "META: toporg\n",
      collectionId: COLLECTION_ID,
      parentDocumentId: ATAK,
      publish: true,
    },
  );
  await move(res.data.id, ATAK, index);
  console.log(`  ✔ created toporg "${title}" (${res.data.url})`);
  return res.data.id;
}

async function move(id: string, parentDocumentId: string, index: number) {
  await post("/documents.move", {
    id,
    collectionId: COLLECTION_ID,
    parentDocumentId,
    index,
  });
}

async function main() {
  if (!API_KEY) throw new Error("OUTLINE_API_KEY is not set");

  console.log("Creating toporg organizers under ATAK...");
  const introduction = await createToporg("INTRODUCTION", 0);
  const usingFeatures = await createToporg("USING ATAK FEATURES", 1);

  console.log("Moving chapters into the toporgs...");
  await move(DEPLOY_APP_TAK, introduction, 0);
  console.log("  ✔ Deploy App - TAK -> INTRODUCTION");
  await move(START, introduction, 1);
  console.log("  ✔ Start -> INTRODUCTION");

  await move(BASIC_FEATURES, usingFeatures, 0);
  await move(ADVANCED_FEATURES, usingFeatures, 1);
  await move(SUPPORTED_PLUGINS, usingFeatures, 2);
  console.log(
    "  ✔ Basic/Advanced Features + Supported Plugins -> USING ATAK FEATURES",
  );

  console.log("Marking Usage by Role as a toporg...");
  const info = await post<{ data: { text: string } }>("/documents.info", {
    id: USAGE_BY_ROLE,
  });
  if (!/^META:\s*toporg\s*$/im.test(info.data.text)) {
    await post("/documents.update", {
      id: USAGE_BY_ROLE,
      text: `META: toporg\n\n${info.data.text}`,
    });
    console.log("  ✔ META: toporg prepended to Usage by Role");
  } else {
    console.log("  • Usage by Role already marked");
  }
  await move(USAGE_BY_ROLE, ATAK, 2);

  console.log("✓ Restructure complete");
}

main().catch((err: unknown) => {
  console.error("Restructure failed:", err);
  process.exitCode = 1;
});
