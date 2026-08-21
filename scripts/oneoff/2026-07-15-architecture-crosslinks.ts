/**
 * One-off: point existing dev-book pages at the new Architecture / product
 * books (run AFTER scripts/oneoff/2026-07-15-architecture-books.ts).
 * Idempotent: skips a doc whose text already links the new books.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createOutlineClient,
  type OutlineApiClient,
  type OutlineNavNode,
} from "../lib/outline-api";

const UUIDS = JSON.parse(
  readFileSync(
    "/private/tmp/claude-501/-Users-bbr-Documents-GitHub-react-opendefence-docs/5492964c-c7a8-4681-a14a-d46ee8a55ef1/scratchpad/authoring/collections.json",
    "utf8",
  ),
) as { architecture: string; matrix: string };

const DOCS = {
  archOrientation: "c9108d13-25cb-446a-8f4d-fd2e8886e1eb",
  deployK8s: "8a1b8ee3-f02b-4f5f-8782-cc62eaecbd20",
  day2K8s: "3217efcd-4398-4d67-bff6-e39283952de1",
  integrationOverview: "06c323ed-98d4-42bc-9e42-db456259d50e",
  workedExampleMatrix: "9a36f046-832a-4adb-af2c-d44328ffd0be",
};

const slugFromUrl = (url: string) => url.split("/").filter(Boolean).pop() ?? "";

async function titleSlugMap(
  client: OutlineApiClient,
  collectionId: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const walk = (nodes: OutlineNavNode[]) => {
    for (const n of nodes) {
      map[n.title.trim()] = slugFromUrl(n.url);
      walk(n.children);
    }
  };
  const byLocale = await client.getCollectionStructure(collectionId, "");
  for (const root of Object.values(byLocale)) if (root) walk([root]);
  return map;
}

async function splice(
  client: OutlineApiClient,
  id: string,
  name: string,
  guard: string,
  anchor: string,
  addition: string,
): Promise<void> {
  const text = await client.getDocumentText(id);
  if (text.includes(guard)) {
    console.log(`  ${name}: already linked, skipping`);
    return;
  }
  if (!text.includes(anchor)) {
    console.warn(`  ${name}: ANCHOR NOT FOUND, skipping — check manually`);
    return;
  }
  await client.updateDocument(id, text.replace(anchor, anchor + addition));
  console.log(`  ${name}: updated`);
}

async function main() {
  const client = createOutlineClient();
  const arch = await titleSlugMap(client, UUIDS.architecture);
  const matrix = await titleSlugMap(client, UUIDS.matrix);

  const need = (m: Record<string, string>, t: string): string => {
    if (!m[t]) throw new Error(`No slug for title "${t}"`);
    return m[t];
  };
  const ovw = `/en/architecture/${need(arch, "Platform overview")}`;
  const data = `/en/architecture/${need(arch, "Data & secrets")}`;
  const pki = `/en/architecture/${need(arch, "PKI & trust")}`;
  const pattern = `/en/architecture/${need(arch, "Integration pattern")}`;
  const mstack = `/en/matrix/${need(matrix, "Matrix stack (Kubernetes)")}`;

  console.log("Cross-link edits:");

  {
    // Sentence replacement (not append) in "Going deeper".
    const text = await client.getDocumentText(DOCS.archOrientation);
    const oldSentence =
      "For the detailed Kubernetes component breakdown — manifest layout, phasing, operators, and per-service folders — see the **Develop Deploy App** book.";
    const newSentence = `For the component-level deep dive — manifest layout, phasing, operators, networking, PKI, and the integration pattern — see the [Architecture](${ovw}) book; it follows the platform switch and covers both the legacy Compose stack and Kubernetes.`;
    if (text.includes("/en/architecture/")) {
      console.log("  architecture-orientation: already linked, skipping");
    } else if (text.includes(oldSentence)) {
      await client.updateDocument(
        DOCS.archOrientation,
        text.replace(oldSentence, newSentence),
      );
      console.log("  architecture-orientation: Going deeper rewritten");
    } else {
      console.warn(
        "  architecture-orientation: ANCHOR NOT FOUND — check manually",
      );
    }
  }

  await splice(
    client,
    DOCS.deployK8s,
    "deploy-on-kubernetes",
    "/en/architecture/",
    "For the shared in-UI onboarding flow, see **Operator quickstart**.",
    ` The architecture behind this stack — components, phases, networking, PKI — is documented page by page in the [Architecture](${ovw}) book.`,
  );

  await splice(
    client,
    DOCS.day2K8s,
    "day-2-operations-kubernetes",
    "/en/architecture/",
    "for failure modes see **Troubleshooting & teardown**.",
    ` Architecture background for these procedures: [Data & secrets](${data}) and [PKI & trust](${pki}).`,
  );

  await splice(
    client,
    DOCS.integrationOverview,
    "integration-overview",
    "/en/architecture/",
    "*Register your integration (Docker Compose)* / *(Kubernetes)*.",
    ` The platform-side anatomy of a deployed integration — namespace, certificates, mesh identity, registration — is described in [Integration pattern](${pattern}).`,
  );

  await splice(
    client,
    DOCS.workedExampleMatrix,
    "worked-example-matrix",
    "/en/matrix/",
    "Read it alongside **Scaffold from the template**.",
    ` The runtime architecture of the deployed Matrix stack (Synapse, MAS, LiveKit, Element Call) is documented in [Matrix stack (Kubernetes)](${mstack}).`,
  );

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
