/**
 * One-off: scaffold the Architecture book + MediaMTX/Matrix product books in
 * Outline, plus a "TAK on the OpenDefence Platform" chapter in Working with
 * TAK, from drafts produced in the session scratchpad.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-07-15-architecture-books.ts --collections-only
 *   pnpm tsx scripts/oneoff/2026-07-15-architecture-books.ts
 *
 * Idempotent: collections and docs are find-or-created by name/title; page
 * bodies are re-pushed from the draft files on every run; sibling order is
 * re-asserted. Cross-page links in drafts use `@@page:<key>@@` placeholders,
 * resolved to /en/<collection>/<slug> after all docs exist.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  createOutlineClient,
  type OutlineApiClient,
  type OutlineNavNode,
} from "../lib/outline-api";

const DRAFTS =
  "/private/tmp/claude-501/-Users-bbr-Documents-GitHub-react-opendefence-docs/5492964c-c7a8-4681-a14a-d46ee8a55ef1/scratchpad/authoring/drafts";
const UUID_OUT =
  "/private/tmp/claude-501/-Users-bbr-Documents-GitHub-react-opendefence-docs/5492964c-c7a8-4681-a14a-d46ee8a55ef1/scratchpad/authoring/collections.json";

const WORKING_WITH_TAK_ID = "74d6c3aa-0666-44a7-ae41-73632c67c30a";

const K8S_MARKER = "META: platform: opendefence-k8s\n";
const DOCKER_MARKER = "META: platform: docker-rasenmaeher-integration\n";
const CONTAINER_MARKER = "META: platforms-container\n";

interface PageSpec {
  key: string;
  title: string;
}

const K8S_PAGES: PageSpec[] = [
  { key: "k8s-overview", title: "Platform overview" },
  { key: "k8s-deployment", title: "Deployment model" },
  { key: "k8s-pki", title: "PKI & trust" },
  { key: "k8s-ingress", title: "Ingress & network edge" },
  { key: "k8s-mtls", title: "Edge mTLS & callsign checks" },
  { key: "k8s-mesh", title: "Service mesh (Linkerd)" },
  { key: "k8s-core", title: "Core services" },
  { key: "k8s-integration-pattern", title: "Integration pattern" },
  { key: "k8s-data", title: "Data & secrets" },
  { key: "k8s-observability", title: "Observability pipeline" },
];

const LEGACY_PAGES: PageSpec[] = [
  { key: "legacy-overview", title: "Legacy stack overview" },
  { key: "legacy-core", title: "Core services & products (legacy)" },
  { key: "legacy-pki", title: "PKI: CFSSL & miniwerk (legacy)" },
  { key: "legacy-networking", title: "Networking & subdomains (legacy)" },
];

const MTX_PAGES: PageSpec[] = [
  { key: "mtx-what", title: "What the MediaMTX integration is" },
  { key: "mtx-stack", title: "MediaMTX stack (Kubernetes)" },
];

const MATRIX_PAGES: PageSpec[] = [
  { key: "matrix-what", title: "What the Matrix integration is" },
  { key: "matrix-stack", title: "Matrix stack (Kubernetes)" },
];

const TAK_PAGES: PageSpec[] = [
  { key: "tak-stack", title: "TAK stack (Kubernetes)" },
];

const TAK_CHAPTER_TITLE = "TAK on the OpenDefence Platform";

/** key -> collection slug, for placeholder resolution. */
const PAGE_COLLECTION: Record<string, string> = Object.fromEntries([
  ...[...K8S_PAGES, ...LEGACY_PAGES].map((p) => [p.key, "architecture"]),
  ...MTX_PAGES.map((p) => [p.key, "mediamtx"]),
  ...MATRIX_PAGES.map((p) => [p.key, "matrix"]),
  ...TAK_PAGES.map((p) => [p.key, "working-with-tak"]),
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function draftBody(key: string): string {
  const path = `${DRAFTS}/${key}.md`;
  if (!existsSync(path)) throw new Error(`Missing draft: ${path}`);
  return readFileSync(path, "utf8");
}

async function findOrCreateCollection(
  client: OutlineApiClient,
  name: string,
  description: string,
): Promise<string> {
  const existing = (await client.listCollections()).find(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    console.log(`  collection "${name}" exists: ${existing.id}`);
    return existing.id;
  }
  const created = await client.createCollection(name, description);
  console.log(`  collection "${name}" created: ${created.id}`);
  await sleep(120);
  return created.id;
}

async function findOrCreateDoc(
  client: OutlineApiClient,
  opts: {
    collectionId: string;
    parentDocumentId?: string;
    title: string;
    text: string;
  },
): Promise<string> {
  const siblings = await client.listDocuments({
    collectionId: opts.collectionId,
    parentDocumentId: opts.parentDocumentId,
  });
  const hit = siblings.find(
    (d) => d.title.trim().toLowerCase() === opts.title.trim().toLowerCase(),
  );
  if (hit) {
    await client.updateDocument(hit.id, opts.text);
    await sleep(120);
    return hit.id;
  }
  const doc = await client.createDocument({ ...opts, publish: true });
  await sleep(120);
  return doc.id;
}

/** Re-assert sibling order (documents.create prepends new docs). */
async function reorder(
  client: OutlineApiClient,
  collectionId: string,
  parentDocumentId: string | undefined,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await client.moveDocument({
      id: orderedIds[i],
      collectionId,
      parentDocumentId,
      index: i,
    });
    await sleep(120);
  }
}

function walk(nodes: OutlineNavNode[], fn: (n: OutlineNavNode) => void): void {
  for (const n of nodes) {
    fn(n);
    walk(n.children, fn);
  }
}

const slugFromUrl = (url: string) => url.split("/").filter(Boolean).pop() ?? "";

async function main() {
  const client = createOutlineClient();
  const collectionsOnly = process.argv.includes("--collections-only");

  console.log("Collections:");
  const archId = await findOrCreateCollection(
    client,
    "Architecture",
    "How the OpenDefence platform works: components, networking, PKI, deployment",
  );
  const mtxId = await findOrCreateCollection(
    client,
    "MediaMTX",
    "The MediaMTX video streaming integration: architecture and internals",
  );
  const matrixId = await findOrCreateCollection(
    client,
    "Matrix",
    "The Matrix messaging integration: architecture and internals",
  );

  writeFileSync(
    UUID_OUT,
    JSON.stringify(
      { architecture: archId, mediamtx: mtxId, matrix: matrixId },
      null,
      2,
    ),
  );
  console.log(`UUIDs written to ${UUID_OUT}`);
  if (collectionsOnly) return;

  // key -> created doc id (for link resolution)
  const docIds: Record<string, string> = {};

  // ---- Architecture book -------------------------------------------------
  console.log("Architecture tree:");
  const archEn = await findOrCreateDoc(client, {
    collectionId: archId,
    title: "en",
    text: "",
  });
  const platforms = await findOrCreateDoc(client, {
    collectionId: archId,
    parentDocumentId: archEn,
    title: "Platforms",
    text: CONTAINER_MARKER,
  });
  const dockerOrg = await findOrCreateDoc(client, {
    collectionId: archId,
    parentDocumentId: platforms,
    title: "Docker Compose (legacy)",
    text: DOCKER_MARKER,
  });
  const k8sOrg = await findOrCreateDoc(client, {
    collectionId: archId,
    parentDocumentId: platforms,
    title: "Kubernetes",
    text: K8S_MARKER,
  });

  const legacyIds: string[] = [];
  for (const p of LEGACY_PAGES) {
    docIds[p.key] = await findOrCreateDoc(client, {
      collectionId: archId,
      parentDocumentId: dockerOrg,
      title: p.title,
      text: draftBody(p.key),
    });
    legacyIds.push(docIds[p.key]);
    console.log(`  page ${p.key}`);
  }
  const k8sIds: string[] = [];
  for (const p of K8S_PAGES) {
    docIds[p.key] = await findOrCreateDoc(client, {
      collectionId: archId,
      parentDocumentId: k8sOrg,
      title: p.title,
      text: draftBody(p.key),
    });
    k8sIds.push(docIds[p.key]);
    console.log(`  page ${p.key}`);
  }

  // ---- MediaMTX / Matrix books -------------------------------------------
  const flatBook = async (
    label: string,
    collectionId: string,
    pages: PageSpec[],
  ): Promise<string[]> => {
    console.log(`${label} tree:`);
    const en = await findOrCreateDoc(client, {
      collectionId,
      title: "en",
      text: "",
    });
    const ids: string[] = [];
    for (const p of pages) {
      docIds[p.key] = await findOrCreateDoc(client, {
        collectionId,
        parentDocumentId: en,
        title: p.title,
        text: draftBody(p.key),
      });
      ids.push(docIds[p.key]);
      console.log(`  page ${p.key}`);
    }
    await reorder(client, collectionId, en, ids);
    return ids;
  };
  await flatBook("MediaMTX", mtxId, MTX_PAGES);
  await flatBook("Matrix", matrixId, MATRIX_PAGES);

  // ---- Working with TAK chapter ------------------------------------------
  console.log("Working with TAK chapter:");
  const takRootDocs = await client.getCollectionDocuments(WORKING_WITH_TAK_ID);
  const takEn = takRootDocs.find((d) => d.title.trim().toLowerCase() === "en");
  if (!takEn) throw new Error("working-with-tak: no 'en' root doc found");
  const takChapter = await findOrCreateDoc(client, {
    collectionId: WORKING_WITH_TAK_ID,
    parentDocumentId: takEn.id,
    title: TAK_CHAPTER_TITLE,
    text: "",
  });
  for (const p of TAK_PAGES) {
    docIds[p.key] = await findOrCreateDoc(client, {
      collectionId: WORKING_WITH_TAK_ID,
      parentDocumentId: takChapter,
      title: p.title,
      text: draftBody(p.key),
    });
    console.log(`  page ${p.key}`);
  }
  // Append the chapter as the LAST sibling without touching existing order.
  const takSiblings = await client.listDocuments({
    collectionId: WORKING_WITH_TAK_ID,
    parentDocumentId: takEn.id,
  });
  await client.moveDocument({
    id: takChapter,
    collectionId: WORKING_WITH_TAK_ID,
    parentDocumentId: takEn.id,
    index: Math.max(0, takSiblings.length - 1),
  });
  await sleep(120);

  // ---- Reorder architecture book (create prepends) -----------------------
  await reorder(client, archId, platforms, [dockerOrg, k8sOrg]);
  await reorder(client, archId, dockerOrg, legacyIds);
  await reorder(client, archId, k8sOrg, k8sIds);

  // ---- Resolve @@page:key@@ placeholders ---------------------------------
  console.log("Resolving cross-links:");
  const slugById: Record<string, string> = {};
  for (const cid of [archId, mtxId, matrixId, WORKING_WITH_TAK_ID]) {
    const byLocale = await client.getCollectionStructure(cid, "");
    for (const root of Object.values(byLocale)) {
      if (!root) continue;
      walk([root], (n) => {
        slugById[n.id] = slugFromUrl(n.url);
      });
    }
  }
  const routeForKey = (key: string): string => {
    const id = docIds[key];
    const slug = id ? slugById[id] : undefined;
    if (!slug) throw new Error(`No slug resolved for page key "${key}"`);
    return `/en/${PAGE_COLLECTION[key]}/${slug}`;
  };

  for (const [key, id] of Object.entries(docIds)) {
    const raw = draftBody(key);
    const resolved = raw.replace(/@@page:([a-z0-9-]+)@@/g, (_, k: string) =>
      routeForKey(k),
    );
    const leftover = resolved.match(/@@page:[a-z0-9-]+@@/);
    if (leftover)
      throw new Error(`${key}: unresolved placeholder ${leftover[0]}`);
    if (resolved !== raw) {
      await client.updateDocument(id, resolved);
      await sleep(120);
      console.log(`  ${key}: links resolved`);
    }
  }

  console.log("Done. Collection UUIDs:");
  console.log(
    JSON.stringify(
      { architecture: archId, mediamtx: mtxId, matrix: matrixId },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
