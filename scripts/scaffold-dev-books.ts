#!/usr/bin/env tsx

/**
 * One-off: scaffold the five Developer-section Outline books (EN) with first-
 * draft bodies. Each book gets an `en` locale root; Operate / Develop Deploy
 * App / Build an Integration also get a `Platforms` container with the two
 * deployment-target organizers (Docker Compose legacy + Kubernetes). After
 * creating each book it reorders siblings to the intended order (Outline
 * otherwise lists newest-first) via documents.move.
 *
 * Inputs:
 *   /tmp/dev-collections.json  { "<slug>": { "id": "<uuid>", "name": "..." } }
 *   /tmp/dev-books-drafts.json { "<page-key>": "<markdown>" }
 *
 * Safety: skips any book whose collection already has documents (unless --force).
 *
 * Usage:
 *   OUTLINE_API_KEY=... pnpm tsx scripts/scaffold-dev-books.ts [--force]
 *   Then: pnpm sync
 */

import "dotenv/config";
import { readFileSync } from "node:fs";

import { createOutlineClient } from "./lib/outline-api";

const force = process.argv.slice(2).includes("--force");
const client = createOutlineClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DOCKER = "platform: docker-rasenmaeher-integration";
const K8S = "platform: opendefence-k8s";

const TITLES: Record<string, string> = {
  welcome: "What is Deploy App",
  "choose-platform": "Choose your platform: legacy Docker vs Kubernetes",
  architecture: "Architecture orientation",
  glossary: "Glossary",
  "operator-quickstart": "Operator quickstart",
  "audit-logging": "Audit logging & observability",
  "troubleshooting-teardown": "Troubleshooting & teardown",
  "deploy-docker-compose": "Deploy with Docker Compose",
  "day2-legacy": "Day-2 operations (Docker Compose)",
  "deploy-kubernetes": "Deploy on Kubernetes",
  "day2-k8s": "Day-2 operations (Kubernetes)",
  "core-dev-overview": "Core development overview",
  "core-apis-rm-contract": "Core APIs & the rmapi contract",
  "testing-ci": "Testing & CI conventions",
  "setup-dev-env-compose": "Set up your dev environment (Docker Compose)",
  "iterate-core-compose": "Iterate on the core API (Docker Compose)",
  "setup-dev-env-k8s": "Set up your dev environment (Kubernetes)",
  "iterate-core-mirrord": "Iterate on the core API (mirrord)",
  "integration-overview": "Integration overview",
  "scaffold-template": "Scaffold from the template",
  "matrix-example": "Worked example: Matrix",
  "integration-conventions": "Integration conventions & don'ts",
  "setup-integration-dev-compose":
    "Set up your dev environment (Docker Compose)",
  "register-integration-compose": "Register your integration (Docker Compose)",
  "setup-integration-dev-k8s": "Set up your dev environment (Kubernetes)",
  "register-integration-k8s": "Register your integration (Kubernetes)",
  contributing: "Contributing",
  "community-standards": "Community & Standards",
  "reporting-issues": "Reporting issues & support",
  "security-policy": "Security policy & reporting",
  "releases-versioning": "Releases & versioning",
};

interface Platform {
  title: string;
  marker: string;
  pages: string[];
}
interface BookSpec {
  slug: string;
  shared: string[];
  platforms?: Platform[];
}

const BOOKS: BookSpec[] = [
  {
    slug: "introduction",
    shared: ["welcome", "choose-platform", "architecture", "glossary"],
  },
  {
    slug: "operate",
    shared: [
      "operator-quickstart",
      "audit-logging",
      "troubleshooting-teardown",
    ],
    platforms: [
      {
        title: "Docker Compose (legacy)",
        marker: DOCKER,
        pages: ["deploy-docker-compose", "day2-legacy"],
      },
      {
        title: "Kubernetes",
        marker: K8S,
        pages: ["deploy-kubernetes", "day2-k8s"],
      },
    ],
  },
  {
    slug: "develop-deploy-app",
    shared: ["core-dev-overview", "core-apis-rm-contract", "testing-ci"],
    platforms: [
      {
        title: "Docker Compose (legacy)",
        marker: DOCKER,
        pages: ["setup-dev-env-compose", "iterate-core-compose"],
      },
      {
        title: "Kubernetes",
        marker: K8S,
        pages: ["setup-dev-env-k8s", "iterate-core-mirrord"],
      },
    ],
  },
  {
    slug: "build-an-integration",
    shared: [
      "integration-overview",
      "scaffold-template",
      "matrix-example",
      "integration-conventions",
    ],
    platforms: [
      {
        title: "Docker Compose (legacy)",
        marker: DOCKER,
        pages: [
          "setup-integration-dev-compose",
          "register-integration-compose",
        ],
      },
      {
        title: "Kubernetes",
        marker: K8S,
        pages: ["setup-integration-dev-k8s", "register-integration-k8s"],
      },
    ],
  },
  {
    slug: "contribute-to-project",
    shared: [
      "contributing",
      "community-standards",
      "reporting-issues",
      "security-policy",
      "releases-versioning",
    ],
  },
];

function organizerBody(markers: string[]): string {
  return markers.map((m) => `META: ${m}`).join("\n\n") + "\n";
}

let created = 0;

async function createDoc(
  collectionId: string,
  parentId: string | undefined,
  title: string,
  text: string,
): Promise<string> {
  const doc = await client.createDocument({
    collectionId,
    parentDocumentId: parentId,
    title,
    text,
    publish: true,
  });
  created++;
  await sleep(120);
  return doc.id;
}

async function reorder(
  collectionId: string,
  parentId: string,
  childIds: string[],
): Promise<void> {
  for (let i = 0; i < childIds.length; i++) {
    await client.moveDocument({
      id: childIds[i],
      collectionId,
      parentDocumentId: parentId,
      index: i,
    });
    await sleep(120);
  }
}

async function scaffoldBook(
  spec: BookSpec,
  collectionId: string,
  drafts: Record<string, string>,
): Promise<void> {
  const leaf = (key: string) =>
    drafts[key]?.trim()
      ? drafts[key]
      : "This page is a stub.\n\n(this page is under development)\n";

  const enId = await createDoc(collectionId, undefined, "en", "");
  console.log(`  en root → ${enId}`);

  const rootChildren: string[] = [];
  const moves: { parent: string; children: string[] }[] = [];

  for (const key of spec.shared) {
    const id = await createDoc(
      collectionId,
      enId,
      TITLES[key] ?? key,
      leaf(key),
    );
    rootChildren.push(id);
    console.log(`    · ${TITLES[key] ?? key}${drafts[key] ? "" : " [STUB]"}`);
  }

  if (spec.platforms) {
    const platformsId = await createDoc(
      collectionId,
      enId,
      "Platforms",
      organizerBody(["platforms-container"]),
    );
    rootChildren.push(platformsId);
    const platformIds: string[] = [];
    for (const p of spec.platforms) {
      const pid = await createDoc(
        collectionId,
        platformsId,
        p.title,
        organizerBody([p.marker]),
      );
      platformIds.push(pid);
      console.log(`    + ${p.title}`);
      const pageIds: string[] = [];
      for (const key of p.pages) {
        const id = await createDoc(
          collectionId,
          pid,
          TITLES[key] ?? key,
          leaf(key),
        );
        pageIds.push(id);
        console.log(
          `        · ${TITLES[key] ?? key}${drafts[key] ? "" : " [STUB]"}`,
        );
      }
      moves.push({ parent: pid, children: pageIds });
    }
    moves.push({ parent: platformsId, children: platformIds });
  }

  moves.push({ parent: enId, children: rootChildren });

  console.log(`  reordering ${moves.length} parent(s)...`);
  for (const m of moves) await reorder(collectionId, m.parent, m.children);
}

async function main() {
  const collections: Record<string, { id: string; name: string }> = JSON.parse(
    readFileSync("/tmp/dev-collections.json", "utf-8"),
  );
  let drafts: Record<string, string> = {};
  try {
    drafts = JSON.parse(readFileSync("/tmp/dev-books-drafts.json", "utf-8"));
    console.log(`Loaded ${Object.keys(drafts).length} drafted bodies.\n`);
  } catch {
    console.warn(
      "⚠ No /tmp/dev-books-drafts.json — every page will be a hidden stub.\n",
    );
  }

  for (const spec of BOOKS) {
    const col = collections[spec.slug];
    if (!col) {
      console.warn(`⚠ no collection id for "${spec.slug}" — skipping`);
      continue;
    }
    const existing = await client.getCollectionDocuments(col.id);
    if (existing.length > 0 && !force) {
      console.warn(
        `= "${spec.slug}" already has ${existing.length} doc(s) — skipping (use --force)`,
      );
      continue;
    }
    console.log(`\n### ${col.name} (${spec.slug}) — ${col.id}`);
    await scaffoldBook(spec, col.id, drafts);
  }

  console.log(`\n✓ Created ${created} documents across ${BOOKS.length} books.`);
  console.log("Next: pnpm sync");
}

main().catch((err) => {
  console.error("scaffold-dev-books failed:", err?.message ?? err);
  process.exit(1);
});
